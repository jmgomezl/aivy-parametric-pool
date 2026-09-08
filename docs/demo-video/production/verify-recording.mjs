// Read-only: independently check the operations used by this recording.
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {JsonRpcProvider} from 'ethers';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ids={
 premium:'0.0.7231440@1788901774.667959908',
 nftMint:'0.0.7231440@1788901774.912603251',
 nftDelivery:'0.0.7231440@1788901777.829385744',
 usgs:'0.0.7162784@1788901935.694660044',
 emsc:'0.0.7162784@1788901942.664807886',
 geofon:'0.0.7162784@1788901945.581906620',
 deposit:'0.0.7231440@1788902010.615613885',
 bridgeSource:'0.0.10408125@1788901876.614054576'
};
const txSlug=id=>id.replace('@','-').replace(/\.(\d+)$/,'-$1');
const rows=await Promise.all(Object.entries(ids).map(async([role,id])=>{
 const url='https://testnet.mirrornode.hedera.com/api/v1/transactions/'+txSlug(id);
 const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`${role}: mirror HTTP ${r.status}`);
 const j=await r.json(),tx=j.transactions.find(t=>t.result==='SUCCESS');if(!tx)throw Error(role+' has no successful receipt.');
 return{role,id,status:tx.result,type:tx.name,consensusTimestamp:tx.consensus_timestamp,tokenTransfers:tx.token_transfers,nftTransfers:tx.nft_transfers,hbarTransfers:tx.transfers,explorer:'https://hashscan.io/testnet/transaction/'+txSlug(id),source:url};
}));
for(const role of ['usgs','emsc','geofon']){const row=rows.find(r=>r.role===role);if(row.tokenTransfers.filter(t=>t.token_id==='0.0.10374011'&&t.amount===1000).length!==1)throw Error('Wrong paid oracle amount.');}
const dep=rows.find(r=>r.role==='deposit');if(!dep.tokenTransfers.some(t=>t.token_id==='0.0.10374011'&&t.account==='0.0.10373722'&&t.amount===25000000))throw Error('Deposit amount mismatch.');if(!dep.tokenTransfers.some(t=>t.token_id==='0.0.10373724'&&t.account==='0.0.10408125'&&t.amount===2500000000))throw Error('ARPS transfer mismatch.');
const provider=new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com',11155111,{staticNetwork:true});
let evm;
try{const receipt=await provider.getTransactionReceipt('0x2676ea1b5b9ee1b571c94a3e9b0d1ea6996a50fa08a05199c7b0b502145c389c');if(receipt?.status!==1)throw Error('Swap not successful.');evm={hash:receipt.hash,status:receipt.status,blockNumber:receipt.blockNumber,from:receipt.from,to:receipt.to,gasUsed:String(receipt.gasUsed),explorer:'https://sepolia.etherscan.io/tx/'+receipt.hash};}finally{provider.destroy();}
const evidence={checkedAt:new Date().toISOString(),scope:'Video recording on September 8, 2026; all new writes are testnet only.',policy:{serial:33,schedule:'0.0.10427620',premium:4,payout:559.519216,asset:'aUSDd',place:'Medellín, Colombia',terms:'hcs://0.0.10373727/61'},oracleOutcome:'Three no-match catalogue results; no oracle signature or payout.',hedera:rows,swap:evm,sourceOfSwapTokens:'Previously bridged sponsor starter inventory, not attributed to this new 0.01 source transfer.',bridgeDeliveryAtCapture:'Pending; source confirmation is the only new bridge outcome shown.',mainnet:{date:'2026-09-04',scope:'Separate controlled signature recording, not a live earthquake claim.',amountHbar:4,receipt:'https://hashscan.io/mainnet/transaction/1788563478.715401105',blockedSchedule:'https://hashscan.io/mainnet/schedule/0.0.10843725'}};
await fs.writeFile(path.join(root,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({hederaConfirmed:rows.length,oraclePayments:3,deposit:25,receivedARPS:25,swapStatus:evm.status,bridgeDelivery:evidence.bridgeDeliveryAtCapture}));
