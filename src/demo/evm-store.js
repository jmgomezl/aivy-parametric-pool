// Private, atomic journals for service-managed Sepolia demo wallets.
// All writes are synchronous; ledger work is serialized separately with file locks.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {digest} from './store.js';

export const EVM_LIMITS={walletsPerDay:30,walletsPerIp:3,actionsPerWalletDay:20,actionsPerDay:150,sponsorDailyWei:'25000000000000000',sponsorReserveWei:'5000000000000000',walletGasWei:'4000000000000000',transactionGasWei:'2000000000000000',starterTokenUnits:'100000',starterGasWei:'700000000000000'};
export const evmError=(status,message)=>Object.assign(Error(message),{status});
const checkId=id=>{if(!/^[a-f0-9]{64}$/.test(id))throw evmError(401,'Start your demo wallet.');};
export const checkRequest=id=>{if(typeof id!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(id))throw evmError(400,'Invalid operation identifier.');};
export function evmStore(directory=path.join(process.cwd(),'.artifacts')) {
  const file=path.join(directory,'evm-demo-testnet.json');
  function read(){try{const s=JSON.parse(fs.readFileSync(file,'utf8'));if(s.version!==1||!s.wallets||!s.allocations||!Array.isArray(s.admissions)||!Array.isArray(s.sponsorReservations))throw Error();return s;}catch(e){if(e.code==='ENOENT')return {version:1,wallets:{},allocations:{},admissions:[],sponsorReservations:[]};throw evmError(503,'Demo wallet journal needs operator review.');}}
  function save(s){fs.mkdirSync(directory,{recursive:true});const tmp=file+'.'+randomUUID();fs.writeFileSync(tmp,JSON.stringify(s),{mode:0o600});fs.renameSync(tmp,file);}
  function update(fn){
    fs.mkdirSync(directory,{recursive:true});const lock=path.join(directory,'evm-state.lock');let fd;
    try{fd=fs.openSync(lock,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw evmError(409,'Demo wallet journal is busy or needs recovery. Retry the same request.');throw e;}
    try{fs.writeFileSync(fd,JSON.stringify({pid:process.pid,at:Date.now()}));const s=read(),result=fn(s);save(s);return result;}finally{fs.closeSync(fd);fs.unlinkSync(lock);}
  }
  function addWallet(s,wallet,now){const id=randomUUID();return s.wallets[id]={id,address:wallet.address.toLowerCase(),privateKey:wallet.privateKey,status:'funding',at:now,steps:{},actions:[]};}
  function wallet(id){checkId(id);const s=read(),w=s.wallets[s.allocations[id]];if(!w)throw evmError(401,'Start your demo wallet.');return w;}
  return {directory,read,update,wallet,
    create(wallet,now=Date.now()) {return update(s=>addWallet(s,wallet,now));},
    allocate(id,ip,create,now=Date.now()){
      checkId(id);return update(s=>{if(s.allocations[id])return s.wallets[s.allocations[id]];
      const recent=s.admissions.filter(x=>now-x.at<86400000);
      if(recent.length>=EVM_LIMITS.walletsPerDay||recent.filter(x=>x.ip===digest(ip)).length>=EVM_LIMITS.walletsPerIp)throw evmError(429,'Demo starter limit reached. Reuse this browser’s existing wallet.');
      let w=Object.values(s.wallets).find(w=>w.status==='ready'&&!Object.values(s.allocations).includes(w.id));
      if(!w)w=addWallet(s,create(),now);
      s.allocations[id]=w.id;s.admissions=[...recent,{at:now,ip:digest(ip)}];return w;});
    },
    patch(walletId,fn){return update(s=>{const w=s.wallets[walletId];if(!w)throw Error('Missing wallet journal.');fn(w);return w;});},
    begin(id,requestId,quote,now=Date.now()){
      checkRequest(requestId);checkId(id);return update(s=>{const w=s.wallets[s.allocations[id]];if(!w||w.status!=='ready')throw evmError(409,'Wait for your demo wallet.');const old=w.actions.find(a=>a.requestId===requestId);
      if(old){if(old.quoteId!==quote.id)throw evmError(409,'This request already belongs to another operation.');return old;}
      if(w.actions.some(a=>a.quoteId===quote.id))throw evmError(409,'This quote already has an operation. Continue its original request.');
      if(w.actions.some(a=>a.status==='pending'))throw evmError(409,'Confirm the original operation before starting another.');
      const all=Object.values(s.wallets).flatMap(w=>w.actions);
      if(w.actions.filter(a=>now-a.at<86400000).length>=EVM_LIMITS.actionsPerWalletDay||all.filter(a=>now-a.at<86400000).length>=EVM_LIMITS.actionsPerDay)throw evmError(429,'Today’s demo action budget is used. Existing receipts remain available.');
      const a={requestId,quoteId:quote.id,kind:quote.kind,input:quote.input,limits:quote.limits,at:now,status:'pending',steps:{},message:'Preparing your transaction'};
      w.actions.push(a);return a;});
    },
    sponsorReserve(key,wei,now=Date.now()){
      return update(s=>{const old=s.sponsorReservations.find(r=>r.key===key);if(old&&BigInt(old.wei)>=BigInt(wei))return old;
        const used=s.sponsorReservations.filter(r=>now-r.at<86400000&&r.key!==key).reduce((n,r)=>n+BigInt(r.wei),0n);
        if(used+BigInt(wei)>BigInt(EVM_LIMITS.sponsorDailyWei))throw evmError(429,'Sponsored gas is at its daily limit. Your tokens and receipts are preserved.');
        if(old){old.wei=String(wei);old.at=now;return old;}
        const row={key,wei:String(wei),at:now};s.sponsorReservations.push(row);return row;
      });
    },
  };
}
