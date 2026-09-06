# Aivy Quorum · Earthquake cover

**Choose a place. Fix the payout. Let verified signatures release it.**

A parametric earthquake-cover prototype: a deterministic agent prices and commits
a payout; oracle keys verify the event; Hedera executes the pre-signed transfer
when its signature requirements are met. Uniswap adds a live view of what the
modeled payout could buy in ETH.

[Try the demo](https://quorum.aivylabs.xyz) · [Watch the mechanism](https://quorum.aivylabs.xyz/story) · [Recording guide](docs/SUBMISSION.md)

**Judge shortcuts:** [Hedera](#why-hedera) · [Uniswap](#why-uniswap) ·
[Novelty](#what-is-new) · [Security](#security-by-architecture) · [Evidence](#verify-in-one-minute)

![Choosing a place, pricing it from the earthquake record, and committing the payout on Hedera](docs/media/quorum-flow.gif)

*Pick a place, the agent prices it from 56 years of seismic record, and the payout
is committed on Hedera — in about twenty seconds, unedited.*

> Public cover is a **funded testnet demo**. `aUSDd` has no cash value; dollars are
> model outputs. Event checks are manually requested. Mainnet settlement is a
> labeled recording; per-policy funding is a preview.

## The problem and the improvement

Parametric cover replaces damage assessment with a measurable trigger. A remaining
engineering problem is connecting **the promised terms, event verification and
payment authority** so a reviewer can check what was actually authorized.

| Question | Quorum's implementation |
| --- | --- |
| What was promised? | Fixed beneficiary, asset, amount and earthquake conditions, published to HCS and linked from a cover NFT. |
| Who may release it? | Agent **AND** two of three oracle keys; each oracle checks terms against the actual scheduled transfer. |
| Who sends the final payout? | Hedera executes when required signatures arrive; no separate keeper/executor transaction for this transfer. |
| What could that payout mean in ETH? | A live Uniswap USDC→ETH quote, explicitly separate from settlement. |

## Why Hedera

**The obligation is a native Scheduled Transaction.** Hedera's scheduling and
nested keys directly express the fixed-transfer authorization this prototype
needs; the payout path does not require a custom settlement smart contract.

```mermaid
flowchart LR
  Terms["📜 HCS<br/>fixed policy terms"] --> Check["🔍 Oracle verifies<br/>terms and transfer"]
  Agent["✍️ Agent pre-signs<br/>at issuance"] --> Schedule["⏳ Scheduled payout<br/>waiting on the ledger"]
  Check --> Votes["🗝️ 2 of 3<br/>oracle signatures"]
  Votes --> Schedule
  Schedule --> Result["⚡ Hedera executes<br/>the fixed transfer"]
  Terms -. receipt pointer .-> NFT["🎟️ HTS cover NFT"]

  classDef record fill:#1c2333,stroke:#64748b,stroke-width:1.5px,color:#e2e8f0
  classDef commit fill:#0d3b2e,stroke:#34d399,stroke-width:2px,color:#a7f3d0
  classDef oracle fill:#3a2c08,stroke:#f5b301,stroke-width:2px,color:#fde68a
  classDef ledger fill:#0b2f40,stroke:#38bdf8,stroke-width:2px,color:#bae6fd
  classDef result fill:#064e3b,stroke:#10b981,stroke-width:3px,color:#d1fae5
  classDef outside fill:#2b1830,stroke:#c084fc,stroke-width:1.5px,color:#f3e8ff
  class Terms,NFT record
  class Agent commit
  class Check,Votes oracle
  class Schedule ledger
  class Result result
```

> Nothing polls and nothing wakes up. The payout already exists, already carries
> the agent's signature, and the network runs it the moment the quorum completes.

| Component used | Why it fits | Implementation |
| --- | --- | --- |
| **Scheduled Transactions + nested KeyList/ThresholdKey** | Prepare the exact payout now; release it only with agent + oracle quorum authorization. | [Payout](src/policy/payout.js), [reusable settlement plugin](https://github.com/jmgomezl/hak-scheduled-settlement) |
| **Hedera Consensus Service (HCS)** | Publish ordered policy terms; hash-bind them to the schedule so oracles verify the same obligation. | [Terms](src/policy/terms.js), [binding](src/policy/binding.js) |
| **Hedera Token Service (HTS)** | Issue a cover receipt NFT and transfer the demo settlement token; premium and broker split can settle atomically. | [NFT](src/policy/collection.js), [premium transfer](src/policy/purchase.js) |
| **Mirror Node + HashScan** | Read actual signer/transaction evidence and let judges independently inspect receipts. | [Ledger reader](src/ledger.js), [recorded evidence](ui/src/data/mainnet.json) |
| **Hedera Agent Kit plugin** | Extract the scheduling primitive for reuse beyond this earthquake UI. | [Dependency](package.json), [plugin repository](https://github.com/jmgomezl/hak-scheduled-settlement) |

**Boundary:** the ledger enforces signatures, not earthquake truth or every
underwriting rule. Oracle software checks conditions. Separate keys on our demo
host do not prove independent operators.

## Why Uniswap

**A payout amount is more useful when a beneficiary can inspect its purchasing
power in another asset.** “Payout in ETH?” connects the modeled cover amount to a
live liquidity quote, rather than displaying a static exchange-rate estimate.

```mermaid
flowchart LR
  Model["💵 Modeled<br/>USD payout"] --> Equivalent["🪙 The same amount<br/>as USDC"]
  Equivalent --> Server["🛡️ Server<br/>allowlisted quote tool"]
  Server --> API["🦄 Uniswap<br/>Trading API"]
  API --> View["📊 ETH estimate<br/>route, gas, expiry"]

  classDef record fill:#1c2333,stroke:#64748b,stroke-width:1.5px,color:#e2e8f0
  classDef commit fill:#0d3b2e,stroke:#34d399,stroke-width:2px,color:#a7f3d0
  classDef oracle fill:#3a2c08,stroke:#f5b301,stroke-width:2px,color:#fde68a
  classDef ledger fill:#0b2f40,stroke:#38bdf8,stroke-width:2px,color:#bae6fd
  classDef result fill:#064e3b,stroke:#10b981,stroke-width:3px,color:#d1fae5
  classDef outside fill:#2b1830,stroke:#c084fc,stroke-width:1.5px,color:#f3e8ff
  class Model,Equivalent record
  class Server commit
  class API outside
  class View ledger
```

> A quote, and it says so in the response. The payout is on Hedera and the
> liquidity is on an EVM chain; crossing needs a bridge this protocol
> deliberately does not have.

| Component used | Purpose in this app |
| --- | --- |
| **Trading API via `hak-uniswap-plugin` → `uniswap_quote`** | Fetch a real USDC→ETH quote on **Base (8453)** or **Unichain (130)** mainnet. |
| **Server-side quote adapter** | Convert exact token units, allowlist assets/chains, bound requests, cache/coalesce calls and keep the API key private. |
| **Optional conversion panel** | Show quote ID, route, estimated gas, timestamp, expiry and refresh alongside the cover amount. |

[Adapter](src/settlement/crossAsset.js) · [UI](ui/src/app/PayoutConversion.tsx) ·
[Tests](tests/cross-asset.test.js) · [Real API responses](docs/evidence/uniswap-quotes.json)

**Implemented: live quotes.** No bridge, approval, swap or ETH payout is executed.
The diagram is a data flow; Hedera funds do not move to EVM. `aUSDd` is not USDC.
The proposed per-policy LP receipt is also **not a Uniswap liquidity position**.

## What is new

The contribution is the integration of **hazard pricing → fixed obligation →
policy-bound oracle signatures → native scheduled execution**, with evidence a
judge can inspect at each step. It is not a claim to invent parametric insurance,
NFT receipts or multisignatures.

| Built during this event | Improvement contributed |
| --- | --- |
| **Reusable signature-gated settlement plugin** | Extracts the fixed-transfer primitive from the demo into Hedera Agent Kit tooling. |
| **Hazard-priced issuance with durable guards** | Turns a map location into explicit terms while checking budgets, capacity and retry safety before ledger writes. |
| **Policy-bound, x402-paid oracle services** | Connects paid catalogue access with constrained signing; payment itself never authorizes a claim. |
| **Verifiable, geographic cover UX** | Makes location, payout, funding risk and chain evidence understandable through maps, receipts and signature diagrams. |

The Uniswap plugin predates this event; its live payout-quote integration here is
new. Earlier Aivy work also used HTS pools and scheduling. The detailed
[continuity disclosure](#prior-work-boundary-continuity-track) identifies reuse,
event work and the Agent Kit contribution. [AI assistance is disclosed](docs/AI-ASSISTANCE.md).

## Verify in one minute

![Policies: every cover issued, with its ledger proofs](docs/media/04-policies.png)

*Every policy the demo has issued, each with its schedule, its terms on HCS and
its transfers — all linking out to HashScan.*

| Judge action | Evidence / scope |
| --- | --- |
| Open **How it works → Release** | Recorded **4 HBAR mainnet** transfer, with receipt. Controlled signatures, not a real earthquake claim. |
| Open a policy → **Agent guardrails & proof** | Runtime limits plus separate mainnet controls: [1 HBAR transferred](https://hashscan.io/mainnet/schedule/0.0.10843723), [5 HBAR blocked](https://hashscan.io/mainnet/schedule/0.0.10843725) without the agent signature. |
| Open **Payout in ETH? → Uniswap** | Live mainnet quote; switch Base/Unichain and inspect route/quote ID. [Saved evidence](docs/evidence/uniswap-quotes.json). |
| Open **Onchain / Verify** | Testnet NFT, transfers and paid oracle evidence. [x402 payment receipt](docs/evidence/x402-testnet.json); self-hosted facilitator. |
| Open **LP preview** | Proposed per-policy contribution, premium share and capital-at-risk outcomes. No deposit or LP NFT is issued; actual LP primitives use shared-pool fungible shares. |

## Security by architecture

**The deployed agent is deterministic: no LLM decides or signs a public policy.**
A future planner must stay outside the signing boundary. Security is enforced in
code and ledger keys, not by a system prompt.

```mermaid
flowchart LR
  Input["🌐 Untrusted<br/>input"] --> Validate["✅ Typed<br/>allowlist"]
  Validate --> Budget["⏱️ Durable budgets<br/>and issuance lock"]
  Budget --> Reserve["🏦 Balance check<br/>and reservation"]
  Reserve --> Sign["✍️ Exact transaction<br/>authority"]
  Sign --> Gate["🔐 Ledger<br/>signature gate"]

  classDef record fill:#1c2333,stroke:#64748b,stroke-width:1.5px,color:#e2e8f0
  classDef commit fill:#0d3b2e,stroke:#34d399,stroke-width:2px,color:#a7f3d0
  classDef oracle fill:#3a2c08,stroke:#f5b301,stroke-width:2px,color:#fde68a
  classDef ledger fill:#0b2f40,stroke:#38bdf8,stroke-width:2px,color:#bae6fd
  classDef result fill:#064e3b,stroke:#10b981,stroke-width:3px,color:#d1fae5
  classDef outside fill:#2b1830,stroke:#c084fc,stroke-width:1.5px,color:#f3e8ff
  class Input outside
  class Validate,Budget,Reserve commit
  class Sign ledger
  class Gate result
```

> Every layer narrows what the next one may do. By the last, the only thing the
> agent can authorize is the exact transfer already written in the terms.

| Before a signature | Protection |
| --- | --- |
| Public request | Testnet-only issuance, bounded JSON and fields; no caller-selected beneficiary or raw transaction. |
| Spending admission | Default **3 attempts/IP/hour · 100 attempts/24h · $20k modeled cover/24h**; survives restart. |
| Interrupted issuance | Idempotent request IDs, retained reservations, fail-closed locks and reconciliation. |
| Oracle / x402 / Uniswap | Exact terms/transfer verification; explicitly bounded payments; quote-only Uniswap authority. |
| Runtime | Private key/config files, loopback services behind TLS, patched minimal dependencies. |

**Evidence:** 41 offline tests passed locally and on the VPS in the September 6
review; UI build passed. A [live refusal check](docs/evidence/agent-guardrails.json)
confirmed an oversized request caused no ledger write. [Current runtime limits](https://quorum.aivylabs.xyz/api/guardrails).

<details>
<summary>All guardrails, implementation links and verification details</summary>

| Protection | Implemented behavior | Source / evidence |
| --- | --- | --- |
| Restricted public authority | Public issuance is testnet-only. Exact input fields, typed coordinates, $1–$50 modeled budget, 7–62 day duration and an 8 KB JSON object limit. A visitor cannot supply a beneficiary, key or arbitrary transaction to issuance. | [HTTP validation](src/http-safety.js), [API routes](src/server.js) |
| Durable spending admission | Default limits: **3 attempts/IP/hour, 100 attempts/rolling 24h, $20,000 modeled cover/rolling 24h**. Consumed before ledger actions; failed or uncertain admitted attempts remain charged. Configuration is validated. Atomic private journal survives restarts; invalid journal pauses writes. | [Budget guard](src/guards.js), [deployed refusal evidence](docs/evidence/agent-guardrails.json) |
| Trustworthy request identity | Forwarding headers are trusted only from a configured loopback proxy, using the final proxy-appended address. Budget records use HMAC-derived IP identifiers; public errors omit internal exception details. | [HTTP safety](src/http-safety.js), [guardrail tests](tests/guardrails.test.js) |
| Capacity and replay protection | Exclusive issuance lock, fresh pool balance and durable reservation before ledger writes. Reusing a request ID does not mint again. Interrupted writes retain reservations and public receipt checkpoints for reconciliation; abandoned locks fail closed. | [Issuance](src/policy/issue.js), [book](src/book.js), [lock](src/issuance-lock.js), [safety tests](tests/safety.test.js) |
| Policy-bound oracle authority | Verifies configured HCS topic, issuer signature, canonical terms hash, time window, network, asset, beneficiary and exact scheduled amount. Rejects extra transfer legs, allowances and unsupported fields. Caller input cannot lower the published trigger; queries are bounded, missing data is not a positive vote, duplicate identities do not become a quorum. | [Policy binding](src/policy/binding.js), [oracle implementation](src/oracle/), [security review](docs/AGENT-SECURITY.md) |
| Ledger-enforced signature gate | The pool requires **agent AND 2-of-3 oracle keys**. Oracle keys alone cannot spend. Signature evidence and observed execution are displayed separately. | [1 HBAR executed control](https://hashscan.io/mainnet/schedule/0.0.10843723), [5 HBAR blocked control](https://hashscan.io/mainnet/schedule/0.0.10843725) |
| Bounded x402 payment authority | Client checks explicitly authorized resource, network, recipient, asset, fee payer and maximum amount before signing; paid redirects and automatic new payments after uncertain responses are refused. Facilitator validates exact payment bodies, rejects extra debits/approvals and excessive fees, and requires a consensus receipt. | [Payment policy](src/x402/payment-policy.js), [facilitator](src/x402/facilitator.js), [payment tests](tests/payments.test.js) |
| Uniswap least privilege | Server selects only a bounded, allowlisted quote operation. API key remains server-side; no EVM private key, approval or broadcast is needed. | [Conversion tests](tests/cross-asset.test.js), [live quote evidence](docs/evidence/uniswap-quotes.json) |
| Runtime and secret isolation | Project listeners bind to loopback behind TLS nginx; environment/registry files use 0600 and artifact directory 0700. Project-specific Node 22 runtime and patched protobuf, WebSocket and gRPC dependencies. Minimal runtime installation omits unrelated automatic peers. | [Operational review and install instructions](docs/AGENT-SECURITY.md#operational-review), [lockfile](package-lock.json) |
| Visible verification | Open a policy → **Agent guardrails & proof** for current limits/usage and recorded authorization controls. Read-only endpoint exposes configuration without keys or IP identifiers. | [Live guardrails](https://quorum.aivylabs.xyz/api/guardrails), [UI implementation](ui/src/app/AgentGuardrails.tsx) |

**Verification recorded September 6, 2026:** 41 offline tests passed locally and
in the isolated VPS runtime, including malformed requests, forged IP headers,
quota persistence/corruption, concurrent issuance, payment substitution, uncertain
payment retry, term binding and duplicate votes. The UI production build passed.
The documented minimal production dependency tree reported zero known advisory
vulnerabilities at that check; this is not proof of vulnerability-free software.

The [deployed guardrail snapshot](docs/evidence/agent-guardrails.json) records an
oversized request refused before reservation or ledger work, with no request
record and unchanged budget. Snapshot usage is historical; the live endpoint
shows current usage. The security review did not create a policy or send a payment.

</details>

### Trust boundary

This is a prototype with hot keys under one VPS/administrative trust domain.
Separate keys and catalogue sources do not mean independent oracle operators.
Agent plus oracle quorum can authorize spending; the ledger key does not encode
all underwriting rules. Capital reservations are off-ledger and assume one
shared authoritative book and lock. External spending can invalidate capacity.

Real customer value requires independent key administration, managed/HSM signing
with transaction policies, authenticated customer/funding actions, perimeter
limits and alerting, recovery/backups, and transactional storage before scaling
across hosts. The x402 facilitator has no production fee-sponsorship abuse budget
or automatic refund system. **No independent security audit or production
readiness is claimed.** See the [full threat boundaries](docs/AGENT-SECURITY.md)
for the architecture rationale and remaining work.

## Design: understand first, inspect deeper

<table>
<tr>
<td width="50%"><img src="docs/media/01-atlas.png" alt="The atlas: every recorded shallow M6+ earthquake since 1970"></td>
<td width="50%"><img src="docs/media/03-story.png" alt="How it works: a six-scene walk through one recorded mainnet settlement"></td>
</tr>
<tr>
<td><b>The atlas.</b> Nothing here is drawn. The fault lines emerge from plotting
6,311 real shallow M6+ events, so the map is the evidence rather than a picture of it.</td>
<td><b>How it works.</b> Six scenes over one real mainnet settlement — choose,
commit, confirm, release, verify, protect — labelled as a recording, not live.</td>
</tr>
</table>

**Cover → Policies → How it works.** Three destinations, with technical evidence
one disclosure away.

| Visual | What it teaches |
| --- | --- |
| **World map + geographic NFTs** | Where cover applies; worldwide search and Mexico/California/Tokyo demos. |
| **Interactive premium history** | Premium variation for a fixed **$800 modeled payout**; click/drag/keyboard year selection and red/green annual change. |
| **LP contribution + two outcomes** | Premium share and principal at risk, explicitly labeled as a preview. |
| **Signatures → transfer → receipt** | Who signed, why execution happened or was blocked, and where to verify it. |
| **Responsive disclosures** | Minimal main copy, mobile stacking, keyboard focus and reduced motion; 320px through desktop reviewed. |

<details>
<summary>All design improvements and browser verification</summary>

| Improvement | What the visitor sees / why it matters |
| --- | --- |
| Global discovery | Debounced Photon/OpenStreetMap city and municipality search, keyboard selection, coordinate entry, map pinning, zoom/pan, and Mexico, California and Tokyo demos. Unaccented “Medellin” was verified. Search coverage depends on the upstream catalogue. |
| Geographic NFT identity | Aivy Quorum branding, local map, approximate 100 km protected area, terms, payout and network replace abstract artwork. Cover NFTs and proposed LP receipts remain visually distinct. |
| Understandable pricing history | Premium-over-time chart holds the modeled payout at **$800**, with the selected year and red/green annual variation. Click, tap or drag the chart—or use the keyboard/timeline—to choose a year. Historical exploration cannot change issued terms; returning to Cover restores the current M6+ quote. |
| Visual funding preview | Contribution slider, premium share and two claim outcomes show how capital might participate. Annual premium rate is gross, before claims/costs; contributed principal can be used for a payout. Formula and assumptions expand on demand. Preview/unminted labels remain visible. |
| A clearer six-scene story | Geographic terms → capital commitment → named signatures → transfer animation → NFT/receipts → blocked authorization control. Direct step links and previous/next controls keep the recorded mainnet demonstration navigable. |
| Explicit signature evidence | Old circular diagrams were replaced with **agent key AND oracle threshold → observed result**. “3 signed · 2 required” avoids ambiguous counts. Missing agent signature explains the blocked control; unknown ledger status remains unverified. |
| Quiet blockchain visibility | Optional Onchain/Verify panel and contextual receipt links expose NFT mint/delivery, transfers, agent/oracle actions and x402 evidence. Testnet, recorded mainnet, live API quotes and proposed funding are labeled separately. Unknown or invalid policies do not borrow another policy's receipts. |
| Optional Uniswap detail | “Payout in ETH? · Uniswap” expands to network, quote ID, timestamp/expiry, refresh, estimated gas and route evidence. A real quote is visible without implying redemption or a completed swap. |
| Recovery and navigation | Saved request IDs, interrupted-request review, honest loading/refusal/offline states and retry links. Location persists on refresh, gallery filters survive detail round trips, invalid routes offer recovery, and “Created here” means this browser—not wallet ownership. |
| Responsive and accessible controls | Mobile layouts stack; story navigation remains accessible; maps/charts have text descriptions, controls support keyboard use, focus is visible for keyboard interaction, and reduced-motion preferences are respected. Recent reviews covered 320 px mobile through desktop without horizontal overflow in the checked flows. |

The [implementation audit](AUDIT-IMPLEMENTATION.md) records the delivered changes
and checks; the [recording-readiness review](docs/FINAL-UX-REVIEW.md) covers the
end-to-end demo. The latest visual review checked the active Cover, Policies,
NFT/LP, historical chart and story illustration paths. Legacy ring components in
unrouted source files are not used by the active app. These are documented
browser checks, not a claim of exhaustive device or accessibility certification.

</details>

## Run locally

Use Node 22 or newer.

```sh
npm ci
# Configure .env from .env.example. Provisioning spends testnet assets:
npm run provision
npm run serve
# In another terminal:
cd ui
npm ci
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to the local API on port 8791.
The API binds to localhost by default and refuses public mainnet issuance.
For hosting, serve the UI with an SPA fallback and proxy `/api` to the backend,
or build with `VITE_AGENT_URL` pointing to its HTTPS origin. Set `HOST` for the
intended interface and `TRUST_PROXY=1` only behind a trusted reverse proxy.

<details>
<summary>Pricing, recovery and reproduction checks</summary>

## Pricing and capacity

![The quote panel: Armenia, Quindío priced at four dollars for eight hundred and four dollars of cover](docs/media/02-quote.png)

*Armenia, Quindío: $4 buys $804 of 30-day cover. The premium is not a constant —
it comes from the USGS catalogue for that exact point, and the source query is one
click away under "Coverage & pricing details".*

A first-order Poisson model estimates shallow M6+ frequency over a 300 km
reference region, scales to the fixed 100 km trigger circle, and adds uncertainty
loading. It is reproducible, not actuarial-grade. A location without qualifying
historical data is declined; no record does not establish zero risk.

The payout requires M6+, distance ≤100 km, depth ≤70 km, and an event inside the
coverage window. Damage alone does not qualify. Terms last 7–62 days; late event
reporting or missing oracle service can prevent timely signatures.

The local issuance book reserves aggregate promised payouts before ledger writes,
under an exclusive filesystem lock. Issuance is refused when existing promises
plus the request exceed available capital. These are off-ledger reservations:
funds are not individually escrowed per schedule, and external spending can
invalidate capacity. Multiple instances must share the same book and lock;
independent disks are unsupported. Issuance admission limits are persisted in the
shared private journal; restarting the process does not reset them.

## Interrupted requests

The browser saves a random request identifier before creation. Policies checks
`GET /api/requests/:id`; completed requests resolve to the issued policy and
interrupted requests remain visible for review. Replaying an identifier never
creates another policy. Issuance checkpoints retain public ledger identifiers.

A failed issuance retains its capital reservation. A crashed process can leave
`.artifacts/issuance-<network>.lock`; subsequent issuance fails closed. An operator
must verify that the writer has stopped, inspect the reservation and its HCS,
NFT, premium and schedule receipts, and reconcile the book before removing the
lock or releasing capacity. Never blindly delete a reservation: the ledger write
may have succeeded even when its response was lost. Back up the book first.

## Verification

```sh
npm test                 # offline pricing, authorization, payment and issuance tests
npm --prefix ui run build
```

The reusable plugin has its own tests in the sibling repository:

```sh
cd ../hak-scheduled-settlement
npm test
npm run typecheck
npm run build
```

`d1`, `d2`, `d3`, and `verify-quorum.js` are controlled HBAR ledger demonstrations,
not offline tests. They spend network assets and update `.artifacts` and
`LINKS.md`. They are separate from the current app's token issuance flow; d3
submits controlled signatures rather than verifying a real earthquake. Run in an
isolated checkout with separate demo accounts if reproducing the historical run.
The UI's frozen mainnet record is not replaced automatically.

</details>

## Prior work boundary (CONTINUITY track)

Earlier Aivy infrastructure and the Uniswap plugin are reused; the conditional
settlement plugin and this earthquake application are event work.

<details>
<summary>Full prior-work disclosure and upstream contribution</summary>

**Everything in this repository was written during ETHOnline 2026 (from
2026-09-04).** The repo has no pre-event commits.

What existed before the event, and does **not** count as new work:

- **[aivy-studio](https://github.com/jmgomezl/aivy-studio)** — the multi-agent
  orchestration canvas this project is built to run on. Existing HCS-10 transport,
  HTS escrow, workflow schema, canvas rendering.
- **[jmgomezl/aivy](https://github.com/jmgomezl/aivy)** — earlier APEX-hackathon app.
- **hak-saucerswap-plugin, hak-pyth-plugin** — endorsed third-party plugins in the
  Hedera Agent Kit docs.
- **hak-uniswap-plugin** — Uniswap Trading API plugin with allowance handling and a
  Ledger threshold gate, proven on Sepolia. Reused here for live USDC-to-ETH
  conversion quotes on Base and Unichain. The UI does not bridge or execute swaps.
- **Aivy Settlement Layer (ETHGlobal Lisbon, July 2026)** — a prior continuity
  build on aivy-studio that also used HTS pools and Scheduled Transactions. The
  overlap is the *substrate*; what is new here is stated below.

What is **new**, built during this event:

1. **Signature-gated conditional settlement** — payout as a pre-signed Scheduled
   Transaction whose trigger is oracle-quorum signature accumulation, with the
   nested `and(agent, k-of-n)` key that enforces the signature restriction. Extracted as
   [hak-scheduled-settlement](https://github.com/jmgomezl/hak-scheduled-settlement),
   a Hedera Agent Kit plugin this repo consumes, rather than left inside the app.
   Building it surfaced a gap in the kit itself — account creation cannot express
   a multi-signature key — filed as
   [hedera-agent-kit-js#1087](https://github.com/hashgraph/hedera-agent-kit-js/issues/1087)
   and fixed in the open PR
   [#1088](https://github.com/hashgraph/hedera-agent-kit-js/pull/1088).
2. **A hazard-priced underwriting agent** — premiums derived live from the USGS
   catalogue for any lat/lon on earth, with published inputs.
3. **An issuance capacity guard** reserving aggregate exposure against available capital in the shared book. External spending can invalidate this off-ledger reservation.
4. **Atomic premium settlement with an open broker channel** — buyer, pool and an
   arbitrary per-sale broker settled in one multi-party transaction.
5. **x402-gated oracle services** — the oracle agents are the paid service, not
   just consumers of one.

</details>

<details>
<summary>Repository map</summary>

## Layout

- `src/policy/`: pricing-to-issuance flow, HCS terms, NFT and scheduled transfer.
- `src/oracle/`: catalogue adapters, event checks and policy-bound signing.
- `src/x402/`: exact payment verification, settlement and client.
- `src/book.js`, `src/issuance-lock.js`: durable reservations and serialization.
- `src/guards.js`, `src/http-safety.js`: durable admission budgets and public input validation.
- `docs/AGENT-SECURITY.md`, `docs/evidence/`: trust boundaries and verifiable snapshots.
- `src/ledger.js`: shared policy status from actual signer identities.
- `ui/`: map, quotes, policies and recorded demonstration.
- `deploy/`: oracle deployment configuration.
- `research/`: model rationale and historical integration notes.
- `LINKS.md`: historical ledger artifacts.


</details>

MIT.
