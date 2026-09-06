# AI assistance disclosure

This project used AI-assisted development. Codex assisted with repository review,
UI/UX design and implementation, debugging, tests, documentation, and deployment.
Claude was also used during development and deployment coordination, including
DNS setup. The team directed the product requirements, selected the concept and
scope, evaluated the interface, and requested revisions.

For the work represented in this task, Codex assistance includes:

- `ui/src/app/`, `ui/src/components/`, `ui/src/story/`, `ui/src/styles.css`: map/search,
  cover flow, historical chart, geographic NFT presentation, LP preview, evidence
  disclosures, navigation and responsive layout.
- `ui/src/lib/lp-model.mjs`, `src/places.js`, and associated tests: worldwide lookup
  and illustrative premium-income calculations.
- `src/activity.js`, `src/x402/gate.js`, `scripts/demo-x402.js`: public payment
  evidence and a bounded testnet verification run.
- Earlier audit work in this task assisted issuance locking/recovery, policy-bound
  oracle verification, payment validation, tests and reproduction documentation.
- READMEs, `AUDIT-IMPLEMENTATION.md`, and `docs/`: explanation, audit and recording guidance.

The geographic art uses code-rendered Natural Earth / world-atlas data; worldwide
place search uses Photon/OpenStreetMap. These are external data sources, not
original AI-created geographic datasets. Signing keys and private configuration
are excluded from the public repository.

This is a disclosure of known assistance, not an assertion that unlisted files
were entirely written by a human. The submission owner should include any other
AI tools or workflows used outside this task and retain relevant project planning
artifacts required by the event. Prior reused work is described in the README's
Continuity section.
