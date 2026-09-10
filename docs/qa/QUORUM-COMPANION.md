# Quorum companion · release checks

**September 10, 2026 · deployed at [quorum.aivylabs.xyz](https://quorum.aivylabs.xyz).**
[Architecture and limits](../COMPANION.md) ·
[Actual recorded answer](../demo-video/companion-evidence.json).

| Check | Result |
| --- | --- |
| Backend | 156 tests passed. Fourteen new tests cover the platform companion, including ownership, malformed context, model output, unavailable reads, network labels and shared limits. |
| Frontend | TypeScript and production Vite build passed. No new runtime package. |
| Responsive fixtures | 24 page/viewport combinations across 320–2732 px, including short landscape. Panel, map controls, close paths, route cancellation, errors and reduced motion checked. |
| Deployed UI | All five pages checked at 1920 × 1080, 2732 × 786 and 390 × 900. The panel fit, page width stayed within the viewport, and close/Escape worked. The mobile policy answer used a real ledger read. |
| Actual AI | Typed “Why Hedera, Axelar and Uniswap?” against the deployed service. Model selected `network`; the trusted renderer supplied the explanation and receipt links. |
| Public policy | Anonymous policy #35 returned current ledger state and 0/2 oracle signatures, labeled **public**, not owned by the visitor. |
| Private session | The existing authorized recording session returned its own policy #34 and current token/ARPS balances. No account ID can be supplied in the chat body. |
| Pool and payments | Current pool capital read successfully. Latest recorded Blocky402 payment displayed **0.001 aUSDd · testnet**, preserving fractional precision. |
| Recorded mainnet | Story answer stayed explicitly recorded, with a mainnet receipt and no fabricated current ledger-read timestamp. |
| Write boundary | Transaction request returned guidance only. Invalid owner field was rejected with HTTP 400. Chat prepared and submitted no transaction. |
| Aivy regression | The original Aivy companion still returned the authenticated monthly policy. Saved mandate, first receipt and next attempt were unchanged. |
| Persistent state | Policy book, cover mandates, demo accounts, EVM accounts and write-budget journals matched their hashes before deployment and after live checks. Only the AI quota is expected to advance for typed questions. |

The feature is available on Cover, Policies, individual policies, Swap and How
it works. At wide desktop sizes the open panel leaves room beside the content;
smaller screens use a closable overlay. It does not request a wallet connection.

The robot art predates this integration. The page context, read-only renderer,
shared model limits and new UI are documented separately from the Aivy worker.
This is an explanation layer, not an additional transaction agent or a general
network indexer. Unknown questions stay within the supported topic set.

## Reproduce locally

```sh
npm test
npm --prefix ui run build
# Serve the production UI preview, then use its URL:
QUORUM_PREVIEW_URL=http://127.0.0.1:5186 node ui/scripts/check-companion.mjs
```

The browser script uses fixtures and blocks business writes; it is not onchain
evidence. The [video capture script](../demo-video/production/capture-companion.mjs)
uses the actual public site, anonymously, and only allows the read-only chat POST.
