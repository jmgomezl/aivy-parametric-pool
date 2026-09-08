# Blocky402 · paid earthquake evidence

The policy page's **Check for earthquakes** action uses the hosted Blocky402
facilitator on **Hedera testnet**. Each oracle costs **0.001 aUSDd**, with a maximum
of **0.003 per check**. Blocky co-signs the payment and pays its network fee;
the oracle serves its result only after Blocky reports successful settlement.

```mermaid
sequenceDiagram
    participant A as Quorum agent
    participant O as Oracle service
    participant B as Hosted Blocky402
    participant H as Hedera testnet
    A->>O: Request published policy check
    O-->>A: 402 · exact amount and Blocky fee payer
    A->>A: Validate terms · sign · save transaction ID
    A->>O: Retry with signed x402 payment
    O->>O: Verify payer key, balance and exact transfer
    O->>B: /supported + /verify
    B-->>O: Payment valid
    O->>O: Query catalogue; decline if unavailable
    O->>O: Reserve transaction ID once
    O->>B: /settle
    B->>H: Co-sign and submit transfer
    H-->>B: Consensus receipt
    B-->>O: Success + original transaction ID
    O-->>A: Result + Blocky402 receipt
    Note over O,H: A qualifying result may sign the bound payout schedule
```

| Component | Implementation |
| --- | --- |
| Hosted facilitator | [`api.testnet.blocky402.com`](https://api.testnet.blocky402.com/supported), `hedera:testnet`, fee payer **0.0.7162784** |
| Adapter | [`src/x402/blocky.js`](../src/x402/blocky.js): canonical v2 envelope, supported-network discovery, verify, settle, receipt binding |
| Paid resource | [`src/oracle/service.js`](../src/oracle/service.js): USGS, EMSC and GEOFON, both `/attest` and `/attest-and-sign` |
| Consuming agent | [`src/demo/policyChecks.js`](../src/demo/policyChecks.js): pinned recipients, token, Blocky fee payer and maximum price |
| Tests | [`tests/blocky.test.js`](../tests/blocky.test.js): ordering, refusal, mismatched receipts, concurrency and restart recovery |

The correct hosted testnet URL was missed in our earlier research. The old
`api.blocky402.com` probe described the mainnet host, not all Blocky deployments.
The September 8 `/supported` and `/health` calls confirm hosted testnet support.
[Official networks](https://blocky402.com/docs/networks/) ·
[API reference](https://blocky402.com/docs/api-reference/).

## Guardrails

- No Blocky API key, payer private key or local fee-payer signature is sent to the
  facilitator. Only the signed, exact payment and its public requirements leave
  the service. Managed demo custody remains on the shared VPS.
- The URL, network and fee payer are pinned. Discovery must match; redirects and
  unknown recipients, amounts, tokens or authorities cannot authorize spending.
- Payer signatures and balances are checked locally before catalogue work. Blocky
  verifies too. A catalogue that cannot answer declines before settlement.
- An exclusive per-transaction journal file prevents two oracle processes or a
  restart from submitting the same payment twice. Timeouts and mismatched receipts
  keep a pending record; there is no automatic resend or local-facilitator fallback.
- The hosted facilitator is an external dependency. Its reported consensus receipt
  must match the original ID, network and payer. Onchain evidence can be checked
  independently on HashScan. This does not claim independent oracle operators or
  production custody.

Old self-hosted receipts remain historical evidence. The UI identifies **Blocky402**
on new receipts; older ones are not relabeled. All current paid routes use Blocky.

## Reproduce

Use the public app: create funded testnet cover → **Check for earthquakes** →
**Source evidence & x402 receipts**. No wallet extension or mainnet funds are needed.
Alternatively, with the existing private local testnet payer configured:

```sh
node scripts/demo-x402.js --execute
node scripts/demo-x402.js --status
```

The CLI saves an ID before sending and refuses a second execution. Never delete a
pending journal to retry a payment. Its historical query cannot sign a policy.
