# Real transactions, no wallet setup

**Swap → Demo · no setup** is the default. Each browser receives its own
service-managed Sepolia wallet. A dedicated test sponsor supplies 0.1 aUSDd,
0.1 test USDC and initial gas. No extension, fake connection or simulated receipt.

| Action | What actually happens |
| --- | --- |
| Bridge test tokens | The session’s Hedera account sends via guarded HAK Axelar tooling to its Sepolia wallet |
| Complete delivery | Only that session’s gateway-approved Axelar payload may execute |
| Swap on Sepolia | Exact token approval, validated Permit2 signature and Uniswap Universal Router execution |
| Add liquidity | Exact approvals, then Uniswap V3 mint/increase; the session wallet owns the NFT |
| Collect / remove | Verified owned position; tokens return to the same session wallet |

Starter aUSDd is funded from the sponsor’s **previously bridged inventory**.
It is not evidence that the current visitor’s new bridge has completed. The
bridge panel separately verifies source, Axelar approval and destination events.
Personal-wallet mode remains available and keeps signing in the extension.

## Authority and limits

| Control | Enforced limit |
| --- | --- |
| Network | Sepolia 11155111; live RPC chain checked before signing |
| Public request | Named swap/LP/delivery only; no caller-supplied signer, calldata, recipient or chain |
| Sessions | 30 new wallets/day; 3/IP/day; a ready pre-funded wallet is allocated only once |
| Actions | 20/wallet/day, 150 globally/day; one pending operation per wallet |
| Swap / LP | Existing 0.01–1 aUSDd limits, pinned pool/tokens/routers and 0.5% protection |
| Sponsor | Pinned dedicated test wallet; 0.025 ETH/day maximum reserved spend, retaining 0.005 ETH |
| Per-wallet gas | 0.004 ETH maximum transaction-fee budget; non-exit actions stop at 0.003 ETH |
| Per transaction | At most 1M gas and 0.002 ETH maximum fee |
| Recovery | Single-use quote and request binding; signed bytes, nonce and hash persisted before broadcast |

Gas budgets conservatively count maximum fees, including failed transactions.
Sponsorship can pause when limits or reserves are reached; it is not unlimited.
Read-only polling never starts a transfer. Explicit continuation reconciles the
original transaction and may rebroadcast **identical signed bytes** only.

## Custody and operator recovery

The browser holds a random bearer capability; only its digest is stored as the
wallet allocation key. Generated signing keys and transaction journals remain
in private mode-0600 files under `.artifacts`. No keys or raw signed bytes appear
in API responses. Browser-storage loss loses session access. This demo uses
file-based custody, not production HSM infrastructure.

Configure the dedicated sponsor in private `.artifacts/sepolia-demo-funder.json`
with `chainId: 11155111` and its `privateKey`. The address must match the pinned
demo sponsor. Do not use a mainnet key or commit this file. Preserve this file
and `.artifacts/evm-demo-testnet.json` during deployment and backup securely.

```sh
node scripts/warm-demo-wallets.js --execute --count=3
```

This operator-only command prepares up to three available wallets for faster
first clicks. It reconciles existing funding steps on rerun. There is no public
pre-warm or arbitrary funding endpoint. Wallet and sponsor locks serialize signing;
a crashed writer leaves a lock and fails closed. Before clearing a stale lock,
stop the old writer and reconcile its saved nonce/hash/receipt. Never discard a
pending journal to retry. Drain active jobs before restarting the service.

ARPS shares, policy reserves, mainnet signing and generic transfers are outside
this authority. Uniswap LP withdrawal remains separate from ARPS redemption.

[Signer](../src/demo/evm.js) · [Private store](../src/demo/evm-store.js) ·
[UI](../ui/src/app/DemoEvm.tsx) · [Security tests](../tests/evm-demo.test.js)
