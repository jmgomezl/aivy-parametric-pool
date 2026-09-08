# Managed demo wallet verification · 2026-09-07

The default Swap page was exercised in headless Chrome **without an injected
wallet** against the new signer and real Sepolia contracts. No ledger responses
were mocked in the execution checks below.

| Check | Result |
| --- | --- |
| Starter allocation | Separate generated wallet; 0.1 aUSDd, 0.1 test USDC and sponsored gas confirmed |
| Uniswap swap | Exact approval and real 0.01 aUSDd swap confirmed |
| Uniswap LP | Exact approvals, real NFT #231774 minted into the session wallet |
| Full removal | Confirmed; NFT remains owned, liquidity and collectible balances read zero |
| Reload | Existing NFT discovered; completed action restored without another transaction |
| Network evidence | All 11 funding/approval/gas/swap/mint/exit receipts independently checked as successful |
| Responsive forms | 320, 375, 620, 768, 850, 1024 and 1280px; no page overflow |
| Responsive owned position | 320, 375, 768 and 1280px; no page overflow |
| Personal-wallet alternative | Explicit mode switch retains the extension flow |
| Browser errors | None in managed swap/mint execution |

[Public receipt evidence](../evidence/managed-wallet-demo.json).

Nine new isolated security tests cover session/admission persistence, private
response filtering, corrupted journals and abandoned locks, request/quote replay,
durable gas caps, injected authority fields/mainnet refusal, quote ownership,
confirmed NFT event extraction, uncertain broadcast recovery after restart,
wrong RPC chain, and gas reserved for withdrawal. These tests use controlled
provider fixtures; the Sepolia checks above are separate real transactions.

`npm test`: **89 passing**. Production UI build passes; the existing main-bundle
size advisory remains. The initial screenshot exposed an expired local SSH
proxy; the tunnel was restored and pool artwork rechecked. Empty API responses
now produce readable recovery guidance instead of a JSON parsing error.
