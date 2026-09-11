# Video kit checks · September 11, 2026

| Check | Result |
| --- | --- |
| Export | H.264, 1920 × 1080, 30 fps, 7,170 frames, exactly 3:59. Silent visual edit; human narration pending. |
| Editing | Captured interactions play at 1×. Confirmation waits are cut and some final frames held. Graphics and representative full-resolution frames were visually inspected. |
| Rehearsal page | Tested at 1600, 1024, 768, 390 and 320 px. Playback, revised chapter seeking, the “Watch the Aivy moment” shortcut, synchronized script, full script table and no horizontal overflow passed. No page errors or missing assets. |
| Voice recording | Synthetic Chrome microphone input used only to test local recording and a non-empty audio download. No synthetic audio appears in the visual edit or kit. |
| Interrupted playback | Pausing while a preview is still loading cancels playback cleanly. Other playback failures show a retry message. |
| Audio export | Rechecked with a temporary WebM test tone: the merge produced a 3:59 H.264/AAC file without changing video speed. Duration-less MediaRecorder input was also covered in the original kit checks. QA audio/export remain outside this repository. |
| Original transaction evidence | Eight Hedera receipts independently confirmed; three oracle checks returned no match. Sepolia swap receipt has status 1. New Axelar destination delivery was pending at capture and is labeled accordingly. |
| Privacy | Browser/session recovery files and credentials remain outside the kit. Public evidence contains transaction IDs and public account addresses only. |
| Current Aivy journey | 24 seconds at 2:57: homepage → saved monthly budget → typed “Am I covered?” → existing policy #34 in Quorum. The actual AI-selected status answer agrees with the ledger. Financial and mandate writes were blocked. Future purchases remain planned. |
| Current Quorum companion | Eight seconds at 3:21: “Is this policy active?” on public policy #34. Actual AI-selected topic and server answer, with a ledger timestamp and receipt links. No page errors. |
| Mirror Node evidence | Six seconds at 3:29: selected fields from an actual GET response for the same schedule. One recorded signature, no execution. Clearly labeled response excerpt, not an explorer screenshot. |
| Current discovery UI | Fresh normal-speed capture of the map cursor, Medellín search and draggable premium history. No API writes. |
| Renewal controls | Explicit consent, no duplicate on manual check, pause persisted through reload, resume created no duplicate, and the real mandate survived a VPS worker restart. Same first policy and next date retained. |
| Current canvas | Frontend build plus fixture checks at 1440, 1024, 768, 390 and 320 px passed, including clearance of transient setup warnings and no legacy wallet bundle. Live checks at 1440, 390 and 320 px passed. |
| Backend | Latest backend review: all 161 Quorum tests passed, including the five Mirror Node regressions. Coverage includes account scope, schema attacks, network labels, unavailable ledger data, shared limits and renewal recovery. Future months use a fake clock, not fabricated onchain evidence. |

Recheck the rehearsal page with `node docs/demo-video/production/check-studio.mjs`.
Set `QUORUM_STUDIO_URL` for the deployed page, or run `production/serve.mjs`
first for the default local URL. The browser check requires Playwright and Chrome.

The remaining editorial check is the complete **human-narrated** export:
listen for natural pacing, align subtitle cues to the actual take and watch it
from start to finish before submission.

The refreshed narration has 448 words across 14 chapters. Full-resolution frames
from the history, canvas, both companion interactions, Mirror response and
prior-work disclosure were inspected. The complete export decodes successfully.
The original financial footage remains separately dated in `EVIDENCE.md`; this
refresh does not imply a second issuance, payment, deposit or swap.

## September 11 editorial refresh

- Approved transparent logo used in graphic mastheads, title and closing scenes; poster refreshed.
- Chapters 8 and 13 now name the published HAK Uniswap plugin and new quote-only / settlement tooling.
- All 14 chapter boundaries and all 38 shot durations match the previous edit.
- Original financial source clips and stills are byte-for-byte unchanged. No financial requests were made.
- Thirty graphics were captured through the browser at 1920 × 1080 with fonts and images loaded.
- FFprobe confirms H.264, 30 fps, 7,170 frames and exactly 239 seconds; the complete film decodes without errors.
- Take Studio's sample update preserves custom text, recording selections, settings, imported videos and chapter times. Eight unit tests pass, including three migration regressions.

The current export hashes are in [refresh-manifest.json](refresh-manifest.json).
