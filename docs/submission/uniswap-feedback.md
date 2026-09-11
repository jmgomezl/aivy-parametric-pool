# Uniswap feedback form · prepared answers

Destination: https://developers.uniswap.org/hackathon-feedback

The technical fields below are prepared. Contact details, the founder's ratings,
integration time and terms acceptance must be supplied before submission.
This file does not claim the external form has been submitted.

**Event:** ETHOnline 2026 — Continuity Track  
**Completed project:** Yes  
**Agentic project:** Yes: a bot / agent that executes onchain actions  
**Successful integration:** Yes  
**Continue building:** Yes  
**Support used:** Technical docs

## What did you build?

Aivy Quorum: parametric earthquake cover on Hedera, with a guarded Axelar ITS → Sepolia → Uniswap journey. Judges can execute real testnet swaps and create, increase, collect fees from and remove Uniswap V3 positions using funded demo wallets. I authored the pre-existing npm-published hak-uniswap-plugin so other Hedera Agent Kit developers can access EVM swap tooling. During this event I added the quote-only uniswap_quote tool in GitHub 0.2.0. Quorum consumes it and adds guarded execution adapters. The npm swap release remains 0.1.0 (prior work).

Live: https://quorum.aivylabs.xyz/  
Repo: https://github.com/jmgomezl/aivy-parametric-pool

## Biggest blocker

Combining a custom bridged token on Sepolia with realistic approvals, sufficient test liquidity, asynchronous bridge delivery and recoverable transaction state. A single end-to-end sample for this path would reduce integration time.

## Hardest part of building an agentic app

Treating API-generated calldata as untrusted input before a service-managed signer executes it: validate chain, router, token, recipient, exact approvals, amount, slippage, expiry and transaction value; journal before broadcast and reconcile uncertain receipts without duplicate spending.

## Missing support

A custom bridged-token Sepolia reference flow; a consolidated security guide for calldata and Permit2/allowance validation; and recovery examples for stale quotes, changed balances and uncertain submissions.

## Additional feedback

Required feedback document: https://github.com/jmgomezl/aivy-parametric-pool/blob/main/FEEDBACK.md

Reusable contribution: https://www.npmjs.com/package/hak-uniswap-plugin

Exact package/version reuse and integration evidence: https://github.com/jmgomezl/aivy-parametric-pool/blob/main/docs/HAK-UNISWAP.md

The published npm 0.1.0 swap plugin predates this event. GitHub 0.2.0 adds the quote-only tool during the event: https://github.com/jmgomezl/hak-uniswap-plugin/compare/77e001e588b524930369f1eab30858a3c81d5d49...05bdc45ec1dbe6b142132dd1e81d6cec8457a58e

New Quorum work connects it to a guarded Hedera-origin asset journey, executable Trading API swaps and V3 position operations. Axelar supplies the bridge; Uniswap supplies EVM liquidity.
