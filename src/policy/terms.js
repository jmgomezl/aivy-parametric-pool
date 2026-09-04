// A policy's terms live on HCS, not in the NFT.
//
// HTS NFT metadata is capped at 100 bytes — far too small for a trigger spec plus
// the hazard inputs that justify the premium. So the full terms are published as
// an HCS message and the NFT carries only a pointer to it. The terms are then
// immutable, timestamped, publicly readable, and anyone can recompute the premium
// from the same inputs.
import { TopicCreateTransaction, TopicMessageSubmitTransaction } from '@hashgraph/sdk';

export async function createPolicyTopic(client, agentKey) {
  const res = await new TopicCreateTransaction()
    .setTopicMemo('aivy parametric policy terms')
    .setAdminKey(agentKey.publicKey)
    .setSubmitKey(agentKey.publicKey) // only the underwriting agent may issue terms
    .execute(client);
  const receipt = await res.getReceipt(client);
  return { topicId: receipt.topicId, txId: res.transactionId.toString() };
}

/**
 * Publish the terms and return an `hcs://<topic>/<seq>` pointer small enough for
 * NFT metadata. `hazard` is the full output of pricing/hazard.js so the premium
 * is reproducible from this record alone.
 */
export async function publishTerms(client, topicId, terms) {
  const res = await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(JSON.stringify(terms))
    .execute(client);
  const receipt = await res.getReceipt(client);
  const seq = receipt.topicSequenceNumber.toString();
  return { sequenceNumber: seq, pointer: `hcs://${topicId.toString()}/${seq}`, txId: res.transactionId.toString() };
}

/** The trigger spec a policy is settled against. Objective, external, binary. */
export function triggerSpec({ lat, lon, radiusKm, minMagnitude, maxDepthKm, days }) {
  return {
    kind: 'earthquake.parametric.v1',
    location: { lat, lon },
    radiusKm, minMagnitude, maxDepthKm,
    windowDays: days,
    sources: ['USGS ComCat', 'EMSC', 'SGC'],
    resolution: 'k-of-n oracle attestation; 2 of 3 signatures release the payout',
  };
}
