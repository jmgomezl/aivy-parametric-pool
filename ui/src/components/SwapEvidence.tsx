import bridge from '../../../docs/evidence/hak-axelar-plugin.json';
export const SWAP_PROOFS=[
 {label:'Hedera transfer',detail:'HAK Axelar plugin · 0.01 aUSDd',href:`https://hashscan.io/testnet/transaction/${bridge.sourceTransaction}`},
 {label:'Sepolia delivery',detail:'Axelar ITS · linked aUSDd received',href:`https://sepolia.etherscan.io/tx/${bridge.destinationTransaction}`},
 {label:'Uniswap swap',detail:'Trading API · aUSDd → test USDC',href:'https://sepolia.etherscan.io/tx/0xdcd06bd9aeb5a0fb33ac54aaf2f3b82f69e18ae554e76a3892fcbacaeb6420a6'},
];
export function SwapEvidence(){return <section className="swap-evidence" aria-label="Verified cross-chain examples"><div className="eyebrow">Verified examples · testnet</div>{SWAP_PROOFS.map(p=><a key={p.label} href={p.href} target="_blank" rel="noreferrer"><span><strong>{p.label}</strong><small>{p.detail}</small></span><span aria-hidden="true">↗</span></a>)}<small>Recorded transactions. Your own receipts appear with each action.</small></section>;}
