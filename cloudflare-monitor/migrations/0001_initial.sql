CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY,
  signature TEXT NOT NULL,
  instruction_index INTEGER NOT NULL,
  recipient TEXT NOT NULL,
  source_wallet TEXT NOT NULL,
  mint TEXT NOT NULL,
  amount_raw TEXT NOT NULL,
  decimals INTEGER NOT NULL,
  block_time INTEGER NOT NULL,
  slot INTEGER,
  detected_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS transfers_signature_instruction_idx
  ON transfers (signature, instruction_index);

CREATE INDEX IF NOT EXISTS transfers_recipient_idx
  ON transfers (recipient, block_time DESC);

CREATE INDEX IF NOT EXISTS transfers_block_time_idx
  ON transfers (block_time DESC, detected_at DESC);

CREATE TABLE IF NOT EXISTS monitor_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS distribution_stats (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  total_raw TEXT NOT NULL DEFAULT '0',
  decimals INTEGER NOT NULL DEFAULT 0,
  transfer_count INTEGER NOT NULL DEFAULT 0,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  last_detected_at INTEGER
);

INSERT INTO distribution_stats (
  id,
  total_raw,
  decimals,
  transfer_count,
  recipient_count,
  last_detected_at
) VALUES (1, '0', 0, 0, 0, NULL)
ON CONFLICT(id) DO NOTHING;
