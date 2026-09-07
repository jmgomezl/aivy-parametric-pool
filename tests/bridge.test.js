import test from 'node:test';import assert from 'node:assert/strict';
import {bridgeInput,gasTinybars,bridgeCalldata,bridgeInterface,ITS_TOKEN_ID} from '../src/settlement/bridge.js';
const recipient='0x1111111111111111111111111111111111111111',requestId='12345678-1234-1234-1234-123456789000';
test('bridge enforces asset-independent fixed request schema and amount bounds',()=>{assert.equal(bridgeInput({recipient,requestId,amount:1.25}).units,1250000);for(const changes of [{amount:11},{amount:0},{amount:NaN},{amount:.001},{recipient:'0x0000000000000000000000000000000000000000'},{chainId:1}])assert.throws(()=>bridgeInput({recipient,requestId,amount:1,...changes}));});
test('Hedera gas fee converts EVM 18 decimals to tinybars, rounding up',()=>{assert.equal(gasTinybars('222105269388464300'),22210527n);assert.throws(()=>gasTinybars('1000000000000000001'));assert.throws(()=>gasTinybars('-1'));});
test('bridge calldata fixes route and binds recipient, amount and tinybar gas',()=>{const data=bridgeCalldata(recipient,1000000,22210527n),args=bridgeInterface.parseTransaction({data}).args;assert.equal(args.tokenId,ITS_TOKEN_ID);assert.equal(args.destinationChain,'ethereum-sepolia');assert.equal(args.destinationAddress,recipient);assert.equal(args.amount,1000000n);assert.equal(args.gasValue,22210527n);assert.equal(args.metadata,'0x');});

import {Interface} from 'ethers';
import {verifyBridgeSource,ITS} from '../src/settlement/bridge.js';
const events=new Interface(['event InterchainTransfer(bytes32 indexed tokenId,address indexed sourceAddress,string destinationChain,bytes destinationAddress,uint256 amount,bytes32 indexed dataHash)']);
test('bridge delivery is bound to a successful exact source event',()=>{
 const log=events.encodeEventLog(events.getEvent('InterchainTransfer'),[ITS_TOKEN_ID,recipient,'ethereum-sepolia',recipient,1000000,'0x'+'00'.repeat(32)]);
 const source={result:'SUCCESS',logs:[{address:ITS,...log}]},action={amount:1,recipient};
 assert.equal(verifyBridgeSource(source,action).args.amount,1000000n);
 assert.throws(()=>verifyBridgeSource({...source,result:'CONTRACT_REVERT_EXECUTED'},action));
 assert.throws(()=>verifyBridgeSource({...source,logs:[{address:recipient,...log}]},action));
 assert.throws(()=>verifyBridgeSource(source,{...action,amount:2}));
 assert.throws(()=>verifyBridgeSource(source,{...action,recipient:'0x2222222222222222222222222222222222222222'}));
});
