# BullPrint — $ANSEM Wallet Checker

BullPrint is a read-only Solana wallet checker and community distribution monitor for one configured $ANSEM mint and distribution wallet.

The application never connects to a visitor's wallet, requests a signature, or asks for transaction approval. It only reads verified public Solana data that has been indexed by the monitor Worker.

## Architecture

- **React + Vite frontend** — wallet form, verification result, receipt UI, tracked-mint links, and live distribution dashboard.
- **Frontend Cloudflare Worker** — serves the SPA, exposes controlled same-origin API routes, and edge-caches distribution summaries briefly.
- **Distribution monitor Worker** — scans the configured distribution wallet every minute.
- **Cloudflare D1** — stores deduplicated verified transfers, monitor cursors, and aggregate statistics.
- **Private Solana RPC binding** — the RPC URL remains in Cloudflare Secrets Store and is never exposed to the browser.
- **Cloudflare Rate Limiting API** — protects public lookup and restricted RPC routes from excessive use.

## Public application routes

- `GET /api/wallet?address=<SOLANA_ADDRESS>` — indexed wallet verification.
- `GET /api/distributions` — distribution totals, latest batch, and recent transfers.
- `POST /api/solana-rpc` — restricted JSON-RPC proxy used only for approved Solana methods.

## Local frontend development

```bash
npm install
npm run dev
```

Create a local `.env` only when a development RPC override is required:

```env
SOLANA_RPC_URL=https://your-development-rpc.example
```

Do not commit RPC URLs or API keys.

## Build and deploy the frontend

```bash
npm run lint
npm run build
npm run deploy
```

The frontend Worker configuration is stored in `wrangler.jsonc`. Requests under `/api/*` run through Worker code before static assets are served. Distribution summaries are cached at the edge for 15 seconds to reduce repeated D1 reads during traffic bursts.

## Distribution monitor setup

```bash
cd cloudflare-monitor
npm install
npx wrangler d1 migrations apply ansem-distribution-db --remote
npx wrangler deploy
```

The monitor requires:

- D1 binding: `DB`
- Secrets Store binding: `SOLANA_RPC_URL`
- Rate-limit bindings: `PUBLIC_API_RATE_LIMITER` and `RPC_RATE_LIMITER`
- Cron trigger: once per minute

See `cloudflare-monitor/README.md` for monitor-specific operations.

## Data-integrity behaviour

- Transfer inserts are idempotent.
- Monitor cursors advance only after every transaction in a page succeeds.
- Failed RPC pages are retried on the next scheduled run.
- A fresh database receives its statistics row automatically.
- Large distribution batches are paginated instead of being truncated at 500 transfers.
- A wallet is not reported as definitively absent until historical backfill is complete.
- User-facing evidence links open independent Solscan records.

## Tracked Solana configuration

- Network: Solana Mainnet
- Mint: `9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump`
- Distribution wallet: `GV6UUmNxz2RpKxmNAPadYKb7uQpszwqQAu3qLJxVdC52`

## Security notes

- Never commit private RPC credentials.
- Keep the RPC allowlist narrow.
- Treat all addresses and query parameters as untrusted input.
- Keep rate-limit namespace IDs unique within the Cloudflare account.
- The tool provides public-chain evidence and does not imply official project endorsement.
