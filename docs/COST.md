# Adoption cost (USD)

Measured gas comes from `npm run test:contract` and `scripts/deploy_testnet.cjs` (local chain run, same bytecode). Prices are single readings taken 2026-10-19 08:59 UTC: gas price from each chain's public RPC (`eth_gasPrice`), ETH price from CoinGecko's free endpoint (USD 2,435.03). They are readings, not forecasts.

| Operation | Gas (measured) | Ethereum L1 (0.045 gwei) | Base (0.006 gwei) | Arbitrum One (0.02 gwei) |
|---|---|---|---|---|
| Deploy registry (once) | 591,764 | $0.065 | $0.0087 | $0.029 |
| Add one attestor (once per auditor) | 47,602 | $0.0052 | $0.0007 | $0.0023 |
| Register one claim, first range of a batch | 161,917 | $0.018 | $0.0024 | $0.0079 |
| Register one claim, 40th range of one batch | 223,336 | $0.024 | $0.0033 | $0.011 |
| 1,000 claims a month at about 200k gas | 200,000,000 | $21.9 | $2.95 | $9.74 |
| Check a claim (read the registry) | 0 | $0 | $0 | $0 |

What is not in the table: on an L2 the final bill also includes a fee for posting the transaction data to Ethereum; the RPC gas price above does not contain it, and we did not measure it. Treat the L2 columns as a lower bound.

Zero-cost parts and why:
- Hosting: the demo is static files on GitHub Pages (free for public repositories). No server, no database.
- Registry reads: one free HTTP request per serial to the Gold Standard public endpoint; no key, no account.
- RPC: public endpoints are enough for one registration per claim; no paid node.
- The contract itself charges no fee.

Reviewer view: a verification is free; recording it on chain costs about two to three cents on L1 and under one cent on an L2 at today's prices.
