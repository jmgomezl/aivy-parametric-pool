# Video kit checks · September 8, 2026

| Check | Result |
| --- | --- |
| Export | H.264, 1920 × 1080, 30 fps, 6,750 frames, exactly 3:45. Silent visual edit; human narration pending. |
| Editing | Captured interactions play at 1×. Confirmation waits are cut and some final frames held. Graphics and representative full-resolution frames were visually inspected. |
| Rehearsal page | Tested at 1600, 1024, 768, 390 and 320 px. Playback, chapter seeking, synchronized script, full script table and no horizontal overflow passed. No page errors or missing assets. |
| Voice recording | Synthetic Chrome microphone input used only to test local recording and a non-empty audio download. No synthetic audio appears in the visual edit or kit. |
| Audio export | Tested with a temporary tone and a duration-less MediaRecorder-style WebM. The merge produced a 3:45 H.264/AAC file without changing video speed. QA audio/export remain outside this repository. |
| Evidence | Eight new Hedera receipts independently confirmed; three oracle checks returned no match. Sepolia swap receipt has status 1. New Axelar destination delivery was pending at capture and is labeled accordingly. |
| Privacy | Browser/session recovery files and credentials remain outside the kit. Public evidence contains transaction IDs and public account addresses only. |

Recheck the rehearsal page with `node docs/demo-video/production/check-studio.mjs`.
Set `QUORUM_STUDIO_URL` for the deployed page, or run `production/serve.mjs`
first for the default local URL. The browser check requires Playwright and Chrome.

The remaining editorial check is the complete **human-narrated** export:
listen for natural pacing, align subtitle cues to the actual take and watch it
from start to finish before submission.
