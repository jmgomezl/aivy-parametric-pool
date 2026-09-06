# Aivy Quorum UI

A compact earthquake-cover demo: **Cover · Policies · How it works**.

```sh
npm ci
npm run dev       # port 5173; run npm run serve in the parent project
npm run build
```

Vite proxies `/api` to localhost:8791. A deployed static host needs an SPA
fallback to `index.html` and an API reverse proxy, or `VITE_AGENT_URL` at build.

## Routes

| Route | Purpose |
|---|---|
| `/` | Search or pin a place; optional historical exploration |
| `/?at=4.53,-75.68` | Share a selected location |
| `/policies` | Recent, browser-created and global policy views; request recovery |
| `/policy/:serial` | Shared verified status, oracle confirmations and receipts |
| `/story#1` … `/story#6` | Controlled mainnet recording; keyboard or button navigation |

The demo creates funded testnet beneficiary accounts. `aUSDd` is unbacked and has
no cash value. Browser-created labels are not wallet ownership. The story's
mainnet recording is separate from live testnet state.

Search includes the example locations and national capitals; any other location
can be selected on the map. Drag to pan; use +/− or Ctrl/Command-wheel to zoom.
The selected circle is the fixed 100 km trigger area. Historical magnitude/year
controls are estimates only and never alter purchasable M6+ terms.

Shared health, pool and policy data refresh every 10 seconds while visible.
Unavailable ledger information stays unknown. A timestamp identifies the last
verified reading. Quotes have distinct loading, refusal, offline and error states.
Issuance uses one saved request identifier, retains interrupted requests, and
shows success only after the backend confirms the policy.

The quote and policy layouts stack on mobile. Story controls remain reachable
at the bottom. Sliders, city search, marker activation and primary navigation
support keyboard use. Reduced-motion preferences are respected.

Frozen earthquake/capital/mainnet data lives in `src/data/`. Refresh scripts are
`npm run quakes`, `npm run capitals`, and `npm run snapshot`; snapshots are
historical evidence, not live feeds. `src/beats/` retains supporting visual
components from the earlier filmed version; the active story is `src/story/Story.tsx`.

## NFT position visuals

Policies render as generative SVG-backed position cards with location, trigger,
asset, serial and verified state. The detail page switches between the actual
cover receipt and a gold **LP preview**. The preview contribution slider updates
its proposed amount and percentage of that policy's target. Deep-link with
`/policy/:serial?position=lp`.

This is a UI concept, not a new LP contract or mint. Existing LP ownership remains
fungible ARPS shares in the shared pool. No deposit endpoint is called by the
preview, and existing NFT metadata/artwork in external wallets is unchanged.

## Blockchain evidence

The collapsed Onchain strip shows the selected/latest policy's signature state.
Its expandable panel separates live policy records, the frozen mainnet recording,
and confirmed x402 payment receipts. Every explorer link carries its network.
The app distinguishes offchain quotes, manual oracle checks, and unminted LP previews.
New policies retain NFT mint, delivery, and freeze transaction IDs; older policies
link to the NFT itself. Oracle signatures are schedule approvals, not token allowances.

The deployed self-hosted x402 facilitator settles on testnet. Blocky's public
`/supported` endpoint advertised only `hedera:mainnet` on September 6, 2026;
it is not the deployed payment path. No mainnet x402 payment is claimed.
`/api/activity` reads a bounded, network-specific receipt journal written only
following successful payment consensus. Historical payments are not inferred.

The NFT and LP-preview cards show a bundled Natural Earth geographic overview,
centered on each policy. A local azimuthal equidistant projection preserves the
coverage radius from the pin; the map includes a scale bar and country borders.
These are generalized geographic outlines, not street-level maps. This changes
the app presentation only, not the NFT's onchain metadata or coverage terms.

The default Global demos gallery features real testnet policies for Mexico City,
San Francisco (California), and Tokyo. Their public IDs and receipts are tracked
in `src/data/global-demos.json`; the cards still read current policy and signature
state from the API. Existing policies remain in Recent, Created here, and All policies.

Worldwide place search uses Photon/OpenStreetMap through `/api/places`. It searches
cities, towns, villages, localities, districts and counties rather than only the
bundled capitals. Results include state and country; accented and unaccented
queries share a bounded server cache. Requests are debounced, canceled when stale,
and limited upstream. The public Photon service has no availability guarantee;
local suggestions (including Medellín) and direct coordinates remain available.
Coverage follows OpenStreetMap, not an exhaustive guarantee of every municipality.

The historical premium chart holds the modeled payout fixed at $800 USD. Its
values show the premium required for that payout each year. The quote panel
shows the inverse: the modeled payout for the selected premium budget. These
USD model values do not give the testnet demo token a cash value.

## Funding and judge journey

The home page links to **Fund a policy** (`/policies?view=fund`) and **Watch a
payout** (`/story#1`). Funding cards open `/policy/:serial?position=lp`. The slider
allocates hypothetical capital and premium income pro rata. Annual premium rate
is pool premium / policy payout × 365 / term days, without compounding. The
current purchase path sends 100% to the pool without a broker and 85% with one.
This is gross premium income, not a net APR: claims, costs and idle capital reduce
returns. The adverse scenario uses all contributed capital for the payout.
No per-policy deposit, LP NFT, redemption or income distribution is implemented.

A real x402 testnet query is recorded in `../docs/evidence/x402-testnet.json`;
the VPS journal exposes the settled payment under `/api/activity`. It is a
historical catalogue check with no qualifying event and no schedule signature.

## Guided story redesign

`/story#1` through `#6` now use distinct geographic, capital, signature, transfer,
NFT-receipt and authorization-comparison scenes. Step meanings and deep links
are preserved. The step navigator remains visible on mobile, next actions name
the upcoming scene, and keyboard arrows work outside interactive controls.
Reduced-motion preferences disable scene and transfer animation. All narrative
values come from the frozen mainnet record; the recording uses SGC as its third
key label while current deployed services use GEOFON. Scope details distinguish
live testnet creation, recorded mainnet execution and proposed policy LPs.
