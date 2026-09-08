# QA and judge review · September 8, 2026

The app's core demonstration is ready for a recording rehearsal. Final deployment
and a fresh paid-request check are being verified in this review; the result and
receipt will be recorded here before the review is marked complete.

## What was fixed

| Finding | Result |
| --- | --- |
| A structurally valid but unsigned payment could start a catalogue query before Hedera rejected payment | Verify the debit-account signature on every node body, transaction lifetime, current key and funds before resource work and again before fee signing. Invalid requests fail closed. |
| A normal clean install pulled an unused legacy Agent Kit peer tree | Alias the legacy peer name to the current scoped 4.1.0 kit. Clean installs on macOS and Linux pass all 110 tests; root and UI audits report zero advisories at review time. The old lockfile reported 23. This was a reproducibility issue, not evidence that an unused PDF feature was publicly exposed. |
| Three checked-in oracle nginx templates had incomplete server blocks | Replaced with valid initial HTTP templates; all three pass an isolated Linux `nginx -t`. Existing live TLS configuration remains separate. |
| UI and deployment instructions described older functionality | Documented managed bridge/swap/LP actions, ARPS limitations, Node 22, private journals, safe dependency switching and permanent lock files. Added the MIT license already declared by the package. |

## Verification

| Check | Result |
| --- | --- |
| Unit, security and recovery tests | **110/110 pass** on Node 22 macOS and clean Linux install; zero skips |
| Frontend | TypeScript and Vite build pass; root and UI audit report zero advisories at review time |
| Responsive routes | **54 views** across 320, 390, 768, 900, 1024 and 1440 px; no horizontal overflow or browser exceptions |
| User flows | Six groups pass: quotes/popups, worldwide search, funding/oracle detail, all six story scenes, extension-free managed quote, expired swap/LP review recovery |
| Map and chart | Five viewport/DPR interaction checks (up to 2732 px), five cursor/accessibility modes, seven history-sidebar widths; pointer, keyboard and playback stay synchronized |
| Receipt authenticity | **14 independent ledger checks**: NFT/premium/x402 records, actual mainnet 4 HBAR scheduled transfer and pool key, Axelar source/delivery, Uniswap swaps and LP creation/exit |
| Public source hygiene | 212 tracked text files checked for common credential patterns; no matching secrets found. This is a bounded scan, not a secret-detection guarantee. |

The responsive run used the public HTTPS application. Read-only browser checks
blocked transaction submissions; the expired-review cases used explicit fixtures.
An older chart test expected a removed close button; it was updated to use the
current **Explore data** toggle and passed. No application change was needed.

[Ledger recheck evidence](../evidence/judge-review-ledgers.json) ·
[Payment regression cases](../../tests/payment-authorization.test.js) ·
[Security architecture](../AGENT-SECURITY.md)

## Judge assessment

**Hedera:** the strongest contribution is a reusable native settlement primitive:
publish terms on HCS, represent cover with an HTS NFT, pre-sign a Scheduled
Transaction, then require the agent plus two oracle keys for execution. The
network performs the transfer when authorized. The current mainnet account key
and scheduled 4 HBAR transfer match the recorded demonstration.

**Uniswap:** this is a working Trading API and V3 integration. A Hedera-native
application transports a test asset through the HAK Axelar plugin and ITS, then
uses Uniswap for EVM trading liquidity. Quotes, bounded approvals, swaps and
separate real LP NFTs have executable paths and receipts. ARPS is not a Uniswap
LP token; policy funding cards are not separate vaults. The app should demonstrate
one clear bridge/swap journey before optional LP operations.

**Novelty:** committing the exact conditional payment before the event separates
agreement from execution. Reusable agent tools connect that native Hedera workflow
to paid evidence services and EVM liquidity. The Uniswap and Axelar plugins are
prior work; the guarded integration and scheduled-settlement plugin are disclosed
as event work. Visual polish supports that contribution but does not replace it.

## Remaining submission actions

- Confirm Continuity participation in the ETHGlobal dashboard. Hedera's Continuity
  prize requires substantive new work and a clear reuse boundary. The app has a
  plausible technical fit; registration and organizer acceptance are not verified.
  [Hedera rules](https://ethglobal.com/events/ethonline2026/prizes/hedera).
- Submit Uniswap's developer feedback form with the public **FEEDBACK.md** URL;
  having the file in the repository alone is insufficient. Form submission remains
  unverified. [Uniswap rules](https://ethglobal.com/events/ethonline2026/prizes/uniswap-foundation).
- Record a focused 2–4 minute video, at least 720p, with your own voice. Edit out
  waits without accelerating footage. Follow the [recording guide](../SUBMISSION.md).
  [Event rules](https://ethglobal.com/events/ethonline2026/info/details).

The self-hosted x402 service does **not** satisfy the Agentic Payments prize's
Blocky402 requirement. HTS usage alone does not establish the ATS prize, and a
HAK plugin alone does not establish a Harness contribution.

## Boundaries to say accurately

- The agent is deterministic; an LLM does not authorize transfers. Oracle checks
  are manually requested. Mainnet footage is a controlled recorded experiment.
- Demo keys share one host. Hot custody, independent oracle operators, production
  fee-sponsorship controls and refunds remain production work.
- Insurance-pool deposits issue ARPS; insurance-income distribution and ARPS exit
  are unavailable. Uniswap LP fees and withdrawals are a separate implemented flow.
- Bridging uses the visitor's test balance. Policy payouts go to another demo
  beneficiary; automated payout conversion and mainnet execution are not claimed.
- Mirror nodes, catalogues, Photon, Axelar and Uniswap are external dependencies.
  Their outages remain possible. Preserve request IDs and use clearly labeled
  recorded evidence when a live action is unavailable.
- The initial frontend bundle still triggers Vite's 500 kB advisory. That is a
  follow-up optimization; the checked routes and interactions remain usable.
