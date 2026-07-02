# Credibility review checklist

## Public trust surface

- Tracked mint displayed near the primary checker.
- Copy, Solscan, and Birdeye links available for the configured mint.
- Recipient wallets and transaction signatures link to Solscan.
- Crawlable metadata describes the live read-only product accurately.

## User experience

- Distribution totals use compact display with exact values available on tap.
- Historical indexing has a visible activity indicator and explanation.
- Recent transfers support search and pagination.
- Match, no-match, indexing, invalid-address, and provider-error states remain distinct.
- Light and dark themes are functional and persistent.

## Operations

- Distribution data is sourced from D1 and edge-cached briefly.
- Wallet and distribution routes use a public API rate limiter.
- Restricted Solana RPC calls use a stricter rate limiter.
- CI rejects prototype wording and missing trust links.
