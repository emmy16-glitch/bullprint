const TRACKED_MINT = '9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump';
const DISTRIBUTION_WALLET = 'GV6UUmNxz2RpKxmNAPadYKb7uQpszwqQAu3qLJxVdC52';
const QUERY_PAGE_SIZE = 500;

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

async function calculateIndexedStats(env) {
  let offset = 0;
  let totalRaw = 0n;
  let decimals = null;
  let transferCount = 0;
  let lastDetectedAt = null;
  const recipients = new Set();

  while (true) {
    const pageResult = await env.DB.prepare(`
      SELECT recipient, amount_raw, decimals, block_time
      FROM transfers
      WHERE source_wallet = ? AND mint = ?
      ORDER BY id
      LIMIT ? OFFSET ?
    `)
      .bind(DISTRIBUTION_WALLET, TRACKED_MINT, QUERY_PAGE_SIZE, offset)
      .all();

    const rows = pageResult.results || [];
    if (!rows.length) break;

    for (const transfer of rows) {
      const rowDecimals = Number(transfer.decimals || 0);

      if (decimals === null) decimals = rowDecimals;
      if (decimals !== rowDecimals) {
        throw new Error(`Inconsistent token decimals: ${decimals} and ${rowDecimals}`);
      }

      totalRaw += BigInt(String(transfer.amount_raw || '0'));
      transferCount += 1;
      recipients.add(transfer.recipient);
      lastDetectedAt = Math.max(lastDetectedAt || 0, Number(transfer.block_time || 0)) || null;
    }

    if (rows.length < QUERY_PAGE_SIZE) break;
    offset += rows.length;
  }

  return {
    totalRaw: totalRaw.toString(),
    decimals: decimals ?? 0,
    transferCount,
    recipientCount: recipients.size,
    lastDetectedAt,
  };
}

export async function reconcileDistributionStats(env) {
  await ensureStatsRow(env);

  const previous = await env.DB.prepare(
    'SELECT total_raw, decimals, transfer_count, recipient_count, last_detected_at FROM distribution_stats WHERE id = 1',
  ).first();
  const calculated = await calculateIndexedStats(env);
  const reconciledAt = Math.floor(Date.now() / 1000);

  const changed =
    String(previous?.total_raw || '0') !== calculated.totalRaw
    || Number(previous?.decimals || 0) !== calculated.decimals
    || Number(previous?.transfer_count || 0) !== calculated.transferCount
    || Number(previous?.recipient_count || 0) !== calculated.recipientCount
    || Number(previous?.last_detected_at || 0) !== Number(calculated.lastDetectedAt || 0);

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
      calculated.totalRaw,
      calculated.decimals,
      calculated.transferCount,
      calculated.recipientCount,
      calculated.lastDetectedAt,
    )
    .run();

  await setState(env, 'last_reconciled_at', reconciledAt);
  await setState(env, 'last_reconciliation_changed', changed ? '1' : '0');
  await setState(env, 'last_reconciled_transfer_count', calculated.transferCount);

  return { ...calculated, reconciledAt, changed };
}
