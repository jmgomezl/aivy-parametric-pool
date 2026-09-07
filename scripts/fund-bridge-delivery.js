if(!process.argv.includes('--execute'))throw Error('Operator testnet tool. Review the script and use --execute to authorize ledger operations.');
// Reconcile one known provisioning message and attach bounded gas by its exact log index.
import fs from 'node:fs';import {Interface} from 'ethers';
import {ContractId,ContractExecuteTransaction,Hbar} from '@hiero-ledger/sdk';
import {client,NETWORK,operator} from '../src/config.js';
if(NETWORK!=='testnet')throw Error('Testnet only.');
const file='.artifacts/axelar-bridge-testnet.json',j=JSON.parse(fs.readFileSync(file));
if(j.deliveryGas)throw Error('Delivery gas already submitted; do not duplicate.');
const id=j.steps.deployRemoteCanonicalInterchainToken.transaction.replace('@','-').replace(/\.(\d+)$/,'-$1');
const r=await fetch('https://testnet.mirrornode.hedera.com/api/v1/contracts/results/'+id);if(!r.ok)throw Error('Source receipt unavailable.');const receipt=await r.json();
if(receipt.result!=='SUCCESS')throw Error('Deployment source transaction not successful.');
const index=receipt.logs.find(l=>l.topics[0]==='0x30ae6cc78c27e651745bf2ad08a11de83910ac1e347a52f7ac898c0fbef94dae')?.index;
if(!Number.isInteger(index))throw Error('Gateway log index unavailable.');
const abi=new Interface(['function addNativeGas(bytes32 txHash,uint256 logIndex,address refundAddress) payable']);
const params=abi.encodeFunctionData('addNativeGas',[receipt.hash,index,'0x'+operator().id.toEvmAddress()]);
const c=client();try{
 const tx=new ContractExecuteTransaction().setContractId(ContractId.fromEvmAddress(0,0,'0xbE406F0189A0B4cf3A05C286473D23791Dd44Cc6')).setGas(300000).setFunctionParameters(Buffer.from(params.slice(2),'hex')).setPayableAmount(new Hbar(.3)).setMaxTransactionFee(new Hbar(5)).freezeWith(c);
 j.deliveryGas={transaction:tx.transactionId.toString(),sourceHash:receipt.hash,logIndex:index,hbar:.3,status:'PREPARED'};fs.writeFileSync(file,JSON.stringify(j,null,2),{mode:0o600});
 const sent=await tx.execute(c);const confirmed=await sent.getReceipt(c);j.deliveryGas.status=confirmed.status.toString();fs.writeFileSync(file,JSON.stringify(j,null,2),{mode:0o600});console.log(JSON.stringify(j.deliveryGas));
}finally{c.close();}
