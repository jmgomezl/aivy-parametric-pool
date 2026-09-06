import { proto } from '@hiero-ledger/proto';
import { termsMemo, validateTerms } from '../policy/binding.js';
import { mirrorGet } from '../ledger.js';
const id = value => `${value.shardNum??0}.${value.realmNum??0}.${value.accountNum??value.tokenNum??value.topicNum}`;

/** Pure, strict binding check: the signed schedule may do only the transfer in the terms. */
export function verifyScheduledTransfer(schedule, terms, { poolId, agentPublicKey }, now = Date.now()) {
  const spec = validateTerms(terms, now);
  if(terms.poolId!==poolId)throw new Error('Policy belongs to a different pool');
  if(schedule.deleted||schedule.executed_timestamp)throw new Error('Schedule is no longer pending');
  if(schedule.wait_for_expiry)throw new Error('Schedule must execute at quorum');
  if(schedule.memo!==termsMemo(terms))throw new Error('Scheduled transfer does not match the recorded terms');
  if(Math.abs(Number(schedule.expiration_time)*1000-Date.parse(terms.lapsesAt))>1)throw new Error('Schedule expiry does not match coverage');
  const signed=(schedule.signatures??[]).some(s=>Buffer.from(s.public_key_prefix,'base64').toString('hex').toLowerCase()===agentPublicKey.toLowerCase());
  if(!signed)throw new Error('The committer has not signed this schedule');
  const bytes=Buffer.from(schedule.transaction_body,'base64');
  const body=proto.SchedulableTransactionBody.decode(bytes);
  if(!Buffer.from(proto.SchedulableTransactionBody.encode(body).finish()).equals(bytes))throw new Error('Unsupported scheduled fields');
  if(!body.cryptoTransfer || body.data!=='cryptoTransfer')throw new Error('Schedule is not a transfer');
  const transfer=body.cryptoTransfer;
  let legs;
  if(terms.asset.kind==='hbar'){
    if(transfer.tokenTransfers?.length)throw new Error('Unexpected token transfer');
    legs=transfer.transfers?.accountAmounts??[];
  }else{
    if(transfer.transfers?.accountAmounts?.length||transfer.tokenTransfers?.length!==1)throw new Error('Unexpected transfer legs');
    const token=transfer.tokenTransfers[0];
    if(id(token.token)!==terms.asset.tokenId||token.nftTransfers?.length)throw new Error('Settlement asset does not match');
    legs=token.transfers??[];
  }
  const amount=BigInt(terms.settled.payoutUnits);
  if(legs.length!==2||legs.some(l=>l.isApproval)||!legs.some(l=>id(l.accountID)===terms.poolId&&BigInt(l.amount.toString())===-amount)||!legs.some(l=>id(l.accountID)===terms.beneficiaryId&&BigInt(l.amount.toString())===amount))throw new Error('Transfer amount or beneficiary does not match policy');
  return spec;
}

/** Reassemble HCS chunks, accepting only one original transaction in order. */
export async function readTermsMessage(network,topicId,first,fetcher=fetch){
  const chunk=first.chunk_info;
  if(!chunk || chunk.total===1)return JSON.parse(Buffer.from(first.message,'base64').toString('utf8'));
  if(chunk.number!==1 || !Number.isInteger(chunk.total) || chunk.total<1 || chunk.total>20)throw new Error('Invalid policy message chunks');
  const identity=c=>{const t=c.initial_transaction_id;return t?`${t.account_id}/${t.transaction_valid_start}/${t.nonce??0}/${t.scheduled??false}`:'';};
  const expected=identity(chunk);if(!expected)throw new Error('Missing chunk identity');
  const parts=new Map([[1,first.message]]);
  let path=`/topics/${topicId}/messages?sequencenumber=gt:${first.sequence_number}&order=asc&limit=100`;
  for(let page=0;page<5&&parts.size<chunk.total&&path;page++){
    const result=await mirrorGet(network,path,fetcher);
    for(const message of result.messages??[]){const c=message.chunk_info;if(!c||identity(c)!==expected)continue;
      if(c.total!==chunk.total||c.number<1||c.number>chunk.total||parts.has(c.number))throw new Error('Inconsistent policy message chunks');
      parts.set(c.number,message.message);
    }
    const next=result.links?.next;
    if(next&&!next.startsWith(`/api/v1/topics/${topicId}/messages?`))throw new Error('Invalid message pagination');
    path=next?.replace(/^\/api\/v1/,'');
  }
  if(parts.size!==chunk.total)throw new Error('Policy message is incomplete; retry after mirror indexing');
  const bytes=Buffer.concat(Array.from({length:chunk.total},(_,i)=>Buffer.from(parts.get(i+1),'base64')));
  if(bytes.length>20480)throw new Error('Policy message is too large');
  return JSON.parse(bytes.toString('utf8'));
}

export async function verifiedPolicy({network,scheduleId,termsPointer,poolId,termsTopicId,fetcher=fetch}){
  if(!/^\d+\.\d+\.\d+$/.test(scheduleId??''))throw new Error('A schedule ID is required');
  const pointer=/^hcs:\/\/(\d+\.\d+\.\d+)\/(\d+)$/.exec(termsPointer??'');
  if(!pointer||pointer[1]!==termsTopicId)throw new Error('Terms must come from the configured policy topic');
  const [message,topic,schedule]=await Promise.all([
    mirrorGet(network,`/topics/${pointer[1]}/messages/${pointer[2]}`,fetcher),
    mirrorGet(network,`/topics/${pointer[1]}`,fetcher),
    mirrorGet(network,`/schedules/${scheduleId}`,fetcher),
  ]);
  const terms=await readTermsMessage(network,pointer[1],message,fetcher);
  if(topic.deleted)throw new Error('Policy topic was deleted');
  if(terms.network!==network)throw new Error('Policy network does not match');
  if(!topic.submit_key?.key||!['ECDSA_SECP256K1','ED25519'].includes(topic.submit_key._type))throw new Error('Cannot verify the policy issuer');
  return {terms,spec:verifyScheduledTransfer(schedule,terms,{poolId,agentPublicKey:topic.submit_key.key})};
}
