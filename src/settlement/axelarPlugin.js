// HAK plugin builds the transaction; Quorum retains validation, custody and journaling.
import {axelarPlugin} from 'hak-axelar-plugin';
import {ContractExecuteTransaction,Hbar} from '@hiero-ledger/sdk';
import {bridgeInput,bridgeInterface,bridgeCalldata,ITS,ITS_TOKEN_ID} from './bridge.js';

export const AXELAR_PLUGIN_VERSION='1.0.1';
const context=()=>({pluginConfig:{'hak-axelar-plugin':{network:'testnet',itsAddress:ITS}}});
const tokenTool=()=>axelarPlugin.tools(context()).find(t=>t.method==='axelar_send_token');

export async function buildPluginBridge(input,tinybars,{tool=tokenTool()}={}){
 const terms=bridgeInput(input);
 if(typeof tinybars!=='bigint'||tinybars<=0n||tinybars>100000000n)throw Error('Bridge gas exceeds the testnet limit.');
 if(!tool||tool.method!=='axelar_send_token')throw Error('Unexpected Axelar tool.');
 const ctx=context(),params={network:'testnet',interchainTokenId:ITS_TOKEN_ID,destinationChain:'ethereum-sepolia',destinationAddress:terms.recipient,amount:String(terms.units),gasTinybars:String(tinybars),metadata:'0x'};
 // coreAction constructs only. Never invoke secondaryAction/handleTransaction:
 // the application must persist the ID before signing and broadcasting.
 const normalized=await tool.normalizeParams(params,ctx,undefined);
 const built=await tool.coreAction(normalized,ctx,undefined),tx=built?.transaction;
 if(!(tx instanceof ContractExecuteTransaction)||tx.isFrozen()||tx.contractId?.toEvmAddress().toLowerCase()!==ITS.slice(2).toLowerCase()||tx.payableAmount?.toTinybars().toString()!==String(tinybars))throw Error('Axelar plugin returned an unexpected transaction.');
 const data='0x'+Buffer.from(tx.functionParameters).toString('hex');
 const parsed=bridgeInterface.parseTransaction({data}),a=parsed?.args;
 if(!a||a.tokenId!==ITS_TOKEN_ID||a.destinationChain!=='ethereum-sepolia'||a.destinationAddress.toLowerCase()!==terms.recipient||a.amount!==BigInt(terms.units)||a.metadata!=='0x'||a.gasValue!==tinybars*10000000000n)throw Error('Axelar plugin transfer terms do not match the request.');
 // v1.0.1 encodes this argument in 18-decimal weibar. The deployed Hedera ITS
 // native ContractExecuteTransaction path requires tinybars (verified on-chain).
 // Only that ABI argument changes. Payable HBAR already uses the correct unit.
 const corrected=bridgeInterface.encodeFunctionData('interchainTransfer',[a.tokenId,a.destinationChain,a.destinationAddress,a.amount,a.metadata,tinybars]);
 if(corrected.toLowerCase()!==bridgeCalldata(terms.recipient,terms.units,tinybars).toLowerCase())throw Error('Bridge calldata validation failed.');
 return tx.setFunctionParameters(Buffer.from(corrected.slice(2),'hex')).setGas(1000000).setMaxTransactionFee(new Hbar(1));
}
