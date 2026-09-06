# Aivy Quorum · submission and recording guide

Aivy Quorum commits an earthquake payout before an event. The agent signs a
Hedera Scheduled Transaction; two of three oracle keys complete the authorization
and the network executes it. The app makes the terms, NFT and receipts visible.

Live: https://quorum.aivylabs.xyz/
App: https://github.com/jmgomezl/aivy-parametric-pool
Reusable plugin: https://github.com/jmgomezl/hak-scheduled-settlement

## 3-minute 15-second walkthrough

| Time | Screen / action | Explain |
| --- | --- | --- |
| 0:00–0:20 | Cover homepage | Fixed earthquake payouts can be committed before an event. |
| 0:20–0:45 | Search Medellin; Explore data | The historical chart holds payout at $800; premiums vary with the record. Return to cover for current terms. |
| 0:45–1:15 | Create funded testnet cover; view policy | A real NFT, published terms, premium transfer and scheduled payout. Demo assets have no cash value. Cut network waiting from the recording. |
| 1:15–1:35 | Cover policy → Payout in ETH? · Uniswap | Live USDC-equivalent conversion on Base or Unichain mainnet. Show quote ID. No bridge or swap executes. |
| 1:35–2:00 | Fund a policy → Tokyo → contribution slider | Proposed participation: back a policy and share premiums. Show income and full capital at risk. Preview only; no deposit. |
| 2:00–2:40 | How it works | Replay commit → one confirmation → two confirmations → executed transfer. Controlled mainnet recording, not a live earthquake claim. Open the actual receipt. |
| 2:40–3:00 | Onchain → x402 | Real testnet payment gates a historical catalogue query. A negative event result is valid; payment does not mean claim approval. |
| 3:00–3:15 | Final story step / repository | Oracle keys alone cannot spend. Explain the reusable plugin and new hackathon work. |

## Evidence and scope

- Cover creation is real testnet issuance, free to the visitor through funded demo accounts.
- Mainnet story proves a real 4 HBAR settlement with controlled signatures. It does not demonstrate autonomous event detection or independent oracle operators.
- x402 evidence: [public request/result](evidence/x402-testnet.json), [settled payment](https://hashscan.io/testnet/transaction/0.0.7231440-1788672698-044530315).
  Payment: 1,000 base units = 0.001 aUSDd; USGS service returned HTTP 200 after settlement.
  The query covers Mexico City in January 2025. It found no qualifying event and did not sign any policy.
- x402 uses the deployed self-hosted testnet facilitator. No Blocky mainnet payment is claimed.
- Per-policy funding, LP NFTs and premium distribution are a proposed model. Working LP primitives issue fungible shares for the shared pool; the public UI does not accept LP deposits.
- Annual premium rate is gross, before claims and costs. It is not guaranteed yield. The slider shows capital at risk.
- Automatic ledger execution is implemented; earthquake checks remain manually requested.

## Submission checklist

Use the event dashboard to confirm the selected Continuity track and partner eligibility.
Keep the README's prior-work boundary and provide both repositories. Describe the
new scheduled-settlement plugin, key restriction, pricing, reservation guard,
premium split and paid oracle services. Include [AI assistance](AI-ASSISTANCE.md).

Official rules: https://ethglobal.com/events/ethonline2026/info/details
Checked September 6, 2026: video must be 2–4 minutes, at least 720p, with human
narration (no AI voiceover); deadline September 13 at 12:00 EDT / 11:00 Bogotá.
Select up to three partner prizes and explain the actual integration for each.
Partner-specific eligibility still needs to be confirmed against the chosen prizes.

Before recording, check `/api/health`, `/api/pool`, `/api/activity`, and policy
receipts. Use the existing demo policies if a new issuance is interrupted; do not
repeat an uncertain request with a fresh identifier. Record on the public HTTPS
site. Record your own voice and edit waiting time out without speeding up footage.

## Reproduce the x402 evidence

`node scripts/demo-x402.js --execute` uses the dedicated testnet payer credentials
in the gitignored local registry. It spends testnet tokens and facilitator fees,
performs one historical `/attest` query and writes public result JSON under
`.artifacts`. It never calls `/attest-and-sign`. Do not rerun merely to inspect
existing evidence, and do not copy the private registry into the repository or VPS.

## Optional Uniswap demonstration (15 seconds)

On a cover policy, open **Payout in ETH? · Uniswap**. Show the live USDC-to-ETH
quote, switch Base → Unichain, and open **Verify Uniswap quote**. Explain:
“If the modeled payout were held as USDC, this is its current ETH conversion.
Uniswap supplies the real mainnet liquidity quote; our demo does not bridge
Hedera funds or execute the swap.” The quote ID and API route are inspectable.
This is a live API integration, not a completed onchain swap or a Uniswap LP NFT.

API behavior follows the [Uniswap integration guide](https://developers.uniswap.org/docs/trading/swapping-api/start-building/integration-guide).

[Recorded API evidence](evidence/uniswap-quotes.json) preserves actual Base and
Unichain quote IDs and routes from the verification run. These are expired price
snapshots, not transaction receipts; use the UI to request current prices.
