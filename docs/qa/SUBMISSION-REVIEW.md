# Submission review · September 10, 2026

**The repository is prepared for judge review. Final submission steps remain
owner-controlled:** confirm the narrated video, Uniswap feedback form, track and
partner selections in the event dashboard. The repository does not establish
that those external steps are complete.

## Changes made

| Finding | Result |
| --- | --- |
| The README had grown to 720 lines with repeated explanations | Reduced to 267 lines: problem, demo actions, sponsor roles, code/contracts, evidence, security and new/reused work. |
| Technical detail competed with the overview | Preserved [design improvements](../DESIGN.md), [development/recovery](../DEVELOPMENT.md) and [full prior-work disclosure](../PRIOR-WORK.md) in dedicated pages. |
| Uniswap verification required searching | Direct links now identify the Trading/LP API calls, Sepolia pool, Universal Router, Permit2, position manager and real lifecycle receipts. |
| Blocky402 needed a prominent explanation | The README includes the paid-request sequence, exact per-source cost, consuming agent and settled receipts. No-match is kept distinct from payout authorization. |
| Aivy, AI and prior plugins needed a clear boundary | Explicit new/reused table, Aivy integration diff, open upstream PRs and AI-assistance disclosure. Take Studio remains a separate creator repository. |
| Package descriptions and setup comments described older behavior | Updated descriptions, shared-host custody comment and optional companion key. Setup distinguishes a local cover service from the fully configured hosted demo. |
| No repository CI workflow | Added a Linux clean-install job for backend tests and UI build, using HTTPS for public GitHub dependencies without private SSH credentials. |
| Live `/api/pool` returned 503 | Fixed typed SDK account/token IDs being rejected by the Mirror balance reader; added a regression that still rejects arbitrary objects. |

## Validation

| Check | Observed result |
| --- | --- |
| Backend, local Node 22.21.1 | **162 passed**, no failures or skipped tests. Fixtures and temporary journals only. |
| Backend, isolated VPS Node 22.23.2 | **162 passed**, using Linux native dependencies; no live credentials or registry copied into validation. |
| Frontend | TypeScript and production Vite build passed. Existing main-bundle warning: 680.6 kB minified / 241.7 kB gzip; future performance work, not a failed build. |
| Production dependency audit | `npm audit --omit=dev` reported **0 known advisories** on September 10. This is the backend lockfile result, not an independent security audit. |
| Pool regression | The same typed SDK account now reads **200,115.4 aUSDd**; the deployed endpoint recovered from 503 to 200. |
| Capacity at deployment | Committed **19,246.040014**, available **180,869.359986 aUSDd**. Snapshot only; [live pool](https://quorum.aivylabs.xyz/api/pool) remains authoritative for current display. |
| Deployment integrity | Financial-journal hashes matched before/after; all four Quorum processes returned online. No policy, payment, bridge or swap was submitted for this review. |
| Live ledger evidence | [Fresh public GET verification](../evidence/submission-mirror-review.json) passed: policy #34 terms, NFT owner, premium, pool balance and the recorded mainnet 4 HBAR transfer. |
| Local links | All referenced local documentation/media targets resolved; main-document section anchors checked. |
| Disclosure and source history | Quorum starts September 4; Aivy integration has a linked diff. Mirror skill PR #16 and Agent Kit PR #1088 were both still open when rechecked. |
| Source hygiene | Private environment and runtime journals remain excluded; `.env.example` is the only tracked environment file. The targeted credential scan's two candidates were Markdown anchors, not keys. |

[CI runs](https://github.com/jmgomezl/aivy-parametric-pool/actions/workflows/check.yml)
record the result of the clean-install workflow for each commit.

## Reproduce the checks

```sh
npm test
npm --prefix ui run build
npm audit --omit=dev
node scripts/verify-mirror-reads.mjs
```

The final command uses public GET requests to check policy #34, HCS terms, NFT
ownership, its premium and the recorded 4 HBAR mainnet transfer. It submits no
transaction. [Read-path design and evidence](../MIRROR-NODE.md).

## Submission confirmations

- Confirm the final video contains the founder's human narration. The committed
  3:59 visual cut is silent; it is not the final submitted video.
- Complete the Uniswap feedback form with the public `FEEDBACK.md` URL, or confirm
  that this has already been done. The file alone does not establish submission.
- Confirm Continuity registration, chosen partner tracks and the final project
  submission in the signed-in dashboard.

[Current rules, prize fit and checklist](../SUBMISSION.md#submission-checklist).
