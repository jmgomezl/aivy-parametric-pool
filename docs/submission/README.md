# ETHOnline 2026 · submission copy

Prepared September 10, 2026 for **Aivy Quorum · Continuity Track**.
This folder preserves the form copy and asset choices; it is not evidence of final submission.

## Project details

**Name:** Aivy Quorum  
**Category:** DeFi  
**Emoji:** 🛡️  
**Live demo:** https://quorum.aivylabs.xyz/

**Short description (92 characters):**

Earthquake cover with precommitted Hedera payouts, paid oracle checks and access to Uniswap.

### Description

After an earthquake, a family or small business may need cash immediately, even when the damage is too small to justify a traditional claim. Aivy Quorum explores a simpler promise: agree on the place, measurable trigger and fixed payout before the event, then make that commitment verifiable.

Choose a city, set a premium budget and create cover. Quorum issues a geographic NFT receipt, publishes the policy terms and prepares a Hedera Scheduled Transaction. The agent's signature plus two of three oracle keys authorize the transfer. A qualifying recorded earthquake triggers the agreed amount; damage alone does not.

Judges can try the complete product without installing a wallet: buy testnet cover, inspect its NFT and receipts, pay for policy-bound earthquake checks through Blocky402, fund the shared insurance pool, and test a broker referral commission. The map's interactive history shows how modeled premiums change for a fixed $800 payout.

A separate Hedera → Axelar → Uniswap journey connects the product to EVM liquidity. Funded demo wallets support real Sepolia swaps and Uniswap V3 positions, including fee collection and withdrawals. Insurance-pool shares (ARPS) remain distinct from Uniswap liquidity positions.

At https://aivylabs.xyz/quorum, a user can authorize a bounded monthly-cover agent for Medellín or another city. It checks fresh terms before each purchase. Read-only companions explain policy and network status with evidence links.

The contribution goes beyond the interface: I extracted a new reusable HAK settlement plugin, and the product also integrates my previously published Uniswap and Axelar plugins. My Mirror Node developer skill informed the verification layer, and an account-key limitation led to an upstream HAK improvement proposal. The README links each contribution and distinguishes new work, reuse and open PRs.

This is a Continuity submission. Public interactive transactions use test tokens with no cash value. The mainnet settlement is a labeled, controlled 4 HBAR experiment, not a real earthquake claim. Oracle keys currently share an operator; checks are user-triggered. ARPS earnings and redemption are not implemented. Commercial deployment would require insurance partners, risk calibration and legal review.

### How it's made

The app uses a React/Vite frontend and a Node.js backend with the Hedera SDK. Hedera provides the settlement mechanism directly: an account key requires agent AND 2-of-3 oracle authorization; a pre-signed Scheduled Transaction fixes the transfer; HCS records policy terms; HTS supplies the cover NFT, demo asset and pool shares. Premium and broker allocations settle atomically. Mirror Node reads expose balances, ownership, signatures and transaction evidence.

I extracted the conditional-settlement helpers into hak-scheduled-settlement during this event. Quorum imports its key builders and expiry limit, then constructs schedules with the SDK. The work also produced hedera-agent-kit-js issue #1087 and open PR #1088 for flat threshold/key-list account creation. The proposed core change is not merged and does not implement Quorum's nested keys.

The oracle services expose policy-bound x402 endpoints. The consuming agent validates published terms and exact payment requirements; hosted Blocky402 verifies and settles the testnet payment and sponsors network fees. Recorded payments to USGS, EMSC and GEOFON checks returned no match: a paid request is not a payout approval.

My existing hak-uniswap-plugin, published on npm, gives other Hedera Agent Kit developers reusable access to Uniswap's EVM swap tooling. During this event I added the quote-only uniswap_quote tool (GitHub 0.2.0, September 5), which Quorum consumes for Base/Unichain without an EVM signing key, token approvals or broadcast. The npm swap release remains 0.1.0 and is prior work. New project-specific Sepolia adapters use the Uniswap Trading API for executable swaps and V3 position operations. My existing hak-axelar-plugin builds Hedera ITS transfers; Quorum adds validation, journaling and matched delivery evidence. Axelar moves the asset; Uniswap supplies liquidity. No custom Solidity swap contract was added. Sponsored starter tokens were bridged previously; a new pending bridge is shown separately.

Signing is deterministic and constrained by network, token, recipient, amount, allowance, slippage, expiry and budget checks. Transactions are journaled before broadcast; uncertain outcomes are reconciled rather than blindly retried. AI companions only select from a strict read-only topic set; trusted code fetches and renders facts. They cannot spend, sign or alter a mandate. My pre-existing Mirror Node skill proposal (hedera-skills PR #16) informed concrete read-path fixes. The separate Accounts & Keys skill and wider plugin portfolio are linked as related contributions, not claimed as runtime dependencies.

New event work includes the earthquake product, guarded cross-chain execution, paid oracles, settlement package, monthly-cover worker, companions and evidence-focused UI. Earlier Aivy projects, plugins and art are disclosed in docs/PRIOR-WORK.md; docs/CONTRIBUTIONS.md maps their exact use. Codex and Claude assisted implementation, tests, design and documentation; docs/AI-ASSISTANCE.md attributes the work and assets. The public repo includes setup, security boundaries, integration code links, onchain receipts and Uniswap FEEDBACK.md.

Contribution map: https://github.com/jmgomezl/aivy-parametric-pool/blob/main/docs/CONTRIBUTIONS.md
New versus reused work: https://github.com/jmgomezl/aivy-parametric-pool/blob/main/docs/PRIOR-WORK.md
Aivy integration event diff: https://github.com/jmgomezl/aivy/compare/6ddc263...e95e50f
Uniswap plugin event diff: https://github.com/jmgomezl/hak-uniswap-plugin/compare/77e001e588b524930369f1eab30858a3c81d5d49...05bdc45ec1dbe6b142132dd1e81d6cec8457a58e
Earlier Studio/Kickoff foundation (prior work): https://github.com/jmgomezl/aivy-studio
Axelar plugin (prior work, reused at 1.0.1): https://github.com/jmgomezl/hak-axelar-plugin

### Repositories

- Main application: https://github.com/jmgomezl/aivy-parametric-pool
- New settlement package: https://github.com/jmgomezl/hak-scheduled-settlement
- Aivy integration: https://github.com/jmgomezl/aivy — [new canvas/companion diff](https://github.com/jmgomezl/aivy/compare/6ddc263...e95e50f)
- Uniswap plugin extension: https://github.com/jmgomezl/hak-uniswap-plugin — [new quote-only tool diff](https://github.com/jmgomezl/hak-uniswap-plugin/compare/77e001e588b524930369f1eab30858a3c81d5d49...05bdc45ec1dbe6b142132dd1e81d6cec8457a58e)

Keep these **four** repositories attached: each contains code developed for and
used by this submission. Quorum stays primary. The existing Aivy app and Uniswap
plugin retain their full history; only their linked event changes are claimed as new.

Link **Aivy Studio/Kickoff** and **hak-axelar-plugin** in the Continuity explanation
as prior foundations/dependencies. Link skills and upstream PRs through the
[contribution map](../CONTRIBUTIONS.md). Earlier unrelated plugins, Aivy Checkout
and Take Studio are not additional submission repositories.

[Official Continuity rules](https://ethglobal.com/events/ethonline2026/info/details) ·
[Hedera before/after requirement](https://ethglobal.com/events/ethonline2026/prizes/hedera).

## Images

| Form slot | Uploaded asset | What it shows |
| --- | --- | --- |
| Logo | [logo-quorum.png](logo-quorum.png) | Flowing mint map contours form a Q around a gold epicenter; transparent PNG |
| Cover | [cover-quorum.png](cover-quorum.png) | Aivy Quorum title, abstract topographic art and integration names |
| Screenshot 1 | [03-cover-nfts.jpg](media/03-cover-nfts.jpg) | Actual geographic cover NFT receipts |
| Screenshot 2 | [04-mainnet-settlement.jpg](media/04-mainnet-settlement.jpg) | Labeled controlled mainnet settlement |
| Screenshot 3 | [05-blocky402-receipts.jpg](media/05-blocky402-receipts.jpg) | Paid testnet oracle receipts |
| Screenshot 4 | [06-uniswap-swap.jpg](media/06-uniswap-swap.jpg) | Wallet-free swap entry and recorded cross-chain evidence |
| Screenshot 5 | [07-uniswap-liquidity.jpg](media/07-uniswap-liquidity.jpg) | Real Uniswap V3 pool, operator position and liquidity controls |
| Screenshot 6 | [08-monthly-companion.jpg](media/08-monthly-companion.jpg) | Monthly-cover canvas, issued policy and read-only companion |

Saved in the ETHGlobal draft on September 10, 2026 (Bogotá). The logo and cover
are AI-generated artwork. Screenshots are fresh, unaltered application captures;
no new blockchain transaction was executed for these captures.
[Asset previews, generation prompts and capture provenance](ASSETS.md).

## AI assistance

OpenAI Codex and Anthropic Claude assisted with implementation, security review, tests, UI design, documentation, deployment and demo preparation. I defined the product, architecture goals and scope, reviewed outputs and tested the flows. The companions use constrained AI topic interpretation; trusted code retrieves facts and no LLM authorizes spending. Codex image generation created the submission logo and abstract cover; screenshots are direct captures of the deployed apps. File areas and image/asset attribution: https://github.com/jmgomezl/aivy-parametric-pool/blob/main/docs/AI-ASSISTANCE.md. The final demo narration will be human.

## Tech stack selections

Saved and read back in the dashboard on September 10. The available database and
design-tool presets were set to **None**: the custom-tools field explicitly lists
persistent JSON journals, SVG/Canvas and the AI topic classifier. No SQL database,
Figma workflow or custom Solidity contract is claimed.

| Field | Actual stack |
| --- | --- |
| Ethereum developer tools | ethers.js; Uniswap Trading / LP APIs |
| Networks | Hedera, Ethereum Sepolia; Base and Unichain for quote-only previews |
| Languages | JavaScript, TypeScript, HTML/CSS, Node.js, Bash/Shell; no custom Solidity contract |
| Web frameworks | React, Vite, Tailwind CSS, Node.js |
| Databases | Local persistent JSON files and transaction journals; no SQL database |
| Design tools | Code-based SVG/CSS/Canvas and browser inspection; no Figma file |
| Other | Hedera SDK, Hedera Agent Kit, HCS, HTS, Mirror Node, Blocky402/x402, Axelar ITS, hak-scheduled-settlement, hak-uniswap-plugin, hak-axelar-plugin, TopoJSON/world-atlas |

## Prize rationale

The founder chose **Top 10 Finalist & Partner Prizes**. Continuity, Hedera and
Uniswap are saved, with both required personal ease-of-use ratings verified
after a fresh page load.
See [exact saved/pending state](STATUS.md).

### Hedera · Continuity

**Positioning:** a Continuity project with new agentic x402 payments. The hosted
Blocky402 service and recorded paid requests address the AI & Agentic Payments
prize's core implementation requirements; the final video must show a paid
request executing. Hedera lists a separate Continuity prize, and the published
rules do not clearly confirm that a Continuity entry can also compete for its
AI prize. Keep the new payment flow prominent without claiming eligibility for
both awards. [Hedera prize requirements](https://ethglobal.com/events/ethonline2026/prizes/hedera)
· [Event track rules](https://ethglobal.com/events/ethonline2026/info/details).

Hedera is the commitment and authorization layer, not merely a payment logo. Native Scheduled Transactions fix the payout before an event, while an agent AND 2-of-3 oracle key policy gates execution. HTS supplies cover receipts and demo assets; HCS records terms; Mirror Node makes the result independently inspectable. Blocky402 settles exact policy-bound oracle payments on testnet.

New event work includes the earthquake product, the reusable hak-scheduled-settlement package, hosted paid-oracle flow, guarded cross-chain adapters, monthly-cover worker and read-only companions. Earlier Aivy projects and npm Uniswap/Axelar plugins are disclosed. Development also produced the open HAK account-key proposal; our earlier Mirror Node skill informed concrete verification fixes.

Evidence and code: https://github.com/jmgomezl/aivy-parametric-pool#why-hedera
New/reused disclosure: https://github.com/jmgomezl/aivy-parametric-pool/blob/main/docs/PRIOR-WORK.md
Blocky402 flow and receipts: https://github.com/jmgomezl/aivy-parametric-pool/blob/main/docs/BLOCKY402.md
Reusable contributions: https://github.com/jmgomezl/aivy-parametric-pool/blob/main/docs/CONTRIBUTIONS.md

**Form code link:** https://github.com/jmgomezl/aivy-parametric-pool/blob/main/src/x402/blocky.js#L18

**Technical feedback:** Nested signer policies and native scheduling fit conditional payments. HAK account creation could better support multi-signer account setup; this build produced issue #1087 and open PR #1088 for flat thresholds. More examples for nested keys, Mirror Node reconciliation and x402 retry recovery would improve the developer experience. Quorum's nested policy comes from its separate settlement package.

### Uniswap Foundation · Best Uniswap Stack Contribution · Continuity

I built and published hak-uniswap-plugin on npm so Hedera Agent Kit developers can give their agents access to EVM swaps. Quorum shows a concrete new use: native Hedera cover with a guarded path to Uniswap liquidity. The npm 0.1.0 swap plugin is prior work; I added the quote-only tool in GitHub 0.2.0 during this event. The product integration, service-managed testnet execution and V3 position lifecycle are also event work.

Quorum uses the plugin's pinned quote tool for Base/Unichain and new Sepolia adapters for Trading API swaps and V3 create/increase/collect/remove operations. My HAK Axelar plugin supplies the separate Hedera ITS transfer builder. Every real approval, bridge, swap and position operation has an inspectable receipt; no custom Solidity swap contract is required. Insurance-pool ARPS shares are not the Uniswap LP asset.

Plugin event diff: https://github.com/jmgomezl/hak-uniswap-plugin/compare/77e001e588b524930369f1eab30858a3c81d5d49...05bdc45ec1dbe6b142132dd1e81d6cec8457a58e
Package and exact integration: https://github.com/jmgomezl/aivy-parametric-pool/blob/main/docs/HAK-UNISWAP.md
Contracts, code entry points and receipts: https://github.com/jmgomezl/aivy-parametric-pool#why-uniswap
Feedback: https://github.com/jmgomezl/aivy-parametric-pool/blob/main/FEEDBACK.md

**Form code link:** https://github.com/jmgomezl/aivy-parametric-pool/blob/main/src/settlement/crossAsset.js#L65

**Technical feedback:** A custom bridged-token Sepolia reference flow would help developers combine liquidity seeding, quotes, Permit2, exact approvals and receipt verification. A consolidated calldata-validation guide and examples for stale quotes, interrupted requests and uncertain transaction reconciliation would make agent integrations safer to build.

## Future direction

This is the product roadmap, not an accelerator or grant application. The
dashboard's optional opportunity section was saved without selecting either
opt-in; no grant/accelerator preference was assumed.

Continue toward a scoped pilot with a broker or cooperative and a licensed insurance/risk partner. First validate demand and pricing, separate oracle operators, strengthen custody and capital accounting, and measure renewal and settlement reliability. Proposed revenue is a partner subscription plus a per-policy service fee; no commercial traction or platform fee is claimed today. Keep the reusable plugins and skills available for other developers.

## Final video

Leave the submission video empty until the founder's narrated export is ready. Do not substitute the silent visual edit. Required: 2–4 minutes, at least 720p, human narration, no sped-up footage. [Recording kit](../demo-video/README.md).

Deadline: **September 13, 2026, 11:00 a.m. Bogotá / 12:00 p.m. EDT**.
[Official requirements](https://ethglobal.com/events/ethonline2026/info/details).
