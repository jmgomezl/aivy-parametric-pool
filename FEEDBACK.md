# Uniswap developer feedback · Aivy Quorum

A Hedera-native earthquake-cover application uses Axelar ITS to deliver its demo
asset to Sepolia, then the Uniswap Trading API to swap it and manage V3 positions.
The public app supplies isolated, funded demo wallets so judges can execute real
testnet transactions without installing an extension.

## Reusable access for Hedera developers

I developed [`hak-uniswap-plugin`](https://www.npmjs.com/package/hak-uniswap-plugin)
for Hedera Agent Kit so other HAK developers can add Uniswap swaps to their
agents. Publishing it on npm makes this integration reusable beyond Quorum:
Hedera agent applications can reach EVM liquidity through familiar JavaScript
tools. [Source, package reach and exact Quorum use](docs/HAK-UNISWAP.md).

The published npm **0.1.0 swap plugin** predates this event. On September 5,
GitHub **0.2.0** added `uniswap_quote`: request a quote and unsigned transaction
without a signing key, token approvals or broadcast.
[Exact event diff](https://github.com/jmgomezl/hak-uniswap-plugin/compare/77e001e588b524930369f1eab30858a3c81d5d49...05bdc45ec1dbe6b142132dd1e81d6cec8457a58e).
Quorum consumes that GitHub revision and adds guarded Axelar bridging, Sepolia
execution, funded demo wallets and a V3 LP lifecycle. The npm release remains
0.1.0; the new quote tool is not claimed as published to npm.

## What helped

- Quote and transaction-building APIs fit the existing JavaScript agent workflow;
  we did not need to deploy a custom Solidity swap contract.
- The same application can demonstrate swaps and a real LP NFT lifecycle:
  create, add liquidity, collect swap fees and withdraw.
- Quotes, on-chain pool/position identifiers and transaction receipts give judges
  an independently inspectable result.

## Where the developer experience could improve

- A single end-to-end example for **custom bridged tokens on Sepolia**, including
  liquidity seeding, quote discovery, Permit2 and receipt verification, would reduce
  the work needed to assemble a realistic cross-chain demonstration.
- Agent integrations need a concise security guide for validating API-generated
  calldata, exact approvals, recipient, slippage and expiry before signing. Our
  service implements these checks rather than trusting transaction payloads.
- A shared swap-and-LP example covering stale quotes, interrupted requests and
  transaction reconciliation would help applications explain recovery clearly.

These are improvements suggested from this integration, not claims that the APIs
provide custody, bridging or application-level spending controls.

## Verify the integration

- [Architecture and components](README.md#why-uniswap)
- [Bridged-token swap adapter](src/settlement/bridgedSwap.js) and [liquidity adapter](src/settlement/liquidity.js)
- [Guardrails and managed signing](docs/AGENT-SECURITY.md)
- [Cross-chain receipts](docs/evidence/cross-chain-testnet.json)
- [Managed swap and position lifecycle](docs/evidence/managed-wallet-demo.json)
- [Public demo](https://quorum.aivylabs.xyz/swap)

**Submission step:** include this file's public GitHub URL in the
[Uniswap Developer Feedback Form](https://developers.uniswap.org/hackathon-feedback).
This file does not imply that the external form has been submitted.
