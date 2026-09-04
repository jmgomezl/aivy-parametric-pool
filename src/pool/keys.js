// The pool account's key comes from the hak-scheduled-settlement plugin.
//
// The shape is and(poolAgentKey, k-of-n oracles): the agent signs each payout
// once, at policy purchase, and the oracle quorum supplies the only signatures
// still missing at trigger time. So the payout self-executes with no keeper, and
// the oracle quorum alone can never move a tinybar out of the pool.
//
// This lives in the plugin rather than here because it is the reusable part —
// the same key backs milestone escrow, bounty release or DAO disbursement.
export { settlementAccountKey as poolAccountKey, attesterQuorumKey as oracleQuorumKey } from 'hak-scheduled-settlement';

export const ORACLE_THRESHOLD = 2;
export const ORACLE_COUNT = 3;
