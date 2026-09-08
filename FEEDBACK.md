# Uniswap developer feedback · Aivy Quorum

A Hedera-native earthquake-cover application uses Axelar ITS to deliver its demo
asset to Sepolia, then the Uniswap Trading API to swap it and manage V3 positions.
The public app supplies isolated, funded demo wallets so judges can execute real
testnet transactions without installing an extension.

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
