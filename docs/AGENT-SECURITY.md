# Agent guardrails and trust boundaries

The deployed agent is a deterministic underwriting and transaction workflow.
There is no LLM in the public quote/issuance/signing path. Location labels are
untrusted display data, not instructions. A future AI planner must remain outside
the authorization boundary and call this constrained policy service; it must not
receive raw private keys, a shell, or a generic transaction-signing tool.

```mermaid
flowchart TD
  Visitor[Untrusted browser input] --> Validation[Typed, bounded, allowlisted policy request]
  Validation --> Lock[Exclusive issuance lock and idempotency check]
  Lock --> Price[Deterministic pricing and fresh pool balance]
  Price --> Budget[Persistent rolling admission budget]
  Budget --> Reserve[Persist exposure reservation before ledger work]
  Reserve --> Terms[Publish immutable terms and hash-bind schedule]
  Terms --> Agent[Agent commits exact beneficiary and amount]
  Catalogues[Configured external catalogues] --> Oracle[Each oracle verifies terms and transfer bytes]
  Agent --> Ledger[Hedera: agent AND 2 of 3 oracle keys]
  Oracle --> Ledger
  Ledger --> Payout[Execute the fixed scheduled transfer]
```

## What a judge can verify

| Boundary | Enforcement / evidence |
| --- | --- |
| Public requests cannot choose arbitrary operations | `src/http-safety.js`: exact field allowlist, numeric coordinates, budget $1–$50, integer duration 7–62 days, bounded request ID, 8 KB JSON object limit. No beneficiary, raw transaction, signing key or schedule ID accepted by issuance. |
| Mainnet is not a public faucet | `src/server.js` and `src/guards.js` reject public creation outside testnet. There is no environment opt-in that enables the public mainnet route. CLI mainnet demos are a separate operator action. |
| Budget control happens outside any model | `src/guards.js`: limits validated at startup; attempt/IP/hour, attempt/24h and modeled cover/24h limits are consumed before the first ledger action. Interrupted attempts remain charged. |
| Restart does not reset limits | Private atomic JSON journal under `.artifacts/write-budget-testnet.json`. First migration seeds known policies/reservations. Missing historical IP attribution cannot be reconstructed; the global budget is restored. Invalid journal pauses writes. |
| Quotas cannot be bypassed with a forged IP prefix | Loopback proxy is explicitly trusted; only the final proxy-appended address is used. External peers' forwarding headers are ignored. Nginx appends the actual client address. |
| Pool capacity is not double-promised | `src/issuance-lock.js`, `src/policy/issue.js`, `src/book.js`: cross-process lock, fresh SDK balance check and persistent reservation before account creation. An abandoned lock fails closed. |
| Retries do not mint a second policy | Existing request ID returns its original completed policy or a needs-review response. Partial progress is persisted; uncertain reservations are not silently released. |
| The schedule is bound to policy terms | `src/policy/binding.js` hashes canonical terms; oracle verifier checks the configured HCS topic, issuer signature, time window, exact asset, amount and beneficiary, rejects extra legs/allowances/unknown fields. |
| Oracle input cannot lower the insured trigger | `/attest-and-sign` derives its spec from published terms, not caller-provided conditions. Catalogue queries are bounded; missing data is not a positive vote. |
| One catalogue is not a quorum | Distinct signing identities are counted. The helper quorum also deduplicates catalogue names. The live services use USGS, EMSC and GEOFON. |
| Network authorization is separate from app checks | The pool key is `agent AND threshold(2, oracle keys)`. Recorded mainnet control and blocked schedules are linked from “Agent guardrails & proof”. Those prove the key restriction, not independent operators. |
| An HTTP 402 cannot freely spend a caller's money | `src/x402/payment-policy.js`: an explicit resource, network, recipient, token, fee payer and maximum amount must match before signing. Paid redirects are refused. An uncertain response never causes an automatic new payment. |
| The facilitator signs only the required payment | `src/x402/facilitator.js` decodes every node body and rejects extra debits, unrelated assets, allowances and excessive fee caps. Consensus receipt, not precheck, determines success. |
| Mainnet Uniswap quotes do not have spending authority | Server selects only the quote tool; USDC→ETH on Base/Unichain is allowlisted and bounded. No EVM key is required, no approval or broadcast occurs. API key stays server-side. |
| Judges can inspect deployed configuration | `GET /api/guardrails` exposes network, execution mode, limits and current usage, without IP identifiers or secrets. UI labels this as runtime configuration, not a security certification. |

## Operational review

The deployed Node listeners for this project are loopback-only behind TLS nginx.
The environment and registry files checked on the VPS are mode 0600, and the
artifact directory is mode 0700. Registry writes now preserve private permissions.
The API no longer reflects arbitrary internal exception text to visitors.

This deployment still uses hot keys and a shared VPS/administrative trust domain.
A process separation or different public keys does **not** protect against a
compromised host or administrator who can read all key files. Agent plus oracle
quorum can authorize transfers beyond the app's intended workflow; the Hedera
account key does not itself encode all underwriting restrictions. Reservations
also assume all underwriting writers use the same lock and authoritative book.

Before handling real customer value: isolate oracle operators and credentials;
use managed signer/HSM custody with transaction-policy enforcement; authenticate
funding/customer actions; separate fee-payer budgets; add perimeter request limits,
alerting, backups and an audited recovery runbook; use a transactional database
and distributed locking if scaling across hosts. An offline root of trust and
independent key administration matter more than a stronger system prompt.

The facilitator still relies on ledger signature verification and receipts, and
has no production fee-sponsorship abuse budget. Paid service failures need receipt
reconciliation; there is no automatic refund system. No production readiness or
independent security certification is claimed.

## Reproduce checks

- `npm test`: adversarial tests for quota persistence, corrupt journals, forged
  IP headers, malformed bodies, unauthorized fields, payment-policy substitutions,
  ambiguous payment retry, oracle term binding, duplicate votes and concurrent
  issuance. Tests use temporary directories and local fake transactions; no
  test runner broadcasts to Hedera.
- `npm --prefix ui run build`: frontend typecheck and production build.
- `npm audit --omit=dev --omit=peer`: audit the documented minimal runtime install.
- `GET /api/guardrails`: read runtime configuration without triggering a write.
- Open a policy → **Agent guardrails & proof** → technical source and mainnet
  control/blocked schedule links.

Runtime installation explicitly includes the scheduled plugin's required modern
Agent Kit package and omits unrelated automatic peer installations. Use
`npm ci --omit=dev --omit=peer` for deployment, then run the tests and import smoke
checks before switching the live dependency directory. Do not use `--force` to
silence dependency incompatibilities.

## Design basis

OWASP recommends enforcing authorization downstream of a model, minimizing tool
permissions and limiting excessive agency. This app applies that boundary in code
and ledger keys rather than natural-language instructions:
[OWASP Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/),
[OWASP Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/).
The network-signature behavior is described in
[Hedera scheduled transactions](https://docs.hedera.com/hedera/core-concepts/scheduled-transaction).

### Deployed runtime

Use Node 22 or newer. The VPS uses a project-specific Node 22.23.2 installation
under `/opt/quorum-runtime`; its archive was checked against Node.js's official
HTTPS SHA-256 manifest. Only Quorum's four PM2 processes select this interpreter.
Other applications and the system Node installation remain untouched.

The lockfile pins patched protobuf 7/8, WebSocket 8 and gRPC 1.x versions.
The production dependency tree is installed with `--omit=dev --omit=peer` after
explicitly declaring the modern Agent Kit needed by the settlement plugin. The
older unused automatically installed Agent Kit peer is omitted. Audit the actual
installed tree on every deployment; a clean advisory scan is not proof that the
application has no vulnerabilities.

### Demo capacity configuration — September 6, 2026

The public VPS overrides the conservative code defaults with 12 attempts per IP
per hour, 100 admitted attempts per rolling 24 hours, and 100,000 modeled USD of
cover per rolling 24 hours. Existing usage was retained, not reset. The operator
replenished the unbacked testnet pool to 200,000 aUSDd from the demo treasury;
this is a treasury top-up, not an LP deposit or share issuance. The actual-capital
check remains mandatory. These settings do not allow public mainnet writes.

[Capacity and transaction evidence](evidence/demo-capacity.json).
`scripts/replenish-demo.js` is operator-only, refuses other networks/assets and
dry-runs by default. `--execute` tops up to its fixed target and journals the
submitted transaction ID before waiting for consensus. Reconcile an uncertain
submission before running it again. It is not exposed as a public faucet.

### Interactive accounts and broker flow — September 7, 2026

Public cover creation now requires a browser-held 256-bit demo capability.
The server stores only its digest and resolves custodial signing keys privately.
Referral codes resolve only ready registered accounts; self-referrals and arbitrary
broker account fields are refused. Starter grants and deposit/purchase actions
have separate durable quotas and use the same global issuance lock.
Account balance display reads the mirror node, avoiding paid balance queries on
every page refresh; spending checks still use fresh SDK balances.

[Full business/API boundaries](INTERACTIVE-BUSINESS-FLOWS.md).

## Wallet-approved Sepolia swaps (2026-09-07)

Mainnet conversion remains quote-only. `/api/testnet-swap` prepares a separate Ethereum Sepolia swap using Uniswap Trading API `/quote` and `/swap`. No server private key signs EVM transactions. Chain 11155111, Universal Router 2.0, native ETH input, Circle test USDC output, exact amount, recipient and 0.5% output protection are validated. Only WRAP_ETH + single-pool V3_SWAP_EXACT_IN commands are accepted; allowance, arbitrary transfer and alternate router commands fail closed.

Wallet checks include chain/account binding, gas simulation, input balance, gas cost cap, quote freshness and explicit transaction approval. Pending submission state survives reload; unknown submissions block another quote until an exact matching transaction receipt is found. Wallet rejection clears the pending attempt. Replaced/cancelled transactions without a matching receipt require manual reconciliation; they are not automatically retried.

Read API requests are bounded to 20 per minute and three concurrent calls, with upstream timeouts. API credentials remain on the server. Tests cover altered router, sender, chain, value, commands, recipient, minimum output and deadlines. The native ETH swap is separate from the Axelar bridge described below. Live calldata validation and funded-wallet settlement passed; see `docs/evidence/testnet-swap.json`.


## Hedera → Axelar → Uniswap testnet execution

The public bridge accepts only a browser capability, an idempotent request ID,
a recipient and 0.01–10 aUSDd. Chain, token and ITS contract are fixed. Before an
allowance is signed, the service verifies the Hedera contract account mapping
and the destination token registered by ITS. The managed demo account signs its
own transfer; the operator only sponsors bounded testnet gas. API callers cannot
spend pledged pool capital through this endpoint.

Every source transaction ID is journaled before broadcast under the issuance
lock. Repeating a request with changed terms is rejected. A pending source
transfer can be reconciled from its original ledger event; no replacement is
broadcast. Missing or failed stages remain blocked for operator review. The
normal per-account/global action budgets still apply.

Delivery is not inferred from an Axelar status label: the server matches the
successful Hedera event and Sepolia ITS receipt to the token ID, source address,
recipient and amount. For delayed relaying, it exposes an optional unsigned
execution only after verifying the exact payload and on-chain gateway approval.
The EVM wallet pays for that permissionless completion; ITS commands execute once.

For bridged-token swaps, `/quote` terms are checked before display. The server
retains the quote for two minutes and validates the Permit2 domain, exact amount,
router, signature deadline and signer. `/swap` calldata must contain only the
matching permit and single-hop V3 exact-input swap (or just that swap if a permit
is unnecessary). Changed chains, recipients, commands, paths and minimum output
are rejected. Token approval is exact, never unlimited. The wallet simulates,
checks gas and signs; the API stores no EVM private key.

Browser journals block repeat submissions after ambiguous wallet responses.
A transaction hash must match the prepared sender, target, calldata and value
before confirmation clears it. Existing allowance is checked when refreshing a
quote, avoiding unnecessary approval transactions.

**Trust boundaries:** managed Hedera account custody, Axelar gateway/ITS,
wallet/RPC availability and sponsored pool liquidity remain dependencies. These
controls are bounded testnet safeguards, not an independent security audit.
[Executed receipts and operational limits](CROSS-CHAIN-VERIFICATION.md).


## HAK Axelar plugin integration

`hak-axelar-plugin@1.0.1` is pinned in the lockfile. Only `axelar_send_token` is
selected, with a fresh context pinning testnet and the ITS address; neither an
LLM nor API input can select another tool, network or contract. The plugin's
`normalizeParams` and `coreAction` build the transaction. `secondaryAction`
(which can execute it) is never called.

Before a source action begins, Quorum checks the resulting transaction type,
contract, payable amount and every ITS calldata field. The pinned package encodes
`gasValue` in 18-decimal weibar; this deployed Hedera native contract path expects
8-decimal tinybars. The adapter requires the exact expected legacy value, replaces
only that argument, and compares the entire corrected calldata to Quorum's
known-good encoding. An unexpected package change fails closed. Existing exact
HTS allowances, sponsored-fee limits and journal-before-broadcast rules remain.

The package's generic fee/status tools are not used as authoritative evidence.
Quorum retains the verified ITS fee endpoint and source/destination event checks,
including the Axelar hub-to-destination distinction. Tests invoke the installed
plugin and reject changed destinations, network input and oversized gas.


## QA: manual oracle checks and deposit recovery

The policy page now invokes a capability-authorized, testnet-only check route.
The server selects the recorded schedule and HCS pointer; user-supplied trigger
conditions are rejected. Three fixed HTTPS oracle endpoints receive exact x402
policies (recipient, fee payer, asset and maximum 1,000 base units each). The
payer is the visitor's managed demo account. Payment IDs are persisted before
submission; repeated request IDs do not repay, and uncertain payments block
another check for that policy. A five-minute shared cooldown reuses the latest
result. Existing daily action budgets also apply. Missing sources cast no vote.
Actual schedule signatures remain independently visible in the ledger panel.

Interrupted deposits reconcile only when the original successful transaction
contains the exact four token legs: aUSDd from the visitor to the shared pool,
and ARPS from the treasury to the visitor. Wrong recipient, amount, token or
receipt is rejected; recovery never mints or transfers again. The UI clears its
pending request when that completed action appears in the account journal.

### Paid source failures

Catalogue reads use one 18-second budget and at most three attempts, including
body parsing. FDSN HTTP 204 is an empty record; malformed or empty HTTP 200
responses are unavailable, never a negative vote. A confirmed x402 receipt
survives catalogue failure, and unavailable sources cannot sign. An unknown
payment still blocks a new policy check until its original receipt is reviewed.
See [FDSN event specification, nodata](https://www.fdsn.org/webservices/fdsnws-event-1.2.pdf),
[catalogue tests](../tests/oracle-catalogue.test.js) and
[paid check tests](../tests/policy-checks.test.js).


## UI recovery and evidence clarity (2026-09-07)

The direct Swap page preserves bridge/swap component state when changing steps;
persisted transaction journals still govern reload recovery. A bridge configuration
request times out and offers a read-only reconnect action. Delivery status resets
when the source request changes, and late responses from an earlier request are
ignored. A failed refresh labels previously verified status as stale; it does not
claim delivery or automatically submit another transfer. These are UI controls;
the signing authority and server-side transaction validation are unchanged.

Recorded cross-chain examples are explicitly separate from the visitor’s action
receipts. Shared-pool deposits disclose unavailable withdrawals and LP income
before the action, and ARPS percentages describe issued-token holdings, not yield.
See the [final user/judge review](qa/FINAL-UX-REVIEW.md) for browser checks.

## Uniswap position management (Sepolia only)

**Insurance custody and market liquidity have separate authorities.**
`/api/liquidity/*` reads the existing V3 market and returns unsigned transactions.
It never uses a Hedera account, ARPS supply key, insurance reserve or server EVM
signer. Users supply both test tokens from their own Sepolia wallets.

| Boundary | Enforced behavior |
| --- | --- |
| Chain and market | Sepolia 11155111; pinned V3 pool, NonfungiblePositionManager, aUSDd/test USDC and 3000 fee tier. API routes are disabled outside the testnet deployment. |
| Position ownership | NFT owner and token pair verified on-chain before preparation; ownership checked again before returning the request and in the wallet before submission. Only full-range positions are managed. |
| API output | Canonical ABI decoding and re-encoding. Only mint, increase, collect, or an exact decrease+collect sequence. No extra calls, alternative recipients, native value, permits, burning or arbitrary approvals. |
| Amounts and exit | Add 0.01–1 aUSDd, with at most 1 matching test USDC. Dependent amount checked against the live pool ratio. Removal liquidity must equal the requested percentage of the owned NFT. Both output minima enforce 0.5% protection, subject to integer rounding. |
| Allowances | Read actual ERC-20 allowances and build exact token approvals to the position manager. This intentionally uses a narrower local approval builder instead of accepting generic LP API approval/permit payloads. |
| Signing and gas | Wallet signs and broadcasts. Frontend verifies account/network, target, zero native value and exact approval bytes. Maximum 1M gas and 0.002 Sepolia ETH fee budget per operation. Review expires after 90 seconds; transaction deadline is bounded. |
| Recovery | Save operation, calldata and explicit nonce before the wallet request. Browser Web Locks serialize LP submissions across tabs where supported. Unknown submission blocks another operation. Hash reconciliation checks sender, recipient, calldata, value, nonce and successful receipt; mint recovery also verifies the new NFT Transfer event. |
| Reads and API budget | On-chain reads use a common block per snapshot; pool response cached for 15 seconds with block/time shown. Wallet NFT discovery paginates ten at a time. Global request and concurrency limits, RPC/HTTP timeouts, server-only API key, no API redirects. |

The seed NFT art is read from the pinned manager's `tokenURI`, bounded in size,
restricted to embedded base64 SVG, and displayed as an image resource, never
injected into the DOM as HTML. Metadata failure does not authorize an operation.

Fees shown are actual collectible token units, not a promised yield. Previously
removed but uncollected principal is disclosed in the same figure. Full-range
positions can change their token mix; withdrawal is not a guarantee of original
deposit amounts. LP withdrawal affects only the Uniswap position; ARPS redemption
and insurance-premium distributions remain unimplemented.

[Implementation](../src/settlement/liquidity.js) · [Negative tests](../tests/liquidity.test.js) ·
[Real create/increase/collect/partial and full exit receipts](evidence/uniswap-liquidity.json) ·
[Browser and ledger verification](qa/UNISWAP-LIQUIDITY.md).
