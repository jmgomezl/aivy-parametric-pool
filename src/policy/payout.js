// The payout leg, built on the hak-scheduled-settlement plugin.
//
// The app deliberately consumes the plugin rather than reimplementing the
// mechanism: the plugin is the reusable contribution and this is its first
// consumer. At purchase the agent pre-signs the scheduled transfer, so from then
// on the only signatures the payout still needs are the oracles'.
import { createScheduledSettlementPlugin } from 'hak-scheduled-settlement';

const plugin = createScheduledSettlementPlugin();
const tool = (method) => plugin.tools({}).find((t) => t.method === method);

export async function schedulePayout(client, { poolId, beneficiaryId, payoutHbar, days, memo }) {
  return tool('settlement_create').execute(client, {}, {
    fromAccountId: poolId.toString(),
    toAccountId: beneficiaryId.toString(),
    amount: payoutHbar,
    expirySeconds: Math.min(days * 24 * 3600, 5356800),
    memo: memo ?? 'parametric payout',
  });
}

export const attest = (client, scheduleId, oraclePrivateKey) =>
  tool('settlement_attest').execute(client, {}, { scheduleId, attesterPrivateKey: oraclePrivateKey });

export const payoutStatus = (client, scheduleId) =>
  tool('settlement_status').execute(client, {}, { scheduleId });
