# Video kit checks · September 9, 2026 (Colombia)

| Check | Result |
| --- | --- |
| Export | H.264, 1920 × 1080, 30 fps, 7,170 frames, exactly 3:59. Silent visual edit; human narration pending. |
| Editing | Captured interactions play at 1×. Confirmation waits are cut and some final frames held. Graphics and representative full-resolution frames were visually inspected. |
| Rehearsal page | Tested at 1600, 1024, 768, 390 and 320 px. Playback, chapter seeking, synchronized script, full script table and no horizontal overflow passed. No page errors or missing assets. |
| Voice recording | Synthetic Chrome microphone input used only to test local recording and a non-empty audio download. No synthetic audio appears in the visual edit or kit. |
| Audio export | Rechecked with a temporary WebM test tone: the merge produced a 3:59 H.264/AAC file without changing video speed. Duration-less MediaRecorder input was also covered in the original kit checks. QA audio/export remain outside this repository. |
| Evidence | Eight new Hedera receipts independently confirmed; three oracle checks returned no match. Sepolia swap receipt has status 1. New Axelar destination delivery was pending at capture and is labeled accordingly. |
| Privacy | Browser/session recovery files and credentials remain outside the kit. Public evidence contains transaction IDs and public account addresses only. |
| Aivy addition | 14-second genuine canvas interaction at 3:21. One real testnet policy (#34), four independently confirmed premium/NFT receipts, published HCS terms and an agent-signed scheduled payout. Future purchases remain planned. |
| Renewal controls | Explicit consent, no duplicate on manual check, pause persisted through reload, resume created no duplicate, and the real mandate survived a VPS worker restart. Same first policy and next date retained. |
| Current canvas | Frontend build plus fixture checks at 1440, 1024, 768, 390 and 320 px passed, including clearance of transient setup warnings and no legacy wallet bundle. Live checks at 1440, 390 and 320 px passed. |
| Backend | All 134 Quorum tests passed. Twelve dedicated tests cover calendar boundaries, limits, duplicate requests, payer changes, pause and recovery. Future months use a fake clock, not fabricated onchain evidence. |

Recheck the rehearsal page with `node docs/demo-video/production/check-studio.mjs`.
Set `QUORUM_STUDIO_URL` for the deployed page, or run `production/serve.mjs`
first for the default local URL. The browser check requires Playwright and Chrome.

The remaining editorial check is the complete **human-narrated** export:
listen for natural pacing, align subtitle cues to the actual take and watch it
from start to finish before submission.
