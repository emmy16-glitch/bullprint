# $ANSEM Distribution Monitor

Cloudflare Worker that watches the configured Solana distribution wallet and mint, stores verified transfers in D1, and exposes public read-only distribution data.

## Public endpoints

- `GET /health` — Worker, D1, and RPC health.
- `GET /api/distributions` — totals, latest distribution, and recent verified transfers.
- `GET /api/wallet?address=<SOLANA_ADDRESS>` — indexed verification for one public wallet.
- `POST /api/solana-rpc` — restricted Solana JSON-RPC proxy handled by `src/entry.js`.

## Required bindings

- `DB` — D1 database named `ansem-distribution-db`.
- `SOLANA_RPC_URL` — Secrets Store binding for the private Solana RPC endpoint.

Never commit the private RPC URL or API key.

## Install

```bash
npm install
```

## Apply the database migration

```bash
npx wrangler d1 migrations apply ansem-distribution-db --remote
```

The migration creates:

- `transfers` for deduplicated verified transfers.
- `monitor_state` for retry-safe recent and backfill cursors.
- `distribution_stats` for aggregate totals.
- indexes for recipient lookups and chronological distribution queries.

## Deploy

```bash
npx wrangler deploy
```

## Schedule

The Worker runs every minute through the Cron Trigger in `wrangler.jsonc`.

A failed transaction page causes the scheduled run to fail before its cursor advances. Cloudflare retries the same page on a later run, preventing silent gaps in the index.

## Wallet lookup behaviour

Wallet lookup is served from D1 rather than making every browser rescan Solana history. A wallet is only reported as definitively absent when historical backfill has completed. During backfill, an unindexed wallet receives an indexing-in-progress response instead of a false negative.

## Operations checklist

1. Apply migrations before the first production deployment.
2. Confirm `/health` reports the Worker, database, and RPC as connected.
3. Confirm `/api/distributions` reports `monitoring: true` after the cron has run.
4. Confirm `backfillComplete` becomes true before treating negative wallet results as final.
5. Monitor Worker logs for RPC timeouts, rate limits, or repeated failed pages.
