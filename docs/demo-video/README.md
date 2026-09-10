# Aivy Quorum · demo video kit

**A 3:59 visual edit, 1920 × 1080 at 30 fps, with a timed English narration script.**
It opens with the small-loss problem and verified Colombia/Venezuela earthquake
records, then shows the product, onchain evidence, the technology choices and the
prior-work boundary.

**Updated September 10, after the Mirror Node review.** At **2:57**, enter from
[Aivy Labs](https://aivylabs.xyz/), review the saved monthly budget, type
“Am I covered?” and open the same real policy in Quorum. This 24-second sequence
shows existing Medellín policy #34; it does not create another purchase.
At **3:21**, ask Quorum about that policy. At **3:29**, inspect an actual Mirror
Node response excerpt. Both companions are read only.

The new 14-chapter script totals **444 words**, with a warmer everyday benefit:
less to remember, and an answer you can verify. The earlier genuine transaction
footage remains, clearly separate from this read-only refresh.

**The visual edit is complete; human narration has not been added.** ETHOnline
requires a human voice. Do not submit the silent MP4 as the final video.

- [Open the video + synchronized script](https://quorum.aivylabs.xyz/demo-video/)
- [Download the visual edit](aivy-quorum-visual-cut.mp4)
- [Just the 24-second Aivy → Quorum interaction](aivy-monthly-cover.mp4)
- [Just the new Aivy companion moment](aivy-cover-companion.mp4)
- [Read the script](SCRIPT.md) · [plain text](SCRIPT.txt)
- [Recording evidence](EVIDENCE.md) · [sources and image credits](SOURCES.md) · [Current export manifest](refresh-manifest.json)
- [Monthly-agent architecture](../COVER-AGENT.md) · [Verified first-purchase evidence](cover-agent-evidence.json)
- [Read-only companion architecture](../COMPANION.md) · [New captured answers](aivy-refresh-evidence.json) · [Mirror response](mirror-refresh-evidence.json)

## Record your part

1. Open the rehearsal page on a computer. Read once with **Rehearse**.
2. Open **Record or preview your voice**, then **Record my voice**. A three-second
   countdown starts the video and local microphone recording together.
3. Read naturally. The next paragraph appears automatically. The video already
   removes network waits with cuts; don't rush or speed it up.
4. Download your audio take before closing the page. Send it to Codex for the
   final mix, or use the local merge script below. Audio is never uploaded by this page.

For a local rehearsal, run `node docs/demo-video/production/serve.mjs`, then open
`http://127.0.0.1:5180/`. This server supports video byte ranges for chapter seeking.

The script is an AI-assisted draft directed by the founder, with an emotional
hypothetical opening and natural phrasing. Adapt any wording that doesn't sound
like you. There is no synthesized voice or music standing in for narration.

## Export with your actual voice

Requires Python 3, FFmpeg and ffprobe:

```sh
python3 docs/demo-video/production/merge-narration.py /absolute/path/to/your-take.webm \
  --output /absolute/path/to/aivy-quorum-narrated.mp4
```

The tool normalizes speech, preserves the original video speed and pads silence
to 3:59. It refuses to overwrite an existing file or silently trim a take extending
past the edit. `--offset 0.3` delays speech; a negative offset trims the beginning.
Watch the complete narrated export and align `narration.srt` to your actual voice.
The current VTT/SRT files are **draft pacing cues**, not speech-aligned subtitles.

## Rebuild without spending test tokens

`timeline.json` owns the narration and chapter times. `edit.json` owns the
shots and source clips; rendering consumes it directly. `production/frames.html` owns typography and visual diagrams. Trimmed real
footage, capture times, sources and font licenses are bundled in `assets/`.

```sh
python3 docs/demo-video/production/script-files.py
node docs/demo-video/production/render.mjs
```

The renderer needs Playwright with Chrome and FFmpeg. If Playwright is supplied
outside the project, set `PLAYWRIGHT_MODULE` to its absolute module path.
Rendering the bundled footage makes **no ledger writes**. Runtime frames and
intermediates go to `/tmp/quorum-video/render` by default, outside Git.

`production/capture.mjs` documents how the original public-site footage was made.
**Do not rerun financial captures to rebuild the video.** Writes require an
explicit `--execute`, an existing testnet session provided by file path, and a
narrow endpoint allowlist. Request and browser recovery files remain private in
the recording work directory; they are not part of this kit.

## Editorial decisions

- Short problem opening; actual app interaction remains central.
- Quiet network labels distinguish testnet activity from the controlled mainnet recording.
- “Parametric trigger” is explained as a pre-agreed condition, not pitched as a bet.
- Public app = manually requested deterministic workflow, not autonomous AI claim approval.
- The Aivy purchase worker is automatic only within a saved, three-period
  testnet mandate. It does not monitor earthquakes or authorize claims.
- The companion interprets questions into allowed topics. Server code supplies
  facts and receipt links; it cannot sign or execute a transaction.
- New source bridge and confirmed swap are distinct operations; swap uses previously
  bridged starter inventory. Cross-chain delivery is not presented as instantaneous.
- Shared-pool ARPS and actual Uniswap V3 position NFTs are explicitly separate.
- Per-policy investment, ARPS distributions/exits and commercial fees are not presented as live.
- Existing Aivy infrastructure and prior Uniswap/Axelar plugins are credited; new work is identified.

No security control was bypassed to obtain this footage.

`production/capture-cover-agent.mjs` records one explicit testnet activation;
`capture-cover-agent-state.mjs` can refresh the existing-state footage with all
writes blocked. Do not repeat activation to improve the edit. The latter capture
was used after fixing a stale account-setup warning; it shows the same policy #34.

`production/capture-companion.mjs` records an anonymous question against the live
site. It blocks all API writes except the read-only chat endpoint, requires a
real AI-classified answer and saves the public response. The 10-second source
clip plays at 1×; no answer was fabricated or substituted.

## Refresh only the current read-only interactions

```sh
node docs/demo-video/production/refresh-interactions.mjs map
node docs/demo-video/production/refresh-interactions.mjs aivy
```

The Aivy capture requires an existing session via `AIVY_MEDIA_SESSION_FILE`.
Private session files remain outside the repository. The only allowed API POSTs
are the two read-only companion endpoints; all financial and mandate writes are
blocked. [Map capture](map-refresh-evidence.json) · [Aivy/Quorum capture](aivy-refresh-evidence.json).
The original financial-action scripts above remain for provenance, not for
rerunning transactions just to refresh this edit.
