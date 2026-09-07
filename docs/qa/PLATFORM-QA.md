# Platform QA — September 7, 2026

Status: in progress. This review covers the current application and deployed services.

## Completion checklist

- [ ] Buyer: worldwide search, valid/refused quote, account creation, premium purchase, NFT/terms/receipt, recovery.
- [ ] Funding: actual shared-pool deposit, ARPS balance/supply percentage, pending/rejected deposit behavior, economics previews and clear limits.
- [ ] Broker: referral discovery, code propagation, same-price premium split, credited commission and transaction receipt.
- [ ] Oracle: frontend access to request-driven checks; bounded payment/signing; no-match/unavailable versus actual signatures; testnet/mainnet labeling.
- [ ] Cross-chain: HAK Axelar source/destination evidence, pending delivery, approval/swap recovery, live quote/build APIs and visible receipts.
- [ ] Navigation/design: home, policies, policy, funding, story, not-found; desktop/tablet/phone, keyboard and dismissible overlays.
- [ ] History: fixed $800 payout, click/drag/keyboard year, annual red/green change, return to live cover.
- [ ] Judge/business clarity: one pool versus per-policy previews; premium splits; actual versus proposed income/exit; sponsor boundaries and trust limits.
- [ ] Regression tests/build, public API smoke tests, Git/VPS revision and deployment verification.

## Initial authoritative findings

- `src/demo/service.js` calls `deposit` with one registry `poolAccountId`; ARPS is fungible, fixed 1:1 demo issuance. There is no per-policy deposit route.
- Income distributions, NAV-priced exits and ARPS sales are not implemented. Funding UI labels this, but the per-policy preview still emphasizes a hypothetical annual rate and a contribution slider.
- `PolicyPage.tsx` says event checks are manual without an action. Three deployed oracle services expose real testnet x402 `/attest-and-sign` endpoints.
- Live oracle services are **testnet** (aUSDd), despite older conversation expectations that x402 was mainnet-only. Mainnet proof is a separately recorded demonstration.
- Pending deposit UI can remain blocked after server-side completion because `FundPool` has no account-journal reconciliation effect; the backend also refuses all pending deposit replays.
- The isolated UI fixture has fallen behind API shapes (pool budget and demo account routes) and needs repair before it can prove failure-state behavior.

The audit will record fixes, evidence and explicitly retained product limits below.
