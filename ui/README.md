# Aivy Parametric Pool — the app

The product opens on the atlas. Pin a place, the agent quotes it; press once, the
agent writes the policy to Hedera while you watch; the policy is a page you can
reload and share. The nine-beat story of the mainnet run is still here, as a mode.

```bash
npm install
npm run dev          # http://localhost:5173
# in the repo root, for live quotes and issuing (testnet):
npm run serve        # the agent API on :8791
```

## Routes

| path | what |
|---|---|
| `/` | the atlas. `/?at=lat,lon` opens with a place pinned and the quote panel up |
| `/policy/:serial` | one policy: its live ring, ledger ids, and "can the oracles steal this?" |
| `/policies` | every policy the agent has written on this network; the ones bought from this browser are marked |
| `/story` | the nine beats, unchanged, in the 1920 × 1080 frame they are filmed in (`/story#3.1` = beat 3, sub-step 1) |

Pool vitals — capital, committed exposure, headroom, live policies — sit in the
header on every page, read from the agent every 30 s and again after each write.

## The atlas

- **move** the mouse to see the record under it; **click** to pin and get a quote; pick a city chip
- **scroll** to zoom (up to 12×), **drag** to pan, **double-click** to reset
- **play** or scrub the year slider: the field fills in as the record accumulates. While a
  past year is selected the panel prices from the frozen catalogue as it stood then;
  scrub back to today for the agent's live quote
- **trigger** chips switch the magnitude floor between M6, M6.5 and M7
- **capitals** toggles the world's capitals; more appear as you zoom, and clicking one pins it
- green rings are live policies on the network; click one to open it

## The quote panel

Quoting is free, so it happens on every change of place, budget or window.
Issuing is not, so it happens only on the button. The agent's answer is shown in
its own words either way — *no record here*, *too small to write*, *no headroom*,
*rate limited* — and a refusal is styled as an answer, not an error.

When the agent is unreachable the panel falls back to the frozen catalogue and
says so; nothing is invented and nothing can be bought.

## Where the numbers come from

- **Live:** the agent API (`GET /api/quote`, `/api/pool`, `/api/policies`,
  `POST /api/policies`) and the Hedera mirror node for each policy's schedule state.
- **Frozen:** `src/data/quakes.json`, every shallow M6+ event since 1970 from USGS
  ComCat (`npm run quakes`); `src/data/capitals.json`, 202 national capitals from
  Natural Earth (`npm run capitals`); `src/data/mainnet.json`, the key-free record of
  the mainnet run (`npm run snapshot`).

Every ledger id links to HashScan on its own network: the story is mainnet, the
agent issues on testnet.

## Layout

```
src/App.tsx              the router: app by default, story as a mode
src/app/                 Chrome (nav + vitals), Home, AtlasMap, QuotePanel, PolicyPage,
                         PoliciesPage, OracleProof, History
src/story/Story.tsx      the 1920 × 1080 frame, keyboard stepping, beats 1–9
src/beats/               the nine beats and the atlas drawing modules (projection, heat, land)
src/components/          viz primitives (nodes, flows, lock, tank, waves), Scene, ids and pills
src/lib/                 agent client, router, live store, hazard model, mirror node, HashScan
scripts/                 snapshot.mjs · quakes.mjs · capitals.mjs
```

Vite + React + TypeScript + Tailwind v4. Static build (`npm run build`); the routes
are paths, so a static host needs a fallback to `index.html`.
