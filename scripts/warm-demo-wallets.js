// Operator-only: pre-fund at most three isolated Sepolia demo wallets.
// The dedicated sponsor identity is pinned inside createEvmDemo; never use a mainnet key.
import 'dotenv/config';
import {createEvmDemo} from '../src/demo/evm.js';
const args=process.argv.slice(2),countArg=args.find(a=>a.startsWith('--count='));
if(!args.includes('--execute')||args.some(a=>a!=='--execute'&&!/^--count=[1-3]$/.test(a))){console.error('Usage: node scripts/warm-demo-wallets.js --execute --count=3');process.exit(1);}
const service=createEvmDemo({network:'testnet'});
try {console.log(JSON.stringify(await service.warm(Number(countArg?.split('=')[1]??3))));}
catch(e){console.error(e.status?e.message:'Pre-funding interrupted. Re-run the same command to reconcile saved receipts.');process.exitCode=1;}
finally {await service.close();}
