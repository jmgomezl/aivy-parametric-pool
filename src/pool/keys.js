// THE key decision of this project.
//
// The payout is a Scheduled Transaction that transfers from the pool account, so
// the signatures it requires are whatever the POOL ACCOUNT's key requires. The
// naive design puts the oracle keys directly on the pool account — but then the
// same oracle quorum can sign ANY transaction out of the pool, making the
// oracles custodians of the whole treasury.
//
// Instead the pool key is an AND of two branches:
//
//   KeyList[                      <- no threshold => ALL branches required
//     poolAgentKey,               <- signs ONCE, at policy purchase
//     KeyList[o1,o2,o3] (2)       <- 2-of-3 oracles, sign at trigger time
//   ]
//
// At purchase the agent signs the scheduled payout, so its branch is already
// satisfied and nothing of ours has to be awake later. At trigger time the only
// missing signatures are the oracles'. Result: the payout still executes itself
// with no keeper, AND the oracle quorum alone can never move a tinybar.
import { KeyList } from '@hashgraph/sdk';

export const ORACLE_THRESHOLD = 2;
export const ORACLE_COUNT = 3;

/** 2-of-3 over the oracle public keys. */
export function oracleQuorumKey(oraclePublicKeys) {
  if (oraclePublicKeys.length !== ORACLE_COUNT) {
    throw new Error(`Expected ${ORACLE_COUNT} oracle keys, got ${oraclePublicKeys.length}`);
  }
  return new KeyList(oraclePublicKeys, ORACLE_THRESHOLD);
}

/** and(agent, 2-of-3 oracles). A KeyList with no threshold requires every member. */
export function poolAccountKey(agentPublicKey, oraclePublicKeys) {
  return new KeyList([agentPublicKey, oracleQuorumKey(oraclePublicKeys)]);
}
