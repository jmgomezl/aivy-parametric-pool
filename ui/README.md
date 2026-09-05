# Settlement timeline

The demo surface for the parametric pool: one real Hedera **mainnet** policy walked
from quote to payout, one beat at a time, every ledger id a working HashScan link.

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
| `1` … `8` | jump to a beat |
| `home` / `end` | first / last |

The position lives in the URL hash (`#6.2` = beat 6, sub-step 2), so a reload
mid-recording lands on the same frame.

## Where the numbers come from

`src/data/mainnet.json` is a frozen, key-free snapshot of the run, produced by
`npm run snapshot` from `../.artifacts/mainnet.json` plus the public mirror node.
Nothing on screen is typed in by hand; nothing secret leaves the artifact. While
the page is open it re-reads the parts that can still change (balances, schedule
state, token supply, NFT owner, the USGS catalogue count) and says so next to the
value: *confirmed by mirror node*, *mirror node differs*, or *unavailable*.

The two quorum proofs (`0.0.10843723` control, `0.0.10843725` adversarial) come
from `scripts/verify-quorum.js`, which prints but does not persist its schedule
ids; they are pinned in `scripts/snapshot.mjs`.

## Layout

```
scripts/snapshot.mjs     artifact + mirror node -> src/data/mainnet.json
src/data/mainnet.json    the public record of the run (committed)
src/beats/               one file per beat; 05-waiting exports the pool – lock – buyer scene 06 reuses
src/components/viz.tsx   the visual language: nodes, flows, the two-ring lock, the capital tank, waves
src/components/Scene.tsx the frame every beat uses: title, visual, big numbers, HashScan strip
src/components/ui.tsx    HashScan ids and state pills
src/lib/                 formatting, HashScan links, mirror-node and USGS reads
src/App.tsx              frame, stepper, keyboard, hash routing, 1920×1080 scaling
```

Vite + React + TypeScript + Tailwind v4. Static build (`npm run build`), no server.
