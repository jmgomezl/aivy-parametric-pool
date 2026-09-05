# Settlement timeline

The demo surface for the parametric pool: one real Hedera **mainnet** policy walked
from quote to payout, one beat at a time, every ledger id a working HashScan link.
It opens on the **atlas**: every shallow M6+ earthquake since 1970 drawn as the
hazard field the model actually integrates, and a cursor that prices 30 days of
cover anywhere on Earth with the agent's own arithmetic.

```bash
npm install
npm run dev        # http://localhost:5173
```

Designed for **1920 × 1080** and scaled to whatever window is filming it. Steppable
with the keyboard, no timers:

| key | action |
|---|---|
| `→` `space` `enter` | next sub-step, then next beat |
| `←` `backspace` | back |
| `0` | the atlas |
| `1` … `8` | jump to a beat |
| `home` / `end` | first / last |

The position lives in the URL hash (`#6.2` = beat 6, sub-step 2, `#0` = atlas),
so a reload mid-recording lands on the same frame.

On the atlas:

- **move** the mouse to price the point under it; **click** to pin; pick a city chip
- **scroll** to zoom (up to 12×), **drag** to pan, **double-click** to reset
- **play** or scrub the year slider: the field fills in as the record accumulates,
  and every number is the model re-run with only the record available that year
- **cover** and **window** sliders re-price on the fly; the window stops at 62 days,
  the ledger's ceiling for a scheduled payout
- **trigger** chips switch the magnitude floor between M6, M6.5 and M7
- **+ compare** keeps up to four places side by side at the same cover and window
- the pinned point is in the URL (`#0@lat,lon`), so any view can be shared

The pinned point is recounted live at USGS and the two numbers are shown side by
side; HBAR is converted at the mirror node's current exchange rate.

## Where the numbers come from

`src/data/mainnet.json` is a frozen, key-free snapshot of the run, produced by
`npm run snapshot` from `../.artifacts/mainnet.json` plus the public mirror node.
Nothing on screen is typed in by hand; nothing secret leaves the artifact. While
the page is open it re-reads the parts that can still change (balances, schedule
state, token supply, NFT owner, the USGS catalogue count) and says so next to the
value: *confirmed by mirror node*, *mirror node differs*, or *unavailable*.

`src/data/quakes.json` is the global catalogue behind the atlas (`npm run quakes`):
every shallow M6+ event since 1970 from the same USGS endpoint the agent queries,
6,311 rows of `[lon, lat, mag, depth, day]`. `src/lib/hazard.ts` is the agent's
model ported line for line, and reproduces its numbers (Armenia 12 events,
0.01544329 ℏ; Tokyo 103).

The two quorum proofs (`0.0.10843723` control, `0.0.10843725` adversarial) come
from `scripts/verify-quorum.js`, which prints but does not persist its schedule
ids; they are pinned in `scripts/snapshot.mjs`.

## Layout

```
scripts/snapshot.mjs     artifact + mirror node -> src/data/mainnet.json
scripts/quakes.mjs       USGS ComCat -> src/data/quakes.json (the atlas catalogue)
src/data/mainnet.json    the public record of the run (committed)
src/lib/hazard.ts        the agent's hazard model, in the browser
src/beats/00-atlas.tsx   the atlas: hover, pin, zoom, scrub, compare
src/beats/atlas/         projection + zoom view, the additive heat canvas, land outlines
src/beats/               one file per story beat; 05-waiting exports the pool – lock – buyer scene 06 reuses
src/components/viz.tsx   the visual language: nodes, flows, the two-ring lock, the capital tank, waves
src/components/Scene.tsx the frame every beat uses: title, visual, big numbers, HashScan strip
src/components/ui.tsx    HashScan ids and state pills
src/lib/                 formatting, HashScan links, mirror-node and USGS reads
src/App.tsx              frame, stepper, keyboard, hash routing, 1920×1080 scaling
```

Vite + React + TypeScript + Tailwind v4. Static build (`npm run build`), no server.
