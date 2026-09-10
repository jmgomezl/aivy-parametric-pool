# Prior work and event contributions

[Back to the judge overview](../README.md#what-is-new).

**This repository's commit history starts on September 4, 2026.** Pre-existing
projects and packages reused here are disclosed below; they are not claimed as
new event work.

For the contribution overview, reusable packages, skills and upstream proposals,
see the **[ecosystem contribution map](CONTRIBUTIONS.md)**.

What existed before the event, and does **not** count as new work:

- **[aivy-studio](https://github.com/jmgomezl/aivy-studio)** — earlier multi-agent
  orchestration infrastructure: HCS-10 transport, HTS escrow, workflow schema and
  canvas rendering. The new monthly-cover route uses the dedicated Aivy Labs
  frontend and Quorum worker described above.
- **[jmgomezl/aivy](https://github.com/jmgomezl/aivy)** — earlier APEX-hackathon app,
  brand and office robot art. Its new `/quorum` canvas, homepage/office links and
  companion integration were added for this event; its older agent runtime is
  not reused for monthly cover purchases.
- **[hak-uniswap-plugin](https://github.com/jmgomezl/hak-uniswap-plugin)** — Juan
  Gomez's reusable Uniswap integration for Hedera Agent Kit, [published on npm](https://www.npmjs.com/package/hak-uniswap-plugin)
  before the event. It gives HAK developers an EVM swap tool with allowance handling
  and an optional Ledger threshold gate. Quorum consumes the GitHub 0.2.0 version's
  quote tool for Base and Unichain; the published npm release is 0.1.0. Sepolia
  execution adapters are project-specific event work. [Package, reach and exact use](HAK-UNISWAP.md).
- **[hak-axelar-plugin](https://github.com/jmgomezl/hak-axelar-plugin)** — Juanma
  Gomez's pre-existing cross-chain plugin for Hedera Agent Kit, reused at **1.0.1**.
  Its **`axelar_send_token`** builder prepares the Hedera ITS transfer to Sepolia.
  The plugin itself is prior work; Quorum's guarded adapter and verified delivery
  flow were built during this event. [Integration and receipts](../README.md#built-with-our-hak-axelar-plugin).
- **[Mirror Node skill · hedera-skills PR #16](https://github.com/hedera-dev/hedera-skills/pull/16)** —
  Juanma's pre-event development guidance, submitted before September 4. Applied
  to Quorum's September 10 read-path review and fixes; the skill itself is prior
  work, not a runtime package or new event contribution. The PR remains open as of
  the review. [Exact version and application](MIRROR-NODE.md).
- **Aivy Settlement Layer (ETHGlobal Lisbon, July 2026)** — a prior continuity
  build on aivy-studio that also used HTS pools and Scheduled Transactions. The
  overlap is the *substrate*; what is new here is stated below.

**Related work, not consumed here:** the Accounts & Keys skill
[PR #29](https://github.com/hedera-dev/hedera-skills/pull/29), and our earlier
SaucerSwap, Pyth, Stader, LayerZero, Ledger, GitHub Pay and CoinCap plugins.
They are credited in the [contribution inventory](CONTRIBUTIONS.md#earlier-ecosystem-work),
not claimed as new Quorum work or runtime dependencies.

What is **new**, built during this event:

1. **Signature-gated conditional settlement** — payout as a pre-signed Scheduled
   Transaction whose trigger is oracle-quorum signature accumulation, with the
   nested `and(agent, k-of-n)` key that enforces the signature restriction. Extracted as
   [hak-scheduled-settlement](https://github.com/jmgomezl/hak-scheduled-settlement),
   a Hedera Agent Kit plugin this repo consumes, rather than left inside the app.
   Building it surfaced a gap in the kit itself — account creation cannot express
   a multi-signature key — filed as
   [hedera-agent-kit-js#1087](https://github.com/hashgraph/hedera-agent-kit-js/issues/1087)
   with a proposed fix in open PR
   [#1088](https://github.com/hashgraph/hedera-agent-kit-js/pull/1088).
   The upstream proposal covers flat threshold/key-list accounts; Quorum's nested
   key builder remains in the separate settlement plugin.
2. **A hazard-priced underwriting agent** — premiums derived live from the USGS
   catalogue for any lat/lon on earth, with published inputs.
3. **An issuance capacity guard** reserving aggregate exposure against available capital in the shared book. External spending can invalidate this off-ledger reservation.
4. **Atomic premium settlement with an open broker channel** — buyer, pool and an
   arbitrary per-sale broker settled in one multi-party transaction.
5. **Blocky402-paid oracle services** — the oracle agents sell policy-bound
   evidence through hosted testnet x402; the Quorum agent consumes the services.
6. **Guarded Hedera → Axelar → Uniswap integration** — validates plugin-built
   transfers before signing, corrects native Hedera ITS gas units, journals the
   transaction before broadcast and matches source/destination events. This
   connects the existing plugins to Quorum's funded demo wallets and real Sepolia
   swaps. [Adapter](../src/settlement/axelarPlugin.js) ·
   [Tests](../tests/axelar-plugin.test.js) · [Delivery evidence](evidence/hak-axelar-plugin.json).
7. **Aivy Labs monthly-cover canvas and worker** — explicit three-period mandates,
   fresh-quote checks, persistent scheduling, duplicate prevention and recoverable
   testnet issuance. [Source and boundaries](COVER-AGENT.md).
8. **Read-only Aivy and Quorum companions** — constrained topic interpretation,
   owner-bound account reads, public policy context and visual evidence links.
   Existing sprite art is reused. [Architecture](COMPANION.md).


## Repository history

- [Quorum history](https://github.com/jmgomezl/aivy-parametric-pool/commits/main/): starts September 4, 2026.
- [Reusable settlement plugin](https://github.com/jmgomezl/hak-scheduled-settlement): consumed by this application.
- [Aivy integration diff](https://github.com/jmgomezl/aivy/compare/6ddc263...e95e50f): see the separate repository history for the canvas and companion.

Take Studio is a [separate creator utility](https://github.com/jmgomezl/aivy-take-studio),
not a blockchain integration or part of the Quorum product submission.
[AI assistance and asset attribution](AI-ASSISTANCE.md).
