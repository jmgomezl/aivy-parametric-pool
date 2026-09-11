# AI assistance disclosure

This project used AI-assisted development. Codex assisted with repository review,
UI/UX design and implementation, debugging, tests, documentation, and deployment.
Claude was also used during development and deployment coordination, including
DNS setup. The team directed the product requirements, selected the concept and
scope, evaluated the interface, and requested revisions.

For the work represented in this task, Codex assistance includes:

- Applying Juanma's pre-existing `hedera-mirror-node` skill from
  [hedera-skills PR #16](https://github.com/hedera-dev/hedera-skills/pull/16) to the
  September 10 Mirror Node review: filtered token balances, exact integer parsing,
  regression tests and public read-only verification. [Scope and attribution](MIRROR-NODE.md).
- `src/cover-agent/`, `src/demo/purchase.js`, and the separate Aivy repository's
  Quorum canvas: bounded monthly purchase mandates, persisted scheduling,
  consent/receipt UI, recovery tests, deployment and a real first-policy capture.
  The founder requested the Aivy-to-Quorum monthly-budget interaction. It uses a
  deterministic worker, not an LLM with transaction authority.
- The right-side cover companion: existing Aivy pixel art, responsive chat UI,
  topic-only OpenAI interpretation, owner-bound policy reads and deterministic
  receipt answers. The AI has no tools, policy write access or signing authority.
- `src/companion/quorum.js` and the Quorum companion UI extend this boundary to
  public policy pages, network roles, x402 receipts, pool capital and authenticated
  balances. Codex assisted the implementation, tests, live checks and video edit.
  The animated robot art is reused from the earlier Aivy office.
- `ui/src/app/`, `ui/src/components/`, `ui/src/story/`, `ui/src/styles.css`: map/search,
  cover flow, historical chart, geographic NFT presentation, LP preview, evidence
  disclosures, navigation and responsive layout.
- `ui/src/lib/lp-model.mjs`, `src/places.js`, and associated tests: worldwide lookup
  and illustrative premium-income calculations.
- `src/activity.js`, `src/x402/gate.js`, `scripts/demo-x402.js`: public payment
  evidence and a bounded testnet verification run.
- `src/issuance-lock.js`, `src/oracle/verify-policy.js`, `src/oracle/service.js`,
  `src/x402/gate.js`, and regression tests: September 8 fixes for process-crash
  recovery, payment/query ordering, and interleaved HCS chunks.
- Earlier audit work in this task assisted issuance locking/recovery, policy-bound
  oracle verification, payment validation, tests and reproduction documentation.
- READMEs, `AUDIT-IMPLEMENTATION.md`, and `docs/`: explanation, audit and recording guidance.
  The September 10 submission review condensed the judge overview, preserved
  detailed disclosures, added CI and fixed SDK-entity handling in the pool balance
  reader with a regression test.
- `docs/submission/logo-quorum.png` and `cover-quorum.png`: generated with Codex's
  built-in image-generation tool on September 10 (Bogotá), following the founder's
  request for submission branding. The abstract topographic cover is artwork,
  not hazard data. [Exact prompts and asset provenance](submission/ASSETS.md).
  The accompanying `docs/submission/media/*.jpg` files are direct browser
  screenshots of the deployed apps, with no AI-generated UI or transaction data.
- `docs/demo-video/`: AI-assisted narration draft, original SVG/HTML visual
  composition, capture/edit scripts, a browser rehearsal and voice-recording page,
  and the silent visual edit. The founder directed the emotional problem framing,
  requested real product flows and onchain evidence, and will supply human
  narration. USGS earthquake images are attributed public-domain source material;
  no AI voiceover or synthetic disaster photography was used.

The geographic art uses code-rendered Natural Earth / world-atlas data; worldwide
place search uses Photon/OpenStreetMap. These are external data sources, not
original AI-created geographic datasets. Signing keys and private configuration
are excluded from the public repository.

This is a disclosure of known assistance, not an assertion that unlisted files
were entirely written by a human. The submission owner should include any other
AI tools or workflows used outside this task and retain relevant project planning
artifacts required by the event. Prior reused work is described in the README's
Continuity section.
