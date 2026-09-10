# Current app media · September 10, 2026

**Actual captures from [Quorum](https://quorum.aivylabs.xyz) and
[Aivy Labs](https://aivylabs.xyz/quorum).** Both companions used real responses.
No purchases, deposits, swaps, plan changes or ledger signatures were submitted.

| Animation | What it shows |
| --- | --- |
| [Quorum flow](quorum-flow.gif) | World map and cursor → Tokyo quote → draggable premium history → geographic cover NFTs → typed network question. |
| [Aivy Labs → Quorum](aivy-quorum.gif) | Saved monthly rules → actual status answer for policy #34 → next planned renewal → the same policy opened in Quorum. |
| [Mainnet story](quorum-story.gif) | The current six-scene interface replaying the separate September 4 controlled experiment. |

GIFs are 1280 × 720 at 10 fps. Page-loading gaps are cut; retained interaction
plays at 1×. UI text, values and outcomes are not replaced or mocked. These are
short visual tours, not recordings of new transactions.

| Full-size still | Scope |
| --- | --- |
| [Atlas](01-atlas.png) · [Ultrawide map](10-large-screen-map.png) | Current landing page and companion launcher; ultrawide capture is 2732 × 786. |
| [Tokyo quote](02-quote.png) · [Premium history](08-explore-history.png) | Current controls and chart. History compares premiums for a fixed modeled **$800 payout**. |
| [Global NFTs](04-policies.png) · [Funding estimate](09-policy-clarity.png) | Existing cover NFTs and the separate, unminted per-policy funding preview. |
| [Swap entry](05-swap.png) · [Existing demo wallet](07-managed-demo.png) | Wallet-free onboarding and an existing confirmed Sepolia swap; no new swap here. |
| [Uniswap liquidity](06-liquidity.png) | Actual operator seed NFT, current pool balances and demo liquidity controls. |
| [ARPS position](11-funding-economics.png) | Existing 26 ARPS holding, share percentage and current shared-pool commitments. No new deposit. |
| [Recorded mainnet release](03-story.png) | UI replay of the 4 HBAR transfer; no new mainnet operation. |
| [Aivy homepage link](aivy-entry.png) · [Monthly canvas](cover-agent.png) | Entry from Aivy Labs and existing policy #34 with saved limits and next attempt. |
| [Aivy companion](cover-companion.png) | Actual AI-interpreted policy-status question, authenticated Quorum records and Mirror Node state. |
| [Quorum companion](quorum-companion.png) · [Mobile](quorum-companion-mobile.png) | Actual network explanation and a public policy-status answer, with labeled evidence. |

**Capture revisions:** Quorum [`a882cae`](https://github.com/jmgomezl/aivy-parametric-pool/commit/a882cae8e1980c47cfb560938e803dc485ce90f2)
and Aivy [`60c67a4`](https://github.com/jmgomezl/aivy/commit/60c67a4b73438ac1eb93dbc8a978bcc4b07081b0).
[Capture manifest](capture-manifest.json) records timestamps, selected scenes,
file hashes and read-only request checks. Quotes, balances and ledger states are
capture-time snapshots, not guarantees about later conditions.

`09-blocky402.png` deliberately retains its **September 8 transaction-evidence**
scope; the underlying payment was not repeated to update a screenshot.
[Blocky402 receipts](../BLOCKY402.md) · [First monthly purchase](../demo-video/cover-agent-evidence.json).

## Refresh from real UI

[Capture script](../../scripts/refresh-readme-media.mjs): Playwright/Chrome and
FFmpeg, with raw video outside Git. Set `PLAYWRIGHT_MODULE` if needed and
`QUORUM_MEDIA_WORK` to an output directory. Run `quorum`, `aivy`, `story`, `extra`
and `funded` phases, then `render` to build the GIFs.

The `aivy` and `funded` phases require existing, private recording-session files
via `AIVY_MEDIA_SESSION_FILE` and `QUORUM_MEDIA_STATE_FILE`. They never create an
account or activate a plan. All API writes are blocked except the two read-only
chat endpoints. Private capabilities and browser storage are excluded from the
manifest, screenshots and repository.
