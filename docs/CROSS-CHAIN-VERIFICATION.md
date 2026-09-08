# Testnet execution: evidence and operation

**Real ledger operations, not simulated receipts.**
[Machine-readable evidence](evidence/cross-chain-testnet.json) records the bridge,
exact approval, swap and sponsored V3 liquidity. The visitor transfer and swap
are separate verification transactions using the same canonical asset route.

| Stage | Verified behavior |
| --- | --- |
| Visitor bridge | 0.01 aUSDd locked from demo account 0.0.10408106; delivery verified against the Sepolia ITS event |
| Operator bridge | 100 aUSDd delivered to seed the test market; no pledged pool funds used |
| Liquidity | 90 aUSDd + 90 test USDC deposited in Uniswap V3, 0.3% fee tier |
| Swap | Exact Permit2 approval and wallet signature; 0.01 bridged aUSDd spent, 0.009968 test USDC received |
| Native alternative | [0.00001 Sepolia ETH → 0.171458 test USDC](evidence/testnet-swap.json) |

## Where to try

Main navigation → **[Swap](https://quorum.aivylabs.xyz/swap)** → **01 Bridge** → **02 Swap**.

The same page now shows the actual pool, seed NFT artwork and wallet-owned V3
positions under **Provide swap liquidity**. Create, increase, collect and partial/full
withdrawal were executed on Sepolia: [lifecycle evidence](evidence/uniswap-liquidity.json)
and [QA](qa/UNISWAP-LIQUIDITY.md). These positions are separate from ARPS and
the insurance reserves. The initial 90+90 seed remains a historical deposit;
the page reads current token balances after swaps.
Quote and policy pages also link directly to this flow. Verified examples are
labeled recordings; current receipts appear inside the action that created them.
The public app supplies an isolated service-managed Sepolia
wallet, starter tokens and bounded gas sponsorship. Confirm the source receipt,
wait for delivery, review and swap. Exact approvals are included in that action.
The external-wallet forms have been removed from the public app.
[Custody and recovery](MANAGED-DEMO-WALLETS.md).
Mainnet quote previews never initiate transfers.

## Operator setup and recovery

The deployed canonical registry lives in `.artifacts/axelar-bridge-testnet.json`.
Keep `.env` and all `.artifacts` private and preserve them during deployments.
The API requires `UNISWAP_API_KEY`. `hak-axelar-plugin@1.0.1` builds new source transfers through the [guarded adapter](../src/settlement/axelarPlugin.js); it requires no separate Axelar API key. Testnet IDs are intentionally pinned; a network
reset requires deliberate reprovisioning and matching code/configuration updates.

`provision-bridge.js` reads the current deployment without spending by default;
`--execute` enables reviewed testnet setup. Seed and execution scripts also require
`--execute`; inspect their existing journals before use. They are operator tools,
not API endpoints. They use a dedicated test wallet and exact asset/chain limits.
Never delete a pending journal merely to retry.

For deployment recovery, `BRIDGE_GMP_RECORD` points to the saved verified Axelar
record; `BRIDGE_STATUS_RECORD` points to an approved seed-transfer status record.
The historical supplemental-gas utility is not a general automatic retry service.
Users can complete a gateway-approved delayed delivery from their session’s
funded demo wallet in the UI. Pending source failures before a recorded bridge receipt require
operator review; normal same-request retries reconcile confirmed source events.

## Practical limits

- Bridge: 0.01–10 aUSDd; linked-token swap: 0.01–1 aUSDd per transaction.
- Shared demo budgets: 12 actions/account/day, 200 global actions/day.
- Native ETH swap evidence is an operator verification path; its external-wallet UI has been removed.
- Managed Sepolia wallets: 30 starters/day, 3/IP/day, 20 actions/wallet/day, 150 actions/day; bounded sponsorship.
- No automatic relay SLA, mainnet execution, return bridge UI, ARPS market or cash redemption.
- Sponsored liquidity can be exhausted or change price. Quotes and minimum output govern execution.

[Guardrails](AGENT-SECURITY.md) · [Bridge tests](../tests/bridge.test.js)
· [Swap tests](../tests/bridged-swap.test.js)
