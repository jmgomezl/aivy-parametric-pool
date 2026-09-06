# Aivy UI

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
