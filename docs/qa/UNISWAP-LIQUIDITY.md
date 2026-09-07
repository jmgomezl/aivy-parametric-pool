# Uniswap market and position verification · September 7, 2026

The existing Bridge → Swap journey remains the main action. A secondary market
section shows actual pool balances, genuine seed NFT metadata and a collapsible
wallet position manager. This is separate from ARPS and cover funding.

## Real Sepolia lifecycle

| Operation | Verified outcome |
| --- | --- |
| Create | NFT **231762** minted to the verification wallet, using 0.1 aUSDd plus matching test USDC. |
| Increase | Another 0.1 aUSDd plus matching test USDC added to the same NFT. |
| Generate fees | A separate real 1 aUSDd swap crossed this pool. |
| Collect | **6 base units = 0.000006 aUSDd** delivered to the owner; uncollected balance became zero. |
| Partial exit | 50% removed; remaining liquidity changed from 199974 to 99987. Both tokens returned. |
| Final exit | Remaining liquidity removed; NFT retained with zero principal and zero uncollected tokens. |
| Preserve seed | Original NFT 231745 liquidity remained **90000000**. No insurance reserves or ARPS used. |

[Transaction hashes, snapshots and delivered-token events](../evidence/uniswap-liquidity.json).
The same journal was reconciled a second time without submitting new transactions.
The checked-in [verification tool](../../scripts/verify-uniswap-liquidity.js) keeps
signed bytes in the private artifact directory before broadcast and refuses to
restart an uncertain step with a new transaction.

## Interface and guardrails

- TypeScript and production build pass. Backend regression: **80 tests**.
- Live pool/position reads checked at **320, 375, 620, 768, 850, 1024 and 1280 px**,
  for new and existing positions. No horizontal overflow or page exceptions.
- Missing-wallet guidance, wallet balance/position discovery, fee/withdrawal
  modes, partial/full choices and closing the controls checked in an isolated browser.
- Synthetic wallet fixtures exercise exact approvals, NFT ID extraction,
  duplicate-submission blocking, rejection, gas limits, unknown submission after
  reload, foreign-hash rejection and matching-hash recovery. These test interface
  behavior; the separate lifecycle above proves ledger execution.
- Negative backend tests reject changed chains, tokens, position IDs, recipients,
  ranges, extra calls, trailing calldata, excess amounts, insufficient minima,
  foreign/transferred NFTs, empty fees, unavailable APIs and insufficient balances.

No private wallet extension UI was automated. An injected-wallet fixture validates
the frontend protocol; an operator-funded testnet signer validates the real API
and on-chain lifecycle. User wallet confirmations remain explicit.

## Scope

This interface manages full-range Uniswap V3 positions in the one verified
Sepolia market. No custom Solidity deployment, market APY, mainnet liquidity,
ARPS trading/redemption, insurance-premium income distribution, or automated
reinvestment. Test tokens have no cash value. API outages fail closed; no quote
or pending transaction is silently re-submitted.
