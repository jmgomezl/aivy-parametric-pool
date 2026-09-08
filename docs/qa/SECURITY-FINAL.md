# Final security review · September 8, 2026

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

Deployment and public-flow verification are recorded below after the live checks.

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
