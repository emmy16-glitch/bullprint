# $ANSEM Distribution Monitor

Cloudflare Worker that watches the configured Solana distribution wallet and mint, stores verified transfers in D1, and exposes public read-only distribution data.

## Public endpoints

- `/health` — Worker, D1, and RPC health
- `/api/distributions` — totals, latest distribution, and recent verified transfers

## Required bindings

- `DB` — D1 database named `ansem-distribution-db`
- `SOLANA_RPC_URL` — Secrets Store binding for the private Solana RPC endpoint

## Schedule

The Worker runs every minute through the Cron Trigger in `wrangler.jsonc`.

Never commit the private RPC URL or API key.
