# $ANSEM Wallet Checker

A community-built, read-only Solana wallet checker for finding tracked $ANSEM distributions.

## What it does

- accepts a public Solana wallet address
- validates that the address decodes to a 32-byte Solana public key
- checks the configured $ANSEM mint and distribution wallet
- searches a limited set of recent confirmed transactions
- displays a clear on-chain receipt when a direct tracked transfer is found

## Safety

The checker never requests a wallet connection, private key, seed phrase or transaction approval. A tracked result is not financial advice and does not mean the token or project is officially endorsed or risk-free.

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `SOLANA_RPC_URL` in `.env.local` to a private Solana Mainnet RPC endpoint. Never commit the real endpoint or API key.

## Validation

```bash
npm run lint
npm run build
```
