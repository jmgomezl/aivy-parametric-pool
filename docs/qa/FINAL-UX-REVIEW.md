# Earlier user and judge review · September 7, 2026

> Superseded by the [current readiness review](READINESS-REVIEW.md). This page
> preserves the earlier test scope. The public app now uses funded managed wallets
> and has no external-wallet connection flow.

**Verdict: ready to record the demonstrated testnet journey.** The app now makes
Hedera’s settlement mechanism and Uniswap’s useful role discoverable from arrival.
This is a submission prototype, not a production investment product.

**Later September 7 addition:** [Uniswap liquidity verification](UNISWAP-LIQUIDITY.md)
adds actual pool/NFT visibility and a verified create → increase → fee collection
→ partial/full withdrawal lifecycle. The earlier visual-review checks below
remain scoped to their original pass; current regression count is **80 tests**.

## What a judge can understand immediately

| Viewer | Visible value | Inspectable evidence |
| --- | --- | --- |
| First-time user | Choose a place, see the conditional payout, create cover. Funding and referrals have direct actions. | Geographic NFT, published terms and premium receipt. |
| Hedera judge | Agent + oracle quorum authorizes a fixed native Scheduled Transaction; HCS records terms and HTS supplies the receipt/token. | Policy receipts, manual x402 checks, recorded mainnet release and blocked oracle-only control. |
| Uniswap judge | A Hedera-origin token reaches EVM liquidity: HAK Axelar plugin → ITS delivery → Trading API quote/build → wallet-approved swap. | The **Swap** page presents separate Bridge/Swap actions beside labeled testnet examples. |

[Open Swap](https://quorum.aivylabs.xyz/swap) ·
[Hedera architecture](../../README.md#why-hedera) ·
[Uniswap architecture](../../README.md#why-uniswap) ·
[Security](../AGENT-SECURITY.md).

## Improvements delivered

- Added a direct **Swap** destination and a compact visual network-role path on the home page. Quote and policy pages link directly to the action flow.
- Separated **01 Bridge** and **02 Swap**, preserving in-progress state between steps. A confirmed delivery exposes the next action; existing bridged-token holders can go straight to Swap.
- Added labeled bridge/delivery/swap example receipts alongside the form and in the quiet global **Onchain** panel. Examples never masquerade as the visitor’s current transactions.
- Reduced quote repetition while retaining earthquake conditions, demo asset meaning and capacity checks. Mainnet price previews fetch only when opened.
- Moved existing ARPS holdings above pool totals. Unavailable withdrawals and LP income are visible before depositing; percentage means issued-share holdings, not APY.
- Compacted mobile navigation, secondary actions and city shortcuts so search and the map appear sooner.
- Added bridge reconnect feedback and prevented a new transfer from inheriting an older transfer’s delivered status. Late responses from prior requests are ignored.
- Updated README, recording guide, security notes and current gallery/Swap screenshots.

## Verification

| Check | Result |
| --- | --- |
| Responsive routes | **48 layout checks:** home, Tokyo quote, funding gallery, policy cover/LP view, release story, and both Swap steps at 320 / 375 / 768 / 850 / 1024 / 1280 px. No horizontal overflow or page exceptions in the checked routes. |
| Location and history | Unaccented Medellin selected Medellín, Antioquia. Chart click, drag and keyboard changed the year; fixed **$800 payout**, annual arrow/color and return-to-current-cover behavior retained. Pointer interaction had no white outline. |
| Navigation and evidence | Quote/policy entry reaches Swap; step URLs and Back work; missing-wallet guidance survives step changes; three example receipt links and the testnet x402 panel are available. All six story headings/steps fit at 375 px. |
| Mainnet preview | Zero quote requests before opening; a real Trading API quote loaded after opening. No approval or transaction initiated. |
| Account | Broker shortcut opens the account; close button, Escape and outside click dismiss it. |
| Isolated recovery fixtures | Forced bridge failure offers reconnect. Missing recipient blocks submission. A new source request resets delivery status; a delayed earlier response cannot overwrite it. Existing ARPS appears before totals; limits appear before deposit. Clipboard denial exposes a copyable referral link. |
| Regression | **74 tests pass**; TypeScript and production build pass. Main bundle remains about 663 kB before gzip; Swap loads separately. The existing bundle-size warning remains. |

Recovery fixtures intercept API responses in an isolated browser and block writes.
They verify interface behavior, not blockchain execution. Actual deposit,
premium/broker, oracle and cross-chain receipts remain documented in the
[platform QA](PLATFORM-QA.md) and [cross-chain evidence](../CROSS-CHAIN-VERIFICATION.md).
No new ledger transaction was required for this visual review.

## Recording limits

- Historical setup for this earlier pass used an injected wallet. It is no longer the public flow; use the [current managed-wallet guide](../SUBMISSION.md#wallet-free-judge-interaction).
- Public cover, deposits, x402 payments and bridge/swaps are **testnet**. Mainnet settlement is a labeled recording; Base/Unichain prices are quote-only.
- One shared insurance pool; fixed 1:1 demo ARPS issuance. No ARPS distributions,
  withdrawal/redemption, ARPS trading, per-policy vaults or per-policy LP NFTs.
  Separate Uniswap V3 positions have real NFTs, fee collection and withdrawals.
- The bridge uses the visitor’s managed demo balance. Policy payouts use a separate demo beneficiary. Sponsored test liquidity is not a USD peg.
- Checks are manually requested. Distinct keys/catalogues on this project’s host do not establish independently operated oracles.
- This review does not certify prize eligibility, production security, or every device/accessibility combination. Record and submit using the [current guide](../SUBMISSION.md).
