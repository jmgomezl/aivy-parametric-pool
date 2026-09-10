# Aivy cover-agent release · September 9, 2026 (Colombia)

**Live:** [Aivy homepage](https://aivylabs.xyz) → **Try the cover canvas** →
[monthly agent](https://aivylabs.xyz/quorum). The existing office navigation also
links to Quorum. The old Aivy backend was not rebuilt or restarted.

| Check | Result |
| --- | --- |
| First real purchase | [Medellín #34](https://quorum.aivylabs.xyz/policy/34): 10 aUSDd premium, 1,398.885588 aUSDd conditional payout. |
| Ledger evidence | Premium, NFT mint, delivery and freeze receipts all SUCCESS. HCS terms exist. Scheduled payout has agent signature and has not executed. |
| Monthly mandate | Maximum three periods, 10 aUSDd per purchase, minimum 800 aUSDd payout. Next planned attempt: October 9 at 11:18:56 PM Colombia / October 10 at 04:18:56 UTC. |
| Duplicate prevention | Manual check, reload and resume left one completed policy. The VPS worker restart preserved the same mandate, receipt and date. |
| Pause | Persisted after page reload. The recording mandate was resumed under the same bounded rules. |
| Responsive UI | Fixture checks at 1440, 1024, 768, 390 and 320 px. Live checks at 1440, 390 and 320 px. No horizontal overflow or page errors. |
| Bundle and build | Aivy `build:web` passed; the focused route does not load the old wallet/office bundle. |
| Backend tests | 134 passed, including 12 dedicated renewal tests. Calendar/recovery scenarios use mocked ledger calls and a fake clock. |
| Video | 3:59, 1080p, 30 fps, 13 synchronized chapters. New Aivy segment at 3:21. Human narration remains to be recorded. |

The Aivy full-repository build/tests retain failures reproduced on untouched
`6ddc263`: older backend TypeScript errors, two outdated test expectations and a
local SQLite Node ABI mismatch. This release uses the verified frontend build
and Quorum backend; those older backend failures were not changed or hidden.

[Architecture and guardrails](../COVER-AGENT.md) ·
[Machine-readable evidence](../demo-video/cover-agent-evidence.json) ·
[Video checks](../demo-video/QA.md).
