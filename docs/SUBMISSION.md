# Aivy Quorum · submission and recording guide

Aivy Quorum commits an earthquake payout before an event. The agent signs a
Hedera Scheduled Transaction; two of three oracle keys complete the authorization
and the network executes it. The app makes the terms, NFT and receipts visible.

Live: https://quorum.aivylabs.xyz/
App: https://github.com/jmgomezl/aivy-parametric-pool
Reusable plugin: https://github.com/jmgomezl/hak-scheduled-settlement

Latest [readiness and UX review](qa/READINESS-REVIEW.md). Keep the recording focused
on one complete cover journey and the Hedera → Uniswap path; technical evidence
is one disclosure away. No extension or faucet setup is needed in the public app.

## 3-minute 15-second walkthrough

| Time | Screen / action | Explain |
| --- | --- | --- |
| 0:00–0:20 | Cover homepage | Fixed earthquake payouts can be committed before an event. |
| 0:20–0:45 | Search Medellin; Explore data | The historical chart holds payout at $800; premiums vary with the record. Return to cover for current terms. |
| 0:45–1:15 | Create funded testnet cover; view policy | A real NFT, published terms, premium transfer and scheduled payout. Demo assets have no cash value. Cut network waiting from the recording. |
| 1:15–1:35 | Swap → Bridge / Swap | Hedera → HAK Axelar plugin → Sepolia → Uniswap. Use the funded demo: real bridge, approval and swap receipts without an extension. |
| 1:35–2:00 | Fund the pool → deposit and ARPS balance | One shared pool backs all policies. ARPS arrives atomically. Per-policy cards are economics previews; no separate vault or guaranteed yield. |
| 2:00–2:40 | How it works | Replay commit → one confirmation → two confirmations → executed transfer. Controlled mainnet recording, not a live earthquake claim. Open the actual receipt. |
| 2:40–3:00 | Policy → Check for earthquakes | Bounded testnet x402 payments query the published policy terms. No-match and unavailable are different; payment does not mean claim approval. |
| 3:00–3:15 | Final story step / repository | Oracle keys alone cannot spend. Explain the reusable plugin and new hackathon work. |

## Evidence and scope

- Cover creation is real testnet issuance, paid from the visitor’s funded demo account.
- Mainnet story proves a real 4 HBAR settlement with controlled signatures. It does not demonstrate autonomous event detection or independent oracle operators.
- x402 evidence: [public request/result](evidence/x402-testnet.json), [settled payment](https://hashscan.io/testnet/transaction/0.0.7231440-1788672698-044530315).
  Payment: 1,000 base units = 0.001 aUSDd; USGS service returned HTTP 200 after settlement.
  The query covers Mexico City in January 2025. It found no qualifying event and did not sign any policy.
- x402 uses the deployed self-hosted testnet facilitator. No Blocky mainnet payment is claimed.
- Per-policy funding, per-policy LP NFTs and insurance-premium distribution are a proposed model. Working insurance-pool primitives issue fungible ARPS shares; the public UI accepts actual shared-pool deposits. Separate Uniswap positions have real NFTs, swap-fee collection and withdrawals.
- Annual premium rate is gross, before claims and costs. It is not guaranteed yield. The slider shows capital at risk.
- Automatic ledger execution is implemented; earthquake checks are manually requested from the policy page.

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

## Uniswap and Axelar demonstration

Open **Swap** in the main navigation. The visual Hedera → Axelar → Uniswap path
explains the roles; **Bridge** and **Swap** are separate action steps. Bridge aUSDd from the service-managed Hedera demo
account to its funded Sepolia demo wallet, then review and confirm the
Uniswap swap. Exact approvals and testnet gas are handled by the scoped signer. Show [real receipts](evidence/cross-chain-testnet.json)
and [the HAK Axelar plugin transaction](evidence/hak-axelar-plugin.json). The
page also presents labeled recorded examples; distinguish those from your own
current transaction receipts.

Explain: “Hedera commits the cover, Axelar transports its demo asset, and Uniswap
provides EVM liquidity. The app uses reusable agent tools and validates their
transactions before signing.” Sponsored test liquidity is not a USD peg. The
mainnet price preview is quote-only. ARPS is not traded in this Uniswap pool.

## Technical judge: agent protection

Open any policy → **Agent guardrails & proof**. Explain that the public agent is a
deterministic workflow; an LLM does not authorize payouts. Show runtime budgets,
then the recorded agent-plus-quorum control and oracle-only blocked transfer.
[Security architecture](AGENT-SECURITY.md) identifies the tested controls and the
shared-host hot-key boundary that remains before production.

Creation budgets now persist across restarts and count interrupted attempts.
Before recording, read `/api/guardrails` and `/api/pool`. Choose a smaller cover
if capacity is low, or use an existing NFT. Keep funded Sepolia gas available in
the demonstration wallet. Do not reset a journal to make a recording pass.


### Optional Uniswap liquidity close-up

After the swap, reveal **Provide swap liquidity**: show the real seed NFT and
**Your demo position**, then open a collection or withdrawal receipt. Say:
“People can fund cover on Hedera, or supply trading liquidity on Uniswap.
These are separate positions with separate earnings.”

Use [NFT 231762’s completed lifecycle](evidence/uniswap-liquidity.json) as a
recorded example, labeled Sepolia. Its liquidity is now fully withdrawn; it
is not a currently earning position. Leave the primary bridge/swap story central.

## Wallet-free judge interaction

All public swap actions use a separate service-managed
Sepolia wallet with starter tokens and sponsored gas. Review and confirm a swap
or LP action; open its receipt. No extension or connection prompt is part of this flow.
[Verified managed swap, NFT #231774 and full exit](evidence/managed-wallet-demo.json).
