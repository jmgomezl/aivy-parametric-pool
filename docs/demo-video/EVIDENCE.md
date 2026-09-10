# What really happened in this recording

**September 8, 2026 · public site · new actions use testnet tokens only.**
[Machine-readable, independently checked receipts](evidence.json).

**Added September 9 in Colombia (September 10 UTC):** the Aivy monthly canvas
created [Medellín policy #34](https://quorum.aivylabs.xyz/policy/34), with a
10 aUSDd premium and 1,398.885588 aUSDd conditional payout.
[Premium](https://hashscan.io/testnet/transaction/0.0.7231440-1789013941-231286735),
[NFT mint](https://hashscan.io/testnet/transaction/0.0.7231440-1789013938-556873410),
[NFT delivery](https://hashscan.io/testnet/transaction/0.0.7231440-1789013940-352957462)
and [scheduled payout](https://hashscan.io/testnet/schedule/0.0.10453186) were independently checked.
The payout carries the agent signature and has **not executed**.
[Full evidence](cover-agent-evidence.json).

Pause survived a reload; resume and “Check renewal now” preserved exactly one
completed purchase. The next planned attempt is **October 9, 2026, 11:18:56 PM
in Colombia** (October 10, 04:18:56 UTC), no earlier than this policy's expiration.
The mandate permits up to three purchases and 30 aUSDd total premiums. Later
renewals were tested with a fake clock, not presented as completed onchain events.

**Added September 10 UTC — Ask Quorum:** an anonymous visitor typed “Why Hedera,
Axelar and Uniswap?” on the live Quorum homepage. The actual model selected the
`network` topic; the server returned the displayed explanation and labeled
testnet/mainnet links. [Captured response](companion-evidence.json).
This is a real read-only chat interaction, not a transaction or a fresh health
check of every external network. No account was created or funded for this shot.

| Video action | Actual outcome / verify |
| --- | --- |
| Create Medellín cover | [Policy #33](https://quorum.aivylabs.xyz/policy/33): 4 aUSDd premium, 559.519216 aUSDd conditional payout. [Premium transfer](https://hashscan.io/testnet/transaction/0.0.7231440-1788901774-667959908), [NFT mint](https://hashscan.io/testnet/transaction/0.0.7231440-1788901774-912603251), [NFT delivery](https://hashscan.io/testnet/transaction/0.0.7231440-1788901777-829385744), [scheduled payout](https://hashscan.io/testnet/schedule/0.0.10427620). All new receipts confirmed. |
| Pay for USGS evidence | [Blocky402 payment](https://hashscan.io/testnet/transaction/0.0.7162784-1788901935-694660044): 0.001 aUSDd. No match. |
| Pay for EMSC evidence | [Blocky402 payment](https://hashscan.io/testnet/transaction/0.0.7162784-1788901942-664807886): 0.001 aUSDd. No match. |
| Pay for GEOFON evidence | [Blocky402 payment](https://hashscan.io/testnet/transaction/0.0.7162784-1788901945-581906620): 0.001 aUSDd. No match. |
| Fund the cover pool | [Atomic deposit/share transfer](https://hashscan.io/testnet/transaction/0.0.7231440-1788902010-615613885): 25 aUSDd into pool `0.0.10373722`; 25 ARPS delivered to the demo account. It already held 1 ARPS, so the refreshed holding is 26. |
| Bridge new test tokens | [Hedera source transaction](https://hashscan.io/testnet/transaction/0.0.10408125-1788901876-614054576): 0.01 aUSDd, built through HAK Axelar plugin 1.0.1. Source confirmed; [Axelar delivery](https://testnet.axelarscan.io/gmp/0x2e3fbf7223d31d24a6a98da8927cd3b550adcdc8f53af3e8f4b54b28118df0e8) was **pending at capture**. The edit does not show or claim a newly delivered destination transaction. |
| Approve and swap on Uniswap | [Exact approval](https://sepolia.etherscan.io/tx/0xe5b45557742cfbcd8ca71c6b0186f62579d8d4de4560d50c4d5d8b18525de602), [confirmed swap](https://sepolia.etherscan.io/tx/0x2676ea1b5b9ee1b571c94a3e9b0d1ea6996a50fa08a05199c7b0b502145c389c), [raw RPC receipt](assets/swap-receipt.json). Status 1, Sepolia block 11663559. These tokens came from **previously bridged starter inventory**, not the pending source bridge above. |
| Inspect Uniswap liquidity | Read-only view of the live pool/seed NFT and existing demo-position controls. No new LP mint, collection or withdrawal was submitted for this recording. [Previously verified complete lifecycle](https://github.com/jmgomezl/aivy-parametric-pool/blob/main/docs/evidence/uniswap-liquidity.json). |
| Ask the network | Actual anonymous question, AI topic classification and trusted server answer. [10-second source](assets/footage/quorum-companion.mp4) · [public response](companion-evidence.json). No ledger writes. |

The three paid checks found **no qualifying event**. They produced **no policy
signature and no payout**. Blocky402 sponsored their Hedera network fees.

The mainnet sequence is a **different, controlled experiment from September 4**:

- [4 HBAR scheduled payout actually executed](https://hashscan.io/mainnet/transaction/1788563478.715401105).
- [Oracle-only schedule stayed blocked](https://hashscan.io/mainnet/schedule/0.0.10843725).

That experiment proves a signature restriction. It is not a live earthquake
claim, autonomous detection, or proof that the three oracle operators are independent.
No mainnet transaction was submitted while making this video.

Previously completed bridges and swaps remain linked in the app and in
[cross-chain verification](https://github.com/jmgomezl/aivy-parametric-pool/blob/main/docs/CROSS-CHAIN-VERIFICATION.md).
The pending new bridge is never substituted for those earlier receipts.

## Editing boundary

Browser footage plays at its captured speed. Unnecessary confirmation waits are
removed with cuts; some final states are held for narration. Original UI content
and transaction outcomes are preserved. The script's $800 refers only to the
history chart's fixed comparison payout, not to policy #33's 559.519216 aUSDd payout.

Shared-pool shares, proposed policy funding and real Uniswap position NFTs are
separate. ARPS withdrawals/income are not implemented. Service fees and the
commercial partnership model are proposals, not existing revenue or traction.

To recheck the recording without sending transactions:

```sh
node docs/demo-video/production/verify-recording.mjs
node docs/demo-video/production/verify-cover-agent.mjs
```
