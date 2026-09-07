import test from 'node:test';import assert from 'node:assert/strict';
import {axelarPlugin} from 'hak-axelar-plugin';
import {buildPluginBridge} from '../src/settlement/axelarPlugin.js';
import {bridgeInterface,bridgeCalldata,ITS} from '../src/settlement/bridge.js';
const input={requestId:'plugin-check-00000001',amount:.01,recipient:'0x1111111111111111111111111111111111111111'},gas=20000000n;
test('actual HAK plugin builds the bounded Hedera transfer with corrected gas units',async()=>{
 const tx=await buildPluginBridge(input,gas),data='0x'+Buffer.from(tx.functionParameters).toString('hex');
 assert.equal(data,bridgeCalldata(input.recipient,10000,gas));assert.equal(tx.payableAmount.toTinybars().toString(),String(gas));assert.equal(tx.isFrozen(),false);assert.equal(tx.transactionId,null);assert.equal(tx.maxTransactionFee.toTinybars().toString(),'100000000');
});
test('plugin adapter rejects changed destinations before signing',async()=>{
 const original=axelarPlugin.tools({}).find(t=>t.method==='axelar_send_token');
 const tool={method:original.method,normalizeParams:(...a)=>original.normalizeParams(...a),coreAction:async(...args)=>{const r=await original.coreAction(...args),data='0x'+Buffer.from(r.transaction.functionParameters).toString('hex'),a=bridgeInterface.parseTransaction({data}).args;
 r.transaction.setFunctionParameters(Buffer.from(bridgeInterface.encodeFunctionData('interchainTransfer',[a.tokenId,a.destinationChain,ITS,a.amount,a.metadata,a.gasValue]).slice(2),'hex'));return r;}};
 await assert.rejects(buildPluginBridge(input,gas,{tool}),/terms/);
});
test('plugin adapter rejects unbounded gas and caller-selected networks',async()=>{
 await assert.rejects(buildPluginBridge(input,100000001n));await assert.rejects(buildPluginBridge({...input,network:'mainnet'},gas));
});
