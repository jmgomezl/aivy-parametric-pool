# Aivy Quorum · Earthquake cover

Choose a place. Commit a fixed payout. Two oracle confirmations release it.

Aivy Quorum demonstrates parametric earthquake settlement using native Hedera services.
The agent pre-signs a Scheduled Transaction at issuance. The pool key requires
both the agent and two of three oracle keys. When the missing signatures arrive,
Hedera executes the scheduled transfer without a separate executor transaction.

**Public UI: funded testnet demo.** No user payment is required. Beneficiary
accounts are managed by the service. `aUSDd` is an unbacked demo token with no cash
value; displayed dollars are model outputs. This is a prototype, not live cover.

**Event checks are manual.** The oracle services read catalogues when requested.
Automatic ledger execution does not imply automatic earthquake monitoring.
The story replays controlled signatures from a recorded mainnet transfer.

See [the submission walkthrough](docs/SUBMISSION.md) and [AI assistance disclosure](docs/AI-ASSISTANCE.md).

## Run locally

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

## The experience

- **Cover:** search or pin a place, adjust the budget, create demo cover.
- **Policies:** recent commitments, policies created in this browser, and saved
  interrupted requests. Browser labels do not represent wallet ownership.
- **How it works:** six recorded steps: choose, commit, first confirmation,
  release, receipt, and the blocked oracle-only transfer.

Historical exploration is optional. Changing its year or magnitude never changes
issuable policy terms. Return to cover for a current M6+ quote.

## What is demonstrated

The nested key is `AND(agent, 2-of-3 oracle keys)`. The oracle quorum alone cannot
spend from the pool. The agent and quorum together still control it: this is a
specific authorization restriction, not protection from their collusion.

The oracle adapters use USGS, EMSC and GEOFON data. The demo operates those
services; source names do not mean those institutions operate our signing keys.
Separate processes and data sources do not establish independent operators.

Before signing, an oracle binds the configured HCS policy topic, recorded terms,
issuer signature, memo hash, network, expiry, asset, beneficiary and amount to
the actual scheduled transfer. Legacy recordings require manual verification.
The x402 facilitator accepts only the exact payment transfer and refuses extra
legs, facilitator debits, approvals, unsupported fields and excessive fees.

The policy NFT points to HCS terms. Premium transfers can include a broker split
in the same transaction. Cross-asset support returns an optional quote; it does
not bridge or execute an EVM payout.

## Pricing and capacity

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
independent disks are unsupported. The rate limits are process-local.

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

## Prior work boundary (CONTINUITY track)

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
   nested `and(agent, k-of-n)` key that makes it safe. Extracted as
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

## Layout

- `src/policy/`: pricing-to-issuance flow, HCS terms, NFT and scheduled transfer.
- `src/oracle/`: catalogue adapters, event checks and policy-bound signing.
- `src/x402/`: exact payment verification, settlement and client.
- `src/book.js`, `src/issuance-lock.js`: durable reservations and serialization.
- `src/ledger.js`: shared policy status from actual signer identities.
- `ui/`: map, quotes, policies and recorded demonstration.
- `deploy/`: oracle deployment configuration.
- `research/`: model rationale and historical integration notes.
- `LINKS.md`: historical ledger artifacts.

MIT.
