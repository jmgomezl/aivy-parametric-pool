# Audit implementation and verification

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

- `npm test`: 20 passing offline app tests.
- `npm --prefix ui run build`: passing TypeScript and production build.
- Sibling plugin: 15 passing tests; typecheck, lint and build pass.
- `git diff --check`: clean in both repositories.
- UI fixture server has no ledger imports, keys or external calls; its fake records
  are isolated on a separate origin from the real app.

## Deliberate boundaries

Event checks remain request-driven and are labeled manual. No production
monitoring or remote deployment was performed. No transaction was submitted as
part of these verification checks. Historical ledger scripts were syntax-checked,
not rerun against funded accounts. Existing mainnet receipts remain recordings.
Interrupted ledger writes can require operator reconciliation; the system retains
capacity rather than assuming they failed. A shared filesystem book is required
for issuance processes; this is not a distributed database or production insurer.
