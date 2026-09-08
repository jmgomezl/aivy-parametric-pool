# Final security review · September 8, 2026

**Verdict: ready to record the verified demo flows.** Complete the external
submission steps and choose prizes against their actual requirements below.

The final review of the recent recovery, oracle-payment and HCS changes found
three issues. Each has a focused regression test and an implemented correction.

| Issue | Correction | Verification |
| --- | --- | --- |
| Two processes could reclaim the same abandoned PID marker and enter issuance together. | A permanent guard inode carries a kernel `flock` throughout work and cleanup. Only its holder can recover a provably dead owner marker. | Paused competing reclaimers, SIGKILL recovery, six competing processes, exception cleanup and stable-inode checks. |
| Any nonempty payment header could trigger catalogue I/O before payment validation. | Validate the exact payment and its protocol context, obtain the result, then settle before serving it. Unavailable sources return without submission. | Missing/malformed/wrong-context/incorrect payments never query or settle; success order, source failure and settlement failure are checked. |
| HCS chunk assembly assumed sibling sequence numbers were adjacent. | Match original transaction identity and chunk number while paging both before and after the pointer. | Interleaved out-of-order siblings, pagination, unrelated messages, duplicates, inconsistent totals and missing chunks. |

## Checked before deployment

- **104 tests pass on macOS Node 22 and the VPS's Linux Node 22.23.2.**
- A fresh production dependency install succeeds on both hosts; the Linux native
  lock module loads. The dependency audit reports zero known advisories.
- TypeScript and the production UI build pass. The existing approximately 668 kB
  main-JavaScript bundle warning remains; this change does not enlarge the UI.
- Lock recovery does not clear reservations, reset budgets or retry uncertain
  transactions. Contradictory paid/unavailable oracle responses remain reviewable.

## Deployed and checked live

Implementation **`faa6489`** is on GitHub and deployed to the agent and all three
oracle services. The Linux dependency tree was built and tested in isolation;
existing services were drained/stopped before switching lock protocols. Private
journals and credentials stayed on the VPS. Live source, UI assets and revision
markers were compared against the tested local build. Local development still
reaches the deployed API through its existing tunnel.

| Live check | Result |
| --- | --- |
| New Tokyo cover **#32** | 4 aUSDd premium transferred; NFT minted/delivered; 110.792422 aUSDd payout scheduled. |
| Three policy-bound x402 requests | USGS, EMSC and GEOFON each settled 0.001 test aUSDd and returned no match. No oracle signature was added; the payout remains pending. |
| Invalid payment headers | Nine live requests across the three services rejected missing, malformed or wrong-context headers with 400/402 and no payment receipt. Unit tests separately verify that catalogue I/O is not invoked. |
| Managed Uniswap swap | Exact aUSDd approval and 0.01 bridged test aUSDd swap both confirmed on Sepolia. |
| Ledger evidence | Eight newly executed transactions independently confirmed through Hedera Mirror Node and Sepolia RPC. Nine previously published receipts, including the controlled mainnet payout and LP exit, also rechecked. |
| Responsive UI | 54 route/width checks, 320–1440 px: no horizontal overflow or browser exceptions. Desktop and phone screenshots inspected. |
| Historical chart | Seven widths, 320–1920 px: right-side placement, click/drag selection, keyboard, playback and close behavior pass. |
| Judge journeys | Medellín search, quote controls, account dismissal, policy/funding navigation, six story scenes, evidence tabs, missing-page recovery and expired swap/LP quote refresh pass. No wallet-extension access. |

[New testnet receipts and request results](../evidence/security-final-testnet.json)
· [Cover #32](https://quorum.aivylabs.xyz/policy/32)
· [Confirmed managed swap](https://sepolia.etherscan.io/tx/0x02e061bc5ee0159f0c7e1c9dae037b9c5bc876312ef0e8c1d8e4dbcea8668772).

At the final pool check, 176,038.035478 aUSDd was free to back new cover; the rolling
budget had 96 of 100 policy slots remaining and approximately $98,702 modeled
cover capacity remaining. These are time-dependent demo limits, not real dollars.
No budgets or journals were reset for the rehearsal.

## Operating boundaries

Kernel locking coordinates cooperating processes on **one host and local
filesystem**. Never delete or replace the `.guard` file. Drain old PID-only
writers before upgrading; mixed versions do not share the same protection.
Malformed or apparently live owner markers still fail closed. Node 22 is pinned
in `.nvmrc`; build the native dependency for the actual host and Node ABI.

Chunk discovery is limited to five pages of 100 messages in each direction and a
shared ten-second deadline; missing data is rejected, not guessed. Catalogue and
mirror availability remain external dependencies.

This is a testnet demonstration with service-managed keys and manually requested
event checks. It is not a production custody or independent-operator audit.

## Submission boundary

Freeze major features and demonstrate the verified journeys. The application
does not implement ARPS redemption or insurance-income distribution; separate
Uniswap positions do support fee collection and withdrawal.

Uniswap's external feedback form still needs confirmed submission. Hedera's AI &
Agentic Payments prize specifically requires Blocky402; the current self-hosted
facilitator does not satisfy that condition. See [prize fit and recording guide](../SUBMISSION.md#partner-prize-fit)
before selecting prizes. The video and event-dashboard submission remain human
submission steps.

[Security architecture](../AGENT-SECURITY.md) · [UX review](READINESS-REVIEW.md)
