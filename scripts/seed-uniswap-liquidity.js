if(!process.argv.includes('--execute'))throw Error('Operator testnet tool. Review the script and use --execute to authorize ledger operations.');
// Testnet-only demo market. Operator-funded liquidity is not a USD peg or redemption promise.
import 'dotenv/config';import fs from 'node:fs';import {Contract,JsonRpcProvider,Wallet,keccak256} from 'ethers';
import {createTestnetSwap,SWAP_USDC} from '../src/settlement/testnetSwap.js';
const TOKEN='0x5685B5660A86028d8a50C9e4Fc33fF081B3Cd9e9',MANAGER='0x1238536071E1c677A632429e3655c799b22cDA52',amount=90000000n;
const p=new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com',11155111,{staticNetwork:true}),k=JSON.parse(fs.readFileSync('.artifacts/sepolia-verification-wallet.json')),w=new Wallet(k.privateKey,p),file='.artifacts/uniswap-demo-liquidity.json';
if(k.chainId!==11155111)throw Error('Testnet verification wallet only.');
const j=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{chainId:11155111,token:TOKEN,usdc:SWAP_USDC,manager:MANAGER,steps:{}};
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2),{mode:0o600});
async function send(name,tx){
 if(j.steps[name]){const receipt=await p.getTransactionReceipt(j.steps[name].hash);if(receipt?.status===1)return receipt;throw Error(`${name} pending or failed. Reconcile ${j.steps[name].hash}`);}
 const gas=(await p.estimateGas({...tx,from:w.address}))*120n/100n,fee=(await p.getFeeData()).gasPrice*150n/100n;
 if(gas>(name==='create-pool'?8000000n:5000000n)||gas*fee>(name==='create-pool'?10000000000000000n:4000000000000000n))throw Error('Step exceeds gas budget.');
 const raw=await w.signTransaction({...tx,chainId:11155111,gasLimit:gas,gasPrice:fee,type:0,nonce:await p.getTransactionCount(w.address,'pending')});
 const hash=keccak256(raw);j.steps[name]={hash,raw,status:'SIGNED'};save();await p.broadcastTransaction(raw);j.steps[name].status='SUBMITTED';save();const r=await p.waitForTransaction(hash,1,45000);if(r?.status!==1)throw Error('Step not confirmed.');j.steps[name].status='CONFIRMED';save();console.log(name,hash);return r;
}
try{
 const abi=['function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)','function approve(address,uint256) returns(bool)','function decimals() view returns(uint8)'];
 const usdc=new Contract(SWAP_USDC,abi,w),token=new Contract(TOKEN,abi,w);
 if(await usdc.decimals()!==6n||await token.decimals()!==6n)throw Error('Unexpected token decimals.');
 if(await usdc.balanceOf(w.address)<amount){const q=await createTestnetSwap()({address:w.address,amountWei:'6000000000000000'});const{chainId,...tx}=q.transaction;await send('fund-usdc',tx);}
 if(await token.balanceOf(w.address)<amount||await usdc.balanceOf(w.address)<amount)throw Error('Seed balances insufficient.');
 for(const [name,c]of[['usdc',usdc],['ausdd',token]])if(await c.allowance(w.address,MANAGER)<amount)await send('approve-'+name,await c.approve.populateTransaction(MANAGER,amount));
 const manager=new Contract(MANAGER,['function createAndInitializePoolIfNecessary(address,address,uint24,uint160) payable returns(address)','function factory() view returns(address)','function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) payable returns(uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)'],w);
 await send('create-pool',await manager.createAndInitializePoolIfNecessary.populateTransaction(SWAP_USDC,TOKEN,3000,2n**96n));
 await send('mint-liquidity',await manager.mint.populateTransaction({token0:SWAP_USDC,token1:TOKEN,fee:3000,tickLower:-887220,tickUpper:887220,amount0Desired:amount,amount1Desired:amount,amount0Min:amount*99n/100n,amount1Min:amount*99n/100n,recipient:w.address,deadline:Math.floor(Date.now()/1000)+1200}));
 const factory=new Contract(await manager.factory(),['function getPool(address,address,uint24) view returns(address)'],p);j.pool=await factory.getPool(SWAP_USDC,TOKEN,3000);j.status='READY';save();console.log({pool:j.pool,status:j.status});
}finally{p.destroy();}
