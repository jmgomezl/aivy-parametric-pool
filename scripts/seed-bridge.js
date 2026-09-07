if(!process.argv.includes('--execute'))throw Error('Operator testnet tool. Review the script and use --execute to authorize ledger operations.');
// Transfer only operator-owned test tokens to the dedicated Sepolia liquidity wallet.
import fs from 'node:fs';import {AccountAllowanceApproveTransaction,AccountId,ContractId,ContractExecuteTransaction,Hbar} from '@hiero-ledger/sdk';
import {client,NETWORK,operator} from '../src/config.js';
import {confirmBridgeDestination,bridgeGas,bridgeCalldata,ITS,ITS_ACCOUNT} from '../src/settlement/bridge.js';
const recipient='0x18c5E6987A734638403BBD942E17D959952B8e4e',file='.artifacts/bridge-seed-testnet.json',amountUnits=100000000;
if(NETWORK!=='testnet')throw Error('Testnet only.');let previous;
if(fs.existsSync(file)){
 previous=JSON.parse(fs.readFileSync(file));
 if(!process.argv.includes('--retry-failed-approval')||previous.bridgeTxId)throw Error('Seed bridge already journaled. Reconcile before another attempt.');
 const id=previous.approvalTxId.replace('@','-').replace(/\.(\d+)$/,'-$1');
 const response=await fetch('https://testnet.mirrornode.hedera.com/api/v1/transactions/'+id);
 if(!response.ok||(await response.json()).transactions?.[0]?.result!=='INVALID_ALLOWANCE_SPENDER_ID')throw Error('Approval failure not confirmed.');
}

const config=await confirmBridgeDestination(),gas=await bridgeGas(),c=client(),op=operator(),j={recipient,amountUnits,sourceToken:config.sourceTokenId,destinationToken:config.destinationToken,...(previous?{previous}: {})};
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2),{mode:0o600});
try{
 const approval=new AccountAllowanceApproveTransaction().approveTokenAllowance(config.sourceTokenId,op.id,AccountId.fromString(ITS_ACCOUNT),amountUnits).freezeWith(c);
 j.approvalTxId=approval.transactionId.toString();save();const sent=await approval.execute(c);await sent.getReceipt(c);
 const tx=new ContractExecuteTransaction().setContractId(ContractId.fromEvmAddress(0,0,ITS)).setGas(1200000).setFunctionParameters(Buffer.from(bridgeCalldata(recipient,amountUnits,gas).slice(2),'hex')).setPayableAmount(Hbar.fromTinybars(gas.toString())).setMaxTransactionFee(new Hbar(5)).freezeWith(c);
 j.bridgeTxId=tx.transactionId.toString();save();const bridged=await tx.execute(c);const receipt=await bridged.getReceipt(c);j.status=receipt.status.toString();save();console.log(JSON.stringify(j));
}finally{c.close();}
