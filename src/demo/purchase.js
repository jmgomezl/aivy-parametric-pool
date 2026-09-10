// Shared, guarded testnet purchase adapter. No caller can select signing keys or a beneficiary.
import {TokenId,TransferTransaction} from '@hiero-ledger/sdk';
import {policyInput,HttpError} from '../http-safety.js';
import {request} from '../book.js';
import {issuePolicy} from '../policy/issue.js';
import {withIssuanceLock} from '../issuance-lock.js';
import {settlementAsset} from '../asset.js';
import {createFundedAccount} from '../accounts.js';
import {associate} from '../pool/shares.js';
export function createDemoPurchase({demo,deps,writeGuard,reg,network:NETWORK}) {
 const c=deps.client;
 return async function purchase({sessionId,ip,input:body,validateQuote}) {
  const {referralCode,...raw}=body;
        const input = policyInput(raw);
        if(input.requestId?.startsWith('cover-agent-')&&!validateQuote)throw new HttpError(400,'Cover-agent request IDs are reserved for approved renewal mandates.');
        demo.enabled();demo.store.account(sessionId);
        const brokerId=demo.store.broker(referralCode,sessionId);
        if(request(NETWORK,input.requestId)&&!demo.store.account(sessionId).actions.some(x=>x.requestId===input.requestId))throw new HttpError(403,'This request belongs to another demo session.');
        if(!input.requestId)throw new HttpError(400,'A saved request identifier is required.');
        const result = await issuePolicy({...deps,
          beforeWrite:async quote=>{
            const restricted=validateQuote?.(quote);if(restricted)return restricted;
            const account=demo.store.account(sessionId),balance=await demo.balance(account.accountId);
            if(balance.tokens<quote.settled.premium)return {status:400,reason:'insufficient_balance',message:'Your demo account does not have enough aUSDd for this premium.'};
            return writeGuard.check({ip:ip,usd:quote.payout});
          },
          beforeLedgerWrite:quote=>{
            const restricted=validateQuote?.(quote);if(restricted)return restricted;
            const prior=demo.store.account(sessionId).actions.find(x=>x.requestId===input.requestId);
            if(prior)return {status:409,reason:'pending_recovery',message:'This account request needs review before another payment.'};
            const denied=writeGuard.admit({ip:ip,usd:quote.payout});if(denied)return denied;
            demo.store.begin(sessionId,input.requestId,'cover',quote.settled.premium);return null;
          },
          createBuyer:async quote=>{
            const asset=settlementAsset(NETWORK);
            const buyer=await createFundedAccount(c,NETWORK,1,'demo beneficiary');
            await associate(c,buyer.id,buyer.key,TokenId.fromString(reg.policyTokenId));
            if(asset.kind==='token'){
              await associate(c,buyer.id,buyer.key,TokenId.fromString(asset.tokenId));
              const payer=demo.signer(sessionId);
              const fund=await new TransferTransaction().addTokenTransfer(TokenId.fromString(asset.tokenId),payer.id,-quote.settled.premiumUnits).addTokenTransfer(TokenId.fromString(asset.tokenId),buyer.id,quote.settled.premiumUnits).freezeWith(c);
              await fund.sign(payer.key);await(await fund.execute(c)).getReceipt(c);
            }
            return buyer;
          }
        },{...input,brokerId});
        if(!result.ok)return result;
        await withIssuanceLock(NETWORK,()=>{const a=demo.store.account(sessionId);if(a.actions.some(x=>x.requestId===input.requestId))demo.store.finish(sessionId,input.requestId,{serial:String(result.policy.serial),saleTxId:result.policy.saleTxId,beneficiaryId:result.policy.buyerId,brokerId});});
        return result;
 };
}
