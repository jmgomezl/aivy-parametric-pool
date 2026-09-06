# Audit implementation and verification

Updated September 6, 2026. The original audit was followed by the deployed
funding-preview and submission-evidence improvements below.

## Scope delivered

| Audit requirement | Implementation | Evidence |
|---|---|---|
| Simple, visual primary journey | Three navigation destinations; compact map search/examples, quote and confirmation ring | Browser reviewed at 1280 px desktop and 390 px mobile |
| Minimal primary copy | Conditions/pricing and ledger evidence use disclosure controls; primary quote has two amounts and one action | Desktop/mobile quote inspection |
| Map clarity and navigation | City/coordinate search, zoom buttons, drag pan, selected radius; quieter historical heat layer | Browser city selection, mobile map and keyboard-accessible controls |
| Historical exploration cannot change policy terms | Explicit estimate mode; issuing disabled; closing restores M6+ | Isolated browser test verified disabled action |
| Honest demo and ownership labels | Funded testnet/aUSDd disclosures; browser-created rather than wallet-owned; separate mainnet story label | Quote, policies and all story steps inspected |
| Shared, verifiable policy state | Shared polling store and mirror-derived actual signer identities; unknown state remains unknown | Live read-only policy #14 displayed Paid and USGS/EMSC signatures |
| No fake confirmation timers | Creation waits for backend result | Isolated fixture showed Creating before confirmed policy |
| Interrupted issuance recovery | Saved request ID, request-status API, durable checkpoints/reservation and Policies recovery | Isolated interrupted POST + navigation showed Request needs review |
| Distinct loading, refusal and offline states | Dedicated states and disabled offline issuance | Browser fixtures verified no-record refusal and offline estimate |
| Readable policy ring | Amount outside ring; unknown information has a neutral graphic | Live policy detail inspection |
| Six-step judge story | Choose, commit, first confirmation, release, receipt, protection | Browser stepped through all six; invalid hash recovered to first step |
| Responsive story and evidence | Persistent mobile navigation; separate stacked protection diagrams | 390 px review, no horizontal overflow |
| Protect capital during concurrent issuance | Exclusive filesystem lock, reservation before account creation, atomic book replacement, idempotent requests | Offline concurrency, replay, failure reservation and abandoned lock tests |
| Bind oracle decisions to actual obligations | Configured HCS topic, versioned hashed terms, issuer signature, exact transfer/expiry checks | Positive/negative offline authorization tests |
| Handle HCS message chunks | Reassemble by original transaction identity; reject incomplete/intermixed chunks | Offline tests plus successful read-only reconstruction of existing testnet terms |
| Restrict payment signing | Exact legs/asset, no facilitator debit/approvals/unknown fields, fee ceiling, validation again before signing | Offline valid HBAR/token and malicious-extra-transfer tests |
| Match docs and reproduction commands | Current READMEs; HBAR replay scripts use settlement-unit arguments and explicit controlled-signature labels | Script syntax checks; docs reviewed against current source |
| Deployable API address | Same-origin default, local Vite proxy, documented production proxy configuration | Live local API/UI communication |

## Checks

- `npm test`: 26 passing offline app tests, including LP estimate and claim-scenario checks.
- `npm --prefix ui run build`: passing TypeScript and production build.
- Sibling plugin: 15 passing tests; typecheck, lint and build pass.
- `git diff --check`: clean in both repositories.
- UI fixture server has no ledger imports, keys or external calls; its fake records
  are isolated on a separate origin from the real app.

## Deliberate boundaries

Event checks remain request-driven and are labeled manual. No production
monitoring is implemented. The app and oracle services are deployed on the VPS
at quorum.aivylabs.xyz and the three oracle hostnames. The initial audit was
read-only; subsequent authorized work created three global testnet demo policies
and one x402 testnet payment. Historical mainnet ledger scripts were syntax-checked,
not rerun against funded accounts. Existing mainnet receipts remain recordings.
Interrupted ledger writes can require operator reconciliation; the system retains
capacity rather than assuming they failed. A shared filesystem book is required
for issuance processes; this is not a distributed database or production insurer.

## Submission-readiness follow-up

| Requirement | Current implementation and evidence |
| --- | --- |
| Worldwide discovery | Photon/OpenStreetMap lookup, cached and debounced; accent-free Medellin verified live |
| Understandable history | Fixed $800 modeled payout; yearly premium chart, red/green change indicators preserved |
| Funding discovery | Home “Fund a policy” links to a dedicated gallery mode; each card opens its own LP preview |
| Explain estimated earnings | Pro-rata term income and annual premium rate before claims/costs; full contribution-at-risk scenario; formula and assumptions disclosed |
| Preserve honest LP scope | No per-policy deposits or LP NFTs are issued; shared-pool primitives distinguished from proposed funding model |
| Settlement climax | Policy links into controlled mainnet replay; button explicitly says Replay; actual 4 HBAR execution rechecked through mirror node |
| x402 payment proof | 0.001 aUSDd transferred from 0.0.10386838 to USGS-service account 0.0.10386832; SUCCESS on mirror node; payment journal and public evidence JSON retained |
| Navigation | Funding back link retains gallery mode; selected coordinates survive refresh; page changes reset scroll |
| Submission docs | docs/SUBMISSION.md provides a timed walkthrough, scope, links and event requirements; docs/AI-ASSISTANCE.md discloses known AI use |

Browser verification covers desktop funding layout, 320px mobile controls and
claim outcomes, a contribution change from 10% to 100%, and the mobile story's
confirmation-to-payment transition. No new mainnet transaction was submitted.
The x402 historical query did not sign a policy or cause a payout.

## How-it-works redesign

Replaced repeated lock diagrams with six task-specific scenes: geographic terms,
capital before/after LP funding, named oracle signatures, animated transfer,
geographic NFT with receipt trail, and successful/blocked authorization tests.
Preserved all six deep links and mainnet evidence. Mobile retains direct step
navigation and previous/next controls; reduced-motion support is included.

## Final navigation and transfer polish

Separated the animated transfer marker from the arrowhead; the marker fades
before reaching the head. Mobile uses a downward arrow, and reduced motion
removes the marker. Desktop and 320px layouts were visually checked.

Made the quote panel's return action exit historical exploration and restore
current M6+ terms. Gallery filters now survive policy-detail round trips, and
same-page navigation synchronizes the view with the URL. Invalid paths show
recovery links. Browser checks confirmed return-to-cover, recent funding gallery
round trips, canonical Policies navigation, and the missing-page recovery.
Production build and all 26 tests pass. No new blockchain writes were made.

## Live Uniswap integration

Reused Kickoff's Uniswap API credential in ignored local and server environment
files only. Real Base and Unichain mainnet quotes now work through the existing
plugin. Added an optional “Payout in ETH? · Uniswap” disclosure to current cover
quotes and cover policy details, using the modeled payout as hypothetical USDC.
Timestamp, expiry, refresh, quote ID, network, estimated extra gas and the latest
API route response are visible without implying a bridge or executed swap.

Verified production quotes on both networks, 320px layout without overflow,
homepage/policy entry points, network switching, expiry, refresh and invalid
inputs. Build and 32 tests pass, including exact units, quote caching/coalescing,
expiry, bounds, sanitization, malformed results and API request limits. Public
snapshot evidence is in docs/evidence/uniswap-quotes.json. No approval, swap,
Hedera transaction or wallet signature was submitted for this integration.

## Technical agent review and hardening

Added durable pre-ledger attempt budgets, seeded from known policies/reservations,
with strict configuration validation and hashed IP identifiers. Fixed proxy
identity handling, bounded JSON parsing, exact issuance field validation and
sanitized public errors. Oracle query specs are bounded, and duplicate catalogue
votes do not count twice. The x402 client requires explicit payment authorization
and does not retry ambiguous payments. Registry files are written privately.

The policy's optional Agent guardrails & proof section reads `/api/guardrails`;
`docs/AGENT-SECURITY.md` documents the deterministic execution boundary, tests,
shared-host hot-key limitation and requirements for production custody.

Validation: 41 tests pass locally and in the isolated VPS runtime, including
signing/decoding cases after patched protobuf, WebSocket and gRPC dependencies.
Production dependency installation (123 packages, development and unused peers
omitted) reports zero known vulnerabilities. Quorum's four processes run on an
isolated Node 22.23.2 interpreter; other applications were untouched.

Live checks confirmed HTTP 400/413 refusals, three unpaid oracle HTTP 402
challenges, successful Uniswap quoting and an oversized cover refusal before any
reservation/write. The restored rolling budget remains $19,651.86 used; it was
not reset. Evidence: `docs/evidence/agent-guardrails.json`. The new disclosure fits
320px without horizontal overflow. No new policy or payment was made by this
security review. This is not an independent security audit or certification.
