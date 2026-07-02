const TRACKED_MINT = '9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump';
const DISTRIBUTION_WALLET = 'GV6UUmNxz2RpKxmNAPadYKb7uQpszwqQAu3qLJxVdC52';
const RECENT_LIMIT = 20;
const BACKFILL_LIMIT = 10;
const BATCH_GAP_SECONDS = 15 * 60;
const QUERY_PAGE_SIZE = 500;
const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getRpcUrl(env) {
  const binding = env.SOLANA_RPC_URL;
  if (!binding) throw new Error('SOLANA_RPC_URL binding is missing');
  return typeof binding.get === 'function' ? binding.get() : binding;
}

async function rpc(env, method, params = []) {
  const rpcUrl = await getRpcUrl(env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method,
        params,
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);

    const payload = await response.json();
    if (payload.error) throw new Error(payload.error.message || 'Solana RPC error');
    return payload.result;
  } finally {
    clearTimeout(timer);
  }
}

async function getState(env, key) {
  const row = await env.DB.prepare('SELECT value FROM monitor_state WHERE key = ?')
    .bind(key)
    .first();
  return row?.value ?? null;
}

async function setState(env, key, value) {
  await env.DB.prepare(`
    INSERT INTO monitor_state (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `)
    .bind(key, String(value), Math.floor(Date.now() / 1000))
    .run();
}

async function deleteState(env, key) {
  await env.DB.prepare('DELETE FROM monitor_state WHERE key = ?').bind(key).run();
}

async function ensureStatsRow(env) {
  await env.DB.prepare(`
    INSERT INTO distribution_stats (
      id,
      total_raw,
      decimals,
      transfer_count,
      recipient_count,
      last_detected_at
    ) VALUES (1, '0', 0, 0, 0, NULL)
    ON CONFLICT(id) DO NOTHING
  `).run();
}

function accountKey(value) {
  return typeof value === 'string' ? value : value?.pubkey;
}

function flattenInstructions(transaction) {
  const top = transaction?.transaction?.message?.instructions || [];
  const inner = transaction?.meta?.innerInstructions || [];
  const flattened = [...top];

  for (const group of inner) {
    for (const instruction of group.instructions || []) flattened.push(instruction);
  }

  return flattened;
}

function extractTransfers(transaction, signature) {
  if (!transaction || transaction.meta?.err) return [];

  const accountKeys = (transaction.transaction?.message?.accountKeys || []).map(accountKey);
  const indexByKey = new Map(accountKeys.map((key, index) => [key, index]));
  const tokenMeta = new Map();

  for (const balance of [
    ...(transaction.meta?.preTokenBalances || []),
    ...(transaction.meta?.postTokenBalances || []),
  ]) {
    tokenMeta.set(balance.accountIndex, {
      owner: balance.owner,
      mint: balance.mint,
      decimals: balance.uiTokenAmount?.decimals,
    });
  }

  const transfers = [];
  const instructions = flattenInstructions(transaction);

  instructions.forEach((instruction, instructionIndex) => {
    const parsed = instruction?.parsed;
    const type = parsed?.type;
    if (type !== 'transfer' && type !== 'transferChecked') return;

    const info = parsed.info || {};
    const sourceIndex = indexByKey.get(info.source);
    const destinationIndex = indexByKey.get(info.destination);
    const sourceMeta = tokenMeta.get(sourceIndex) || {};
    const destinationMeta = tokenMeta.get(destinationIndex) || {};
    const mint = info.mint || sourceMeta.mint || destinationMeta.mint;
    const sourceOwner = sourceMeta.owner || info.authority;
    const recipient = destinationMeta.owner || info.destination;
    const amountRaw = info.tokenAmount?.amount || info.amount;
    const decimals =
      info.tokenAmount?.decimals ?? sourceMeta.decimals ?? destinationMeta.decimals;

    if (sourceOwner !== DISTRIBUTION_WALLET) return;
    if (mint !== TRACKED_MINT) return;
    if (!recipient || recipient === DISTRIBUTION_WALLET) return;
    if (!amountRaw || decimals === undefined || decimals === null) return;

    transfers.push({
      id: `${signature}:${instructionIndex}`,
      signature,
      instructionIndex,
      recipient,
      amountRaw: String(amountRaw),
      decimals: Number(decimals),
      blockTime: transaction.blockTime,
      slot: transaction.slot,
    });
  });

  return transfers;
}

async function storeTransfers(env, transfers) {
  if (!transfers.length) return 0;

  await ensureStatsRow(env);

  let addedRaw = 0n;
  let decimals = 0;
  let inserted = 0;
  const detectedAt = Math.floor(Date.now() / 1000);

  for (const transfer of transfers) {
    const result = await env.DB.prepare(`
      INSERT OR IGNORE INTO transfers (
        id,
        signature,
        instruction_index,
        recipient,
        source_wallet,
        mint,
        amount_raw,
        decimals,
        block_time,
        slot,
        detected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        transfer.id,
        transfer.signature,
        transfer.instructionIndex,
        transfer.recipient,
        DISTRIBUTION_WALLET,
        TRACKED_MINT,
        transfer.amountRaw,
        transfer.decimals,
        transfer.blockTime || detectedAt,
        transfer.slot || null,
        detectedAt,
      )
      .run();

    if ((result.meta?.changes || 0) > 0) {
      addedRaw += BigInt(transfer.amountRaw);
      decimals = transfer.decimals;
      inserted += 1;
    }
  }

  if (!inserted) return 0;

  const current = await env.DB.prepare(
    'SELECT total_raw FROM distribution_stats WHERE id = 1',
  ).first();

  const totals = await env.DB.prepare(`
    SELECT
      COUNT(*) AS transfer_count,
      COUNT(DISTINCT recipient) AS recipient_count,
      MAX(block_time) AS last_detected_at
    FROM transfers
  `).first();

  const totalRaw = BigInt(current?.total_raw || '0') + addedRaw;

  await env.DB.prepare(`
    INSERT INTO distribution_stats (
      id,
      total_raw,
      decimals,
      transfer_count,
      recipient_count,
      last_detected_at
    ) VALUES (1, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      total_raw = excluded.total_raw,
      decimals = excluded.decimals,
      transfer_count = excluded.transfer_count,
      recipient_count = excluded.recipient_count,
      last_detected_at = excluded.last_detected_at
  `)
    .bind(
      totalRaw.toString(),
      decimals,
      Number(totals?.transfer_count || 0),
      Number(totals?.recipient_count || 0),
      totals?.last_detected_at || detectedAt,
    )
    .run();

  return inserted;
}

async function processSignature(env, signatureInfo) {
  if (!signatureInfo?.signature || signatureInfo.err) return 0;

  const transaction = await rpc(env, 'getTransaction', [
    signatureInfo.signature,
    {
      encoding: 'jsonParsed',
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    },
  ]);

  if (!transaction) return 0;

  const transfers = extractTransfers(transaction, signatureInfo.signature);
  return storeTransfers(env, transfers);
}

async function processSignatures(env, signatures) {
  let inserted = 0;

  for (const signatureInfo of [...signatures].reverse()) {
    inserted += await processSignature(env, signatureInfo);
    await sleep(80);
  }

  return inserted;
}

async function scanRecent(env) {
  const latestSignature = await getState(env, 'latest_signature');

  if (!latestSignature) {
    const signatures = await rpc(env, 'getSignaturesForAddress', [
      DISTRIBUTION_WALLET,
      { limit: RECENT_LIMIT, commitment: 'confirmed' },
    ]);

    if (!signatures?.length) return { checked: 0, inserted: 0, backlog: false };

    const inserted = await processSignatures(env, signatures);
    await setState(env, 'latest_signature', signatures[0].signature);
    await setState(env, 'backfill_before', signatures[signatures.length - 1].signature);

    return { checked: signatures.length, inserted, backlog: false };
  }

  const before = await getState(env, 'recent_before');
  let pendingNewest = await getState(env, 'recent_pending_newest');
  const options = {
    limit: RECENT_LIMIT,
    commitment: 'confirmed',
    until: latestSignature,
  };

  if (before) options.before = before;

  const signatures = await rpc(env, 'getSignaturesForAddress', [
    DISTRIBUTION_WALLET,
    options,
  ]);

  if (!signatures?.length) {
    if (pendingNewest) {
      await setState(env, 'latest_signature', pendingNewest);
      await deleteState(env, 'recent_pending_newest');
      await deleteState(env, 'recent_before');
    }

    return { checked: 0, inserted: 0, backlog: false };
  }

  if (!pendingNewest) {
    pendingNewest = signatures[0].signature;
    await setState(env, 'recent_pending_newest', pendingNewest);
  }

  const inserted = await processSignatures(env, signatures);

  if (signatures.length === RECENT_LIMIT) {
    await setState(env, 'recent_before', signatures[signatures.length - 1].signature);
    return { checked: signatures.length, inserted, backlog: true };
  }

  await setState(env, 'latest_signature', pendingNewest);
  await deleteState(env, 'recent_pending_newest');
  await deleteState(env, 'recent_before');

  return { checked: signatures.length, inserted, backlog: false };
}

async function scanBackfill(env) {
  if ((await getState(env, 'backfill_complete')) === '1') {
    return { checked: 0, inserted: 0, complete: true };
  }

  const before = await getState(env, 'backfill_before');
  if (!before) return { checked: 0, inserted: 0, complete: false };

  const signatures = await rpc(env, 'getSignaturesForAddress', [
    DISTRIBUTION_WALLET,
    { before, limit: BACKFILL_LIMIT, commitment: 'confirmed' },
  ]);

  if (!signatures?.length) {
    await setState(env, 'backfill_complete', '1');
    return { checked: 0, inserted: 0, complete: true };
  }

  const inserted = await processSignatures(env, signatures);
  await setState(env, 'backfill_before', signatures[signatures.length - 1].signature);

  return { checked: signatures.length, inserted, complete: false };
}

async function runMonitor(env) {
  const startedAt = Date.now();
  await ensureStatsRow(env);

  const recent = await scanRecent(env);
  const backfill = await scanBackfill(env);

  await setState(env, 'last_run_at', Math.floor(Date.now() / 1000));
  await setState(env, 'last_run_status', 'ok');

  return {
    ok: true,
    recent,
    backfill,
    durationMs: Date.now() - startedAt,
  };
}

function formatRaw(rawValue, decimals) {
  const raw = String(rawValue || '0');
  const places = Number(decimals || 0);
  if (!places) return raw;

  const padded = raw.padStart(places + 1, '0');
  const whole = padded.slice(0, -places);
  const fraction = padded.slice(-places).replace(/0+$/, '');

  return fraction ? `${whole}.${fraction}` : whole;
}

async function loadLatestDistribution(env) {
  let offset = 0;
  let previousTime = null;
  let latestTime = null;
  let latestRaw = 0n;
  let decimals = 0;
  let transferCount = 0;
  const recipients = new Set();
  const recentTransfers = [];
  let complete = false;

  while (!complete) {
    const pageResult = await env.DB.prepare(`
      SELECT signature, recipient, amount_raw, decimals, block_time, slot
      FROM transfers
      ORDER BY block_time DESC, detected_at DESC, id DESC
      LIMIT ? OFFSET ?
    `)
      .bind(QUERY_PAGE_SIZE, offset)
      .all();

    const rows = pageResult.results || [];
    if (!rows.length) break;

    for (const transfer of rows) {
      if (recentTransfers.length < 25) recentTransfers.push(transfer);

      if (previousTime !== null && previousTime - transfer.block_time > BATCH_GAP_SECONDS) {
        complete = true;
        break;
      }

      latestTime ??= transfer.block_time;
      previousTime = transfer.block_time;
      latestRaw += BigInt(transfer.amount_raw);
      decimals = Number(transfer.decimals || decimals);
      transferCount += 1;
      recipients.add(transfer.recipient);
    }

    if (complete || rows.length < QUERY_PAGE_SIZE) break;
    offset += rows.length;
  }

  return {
    latestTime,
    latestRaw,
    decimals,
    transferCount,
    recipientCount: recipients.size,
    recentTransfers,
  };
}

async function getPublicData(env) {
  await ensureStatsRow(env);

  const stats = await env.DB.prepare(
    'SELECT * FROM distribution_stats WHERE id = 1',
  ).first();
  const latest = await loadLatestDistribution(env);
  const decimals = Number(stats?.decimals || latest.decimals || 0);
  const lastRunAt = Number(await getState(env, 'last_run_at')) || null;
  const monitoring = Boolean(
    lastRunAt && Math.floor(Date.now() / 1000) - lastRunAt <= 5 * 60,
  );

  return {
    status: {
      monitoring,
      backfillComplete: (await getState(env, 'backfill_complete')) === '1',
      lastRunAt,
    },
    totals: {
      amountRaw: stats?.total_raw || '0',
      amount: formatRaw(stats?.total_raw || '0', decimals),
      decimals,
      verifiedTransfers: Number(stats?.transfer_count || 0),
      uniqueRecipients: Number(stats?.recipient_count || 0),
      lastDetectedAt: stats?.last_detected_at || null,
    },
    latestDistribution: latest.transferCount
      ? {
          amountRaw: latest.latestRaw.toString(),
          amount: formatRaw(latest.latestRaw.toString(), decimals),
          recipientCount: latest.recipientCount,
          transferCount: latest.transferCount,
          lastDetectedAt: latest.latestTime,
          status:
            Math.floor(Date.now() / 1000) - latest.latestTime <= BATCH_GAP_SECONDS
              ? 'in_progress'
              : 'completed',
        }
      : null,
    recentTransfers: latest.recentTransfers.map((transfer) => ({
      signature: transfer.signature,
      recipient: transfer.recipient,
      amountRaw: transfer.amount_raw,
      amount: formatRaw(transfer.amount_raw, transfer.decimals),
      decimals: transfer.decimals,
      blockTime: transfer.block_time,
      slot: transfer.slot,
      explorerUrl: `https://explorer.solana.com/tx/${transfer.signature}`,
    })),
    tracked: {
      mint: TRACKED_MINT,
      distributionWallet: DISTRIBUTION_WALLET,
      network: 'Solana Mainnet',
    },
  };
}

async function getWalletLookup(env, address) {
  if (!BASE58_ADDRESS.test(address || '')) {
    return json({ ok: false, error: 'A valid public Solana wallet address is required.' }, 400);
  }

  let offset = 0;
  let totalRaw = 0n;
  let transferCount = 0;
  let latestTransfer = null;
  let decimals = 0;

  while (true) {
    const pageResult = await env.DB.prepare(`
      SELECT signature, amount_raw, decimals, block_time, slot
      FROM transfers
      WHERE recipient = ?
      ORDER BY block_time DESC, detected_at DESC, id DESC
      LIMIT ? OFFSET ?
    `)
      .bind(address, QUERY_PAGE_SIZE, offset)
      .all();

    const rows = pageResult.results || [];
    if (!rows.length) break;

    latestTransfer ??= rows[0];

    for (const transfer of rows) {
      totalRaw += BigInt(transfer.amount_raw);
      decimals = Number(transfer.decimals || decimals);
      transferCount += 1;
    }

    if (rows.length < QUERY_PAGE_SIZE) break;
    offset += rows.length;
  }

  if (!latestTransfer) {
    const backfillComplete = (await getState(env, 'backfill_complete')) === '1';
    return json({
      ok: true,
      found: false,
      indexing: !backfillComplete,
      reason: backfillComplete
        ? 'No matching $ANSEM distribution was found in the completed indexed history.'
        : 'Historical indexing is still in progress.',
    });
  }

  return json({
    ok: true,
    found: true,
    recipient: address,
    amountReceived: formatRaw(totalRaw.toString(), decimals),
    rawAmountReceived: totalRaw.toString(),
    decimals,
    tokenMint: TRACKED_MINT,
    sourceWallet: DISTRIBUTION_WALLET,
    transactionSignature: latestTransfer.signature,
    blockTime: latestTransfer.block_time,
    slot: latestTransfer.slot,
    transferCount,
    explorerUrl: `https://explorer.solana.com/tx/${latestTransfer.signature}`,
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: JSON_HEADERS });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === '/' || url.pathname === '/health') {
        await ensureStatsRow(env);
        const rpcHealth = await rpc(env, 'getHealth');
        const stats = await env.DB.prepare(
          'SELECT * FROM distribution_stats WHERE id = 1',
        ).first();

        return json({
          ok: rpcHealth === 'ok' && Boolean(stats),
          worker: 'ready',
          database: stats ? 'connected' : 'not connected',
          rpc: rpcHealth === 'ok' ? 'connected' : 'not connected',
        });
      }

      if (url.pathname === '/api/distributions') {
        return json({ ok: true, ...(await getPublicData(env)) });
      }

      if (url.pathname === '/api/wallet') {
        return getWalletLookup(env, url.searchParams.get('address') || '');
      }

      return json({ ok: false, error: 'Not found' }, 404);
    } catch (error) {
      console.error('Request failed', error);
      return json(
        {
          ok: false,
          error: 'The distribution monitor is temporarily unavailable.',
        },
        500,
      );
    }
  },

  async scheduled(_controller, env, context) {
    context.waitUntil(
      runMonitor(env).catch(async (error) => {
        console.error('Scheduled monitor failed', error);
        await setState(env, 'last_run_at', Math.floor(Date.now() / 1000));
        await setState(env, 'last_run_status', 'error');
      }),
    );
  },
};
