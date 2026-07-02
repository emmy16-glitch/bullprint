import entry from './entry.js';
import { reconcileDistributionStats } from './reconcile.js';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

async function getState(env, key) {
  const row = await env.DB.prepare('SELECT value FROM monitor_state WHERE key = ?')
    .bind(key)
    .first();
  return row?.value ?? null;
}

async function integritySnapshot(env) {
  const stats = await env.DB.prepare(
    'SELECT total_raw, decimals, transfer_count, recipient_count, last_detected_at FROM distribution_stats WHERE id = 1',
  ).first();
  const lastReconciledAt = Number(await getState(env, 'last_reconciled_at')) || null;
  const now = Math.floor(Date.now() / 1000);

  return {
    ok: Boolean(stats && lastReconciledAt),
    reconciliation: {
      lastReconciledAt,
      fresh: Boolean(lastReconciledAt && now - lastReconciledAt <= 5 * 60),
      correctedOnLastRun: (await getState(env, 'last_reconciliation_changed')) === '1',
      transferCount: Number(await getState(env, 'last_reconciled_transfer_count')) || 0,
    },
    totals: {
      amountRaw: stats?.total_raw || '0',
      decimals: Number(stats?.decimals || 0),
      verifiedTransfers: Number(stats?.transfer_count || 0),
      uniqueRecipients: Number(stats?.recipient_count || 0),
      lastDetectedAt: stats?.last_detected_at || null,
    },
  };
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);

    if (url.pathname === '/api/integrity') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: JSON_HEADERS });
      }
      if (request.method !== 'GET') {
        return json({ ok: false, error: 'GET requests only.' }, 405);
      }
      return json(await integritySnapshot(env));
    }

    return entry.fetch(request, env, context);
  },

  scheduled(controller, env, context) {
    const result = entry.scheduled(controller, env, context);

    context.waitUntil(
      (async () => {
        await scheduler.wait(30_000);
        await reconcileDistributionStats(env);
      })(),
    );

    return result;
  },
};
