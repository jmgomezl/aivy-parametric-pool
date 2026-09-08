# Large-screen map

The landing map now fits comfortably on large monitors. It previously expanded
with the entire screen width, magnifying labels and pushing the world below the
initial viewport.

![The full world map beside the introduction on a 1920 × 1080 display](../media/10-large-screen-map.png)

## What changed

| Before | Now |
| --- | --- |
| Introduction above an ever-wider map | From 1600 px, introduction beside a map inside a centered, bounded layout |
| Quote selection retained the full introduction above the map | Selected map beside the quote and its Explore data controls |
| Labels, dots and outlines grew with the map | Consistent screen-sized labels, markers and outlines; geographic coverage still scales accurately |
| Heat bitmap fixed at 2760 × 1058 | Canvas sized to its actual rendered area and pixel density, capped at 2× |

The heat layer and SVG share the same uniform fit, including mobile letterboxing.
Resizing redraws the heat field without resetting the selected place or history
year. Layouts below 1600 px retain their existing structure.

## Verification · September 8, 2026

- TypeScript and production build passed.
- Whole landing map and legend visible at **1600 × 900, 1920 × 1080,
  2560 × 1440, 3440 × 1440 and 3840 × 2160**.
- Retina rendering checked at 1728 × 1117 with 2× density; 390 px mobile at 3×
  density correctly uses the 2× rendering cap. Labels measure 12 CSS pixels.
- Tokyo selection, Medellín search, zoom, world reset and resize between desktop
  and mobile passed. The selected historical year and visible heat survive resize.
- History click, drag, keyboard, playback and magnitude controls passed at seven
  widths from 320 to 1920 px; the chart stays beside the quote on desktop.
- **54 responsive page views** across 320–1440 px had no horizontal overflow or
  uncaught browser errors. Desktop, ultrawide and phone screenshots were inspected.

These checks use read-only API requests; no demo accounts or ledger transactions
are created for layout testing.

Implementation: [layout](../../ui/src/styles.css),
[map](../../ui/src/app/AtlasMap.tsx), [heat](../../ui/src/beats/atlas/Heat.tsx).
