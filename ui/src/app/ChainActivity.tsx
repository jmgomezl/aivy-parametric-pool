import { useEffect, useId, useState } from 'react';
import { useAgent } from '../lib/store';
import { activity, type Network, type PaymentReceipt, type Policy } from '../lib/agent';
import { hashscan, hsNft, hsPointer } from '../lib/hashscan';
import { data } from '../data';

type Proof = { label: string; why: string; href: string; state?: string };
function Receipt({ proof, network }: { proof: Proof; network: Network }) {
  return <div className="chain-receipt"><details><summary><span className={`chain-network chain-${network}`}>{network}</span><span>{proof.label}</span><small>{proof.state ?? 'Recorded'}</small></summary><p>{proof.why}</p></details><a href={proof.href} target="_blank" rel="noreferrer" aria-label={`Verify ${proof.label} on ${network}`} title={`Open ${network} proof`}>↗</a></div>;
}
function policyProofs(p: Policy, network: Network, token?: string): Proof[] {
  const tx = (id: string) => hashscan('transaction', id, network);
  const schedule = hashscan('schedule', p.scheduleId, network);
  const proofs: Proof[] = [
    ...(p.receipts?.mint ? [{ label: 'Cover NFT minted', why: 'The agent minted a policy NFT whose metadata points to the recorded cover terms.', href: tx(p.receipts.mint) }] : token ? [{ label: `Cover NFT #${p.serial}`, why: 'This is the issued policy NFT on Hedera. The illustrated card is its app presentation; the LP preview is not minted.', href: hsNft(token, Number(p.serial), network) }] : []),
    ...(p.receipts?.delivery ? [{ label: 'NFT delivered', why: 'The NFT was transferred to the demo beneficiary.', href: tx(p.receipts.delivery) }] : []),
    { label: 'Premium transferred', why: `The agent submitted the premium transfer in ${p.asset ?? 'HBAR'}.${p.brokerId ? ' Pool and broker received their shares atomically.' : ' This policy has no broker leg.'} Testnet assets have no cash value.`, href: tx(p.saleTxId) },
    { label: 'Policy terms published', why: 'The location, trigger and payout terms were written to Hedera Consensus Service.', href: hsPointer(p.termsPointer, network) },
    { label: 'Agent committed payout', why: 'A scheduled transfer fixes the beneficiary and amount. The agent signature is verified separately from the oracle quorum.', href: schedule, state: p.ledger?.available ? p.ledger.agentSigned ? 'Signed' : 'Not signed' : 'Unverified' },
    { label: 'Oracle approvals', why: 'These are schedule signatures, not token spending allowances. Event checks are manually requested in this demo; the agent and two oracle keys must sign.', href: schedule, state: p.ledger?.available ? `${p.ledger.oracles.filter(o => o.signed).length}/2 signed` : 'Unverified' },
  ];
  if (p.receipts?.freeze) proofs.push({ label: 'NFT transfer lock', why: 'The beneficiary’s policy token was frozen because the scheduled payout destination cannot follow a resale.', href: tx(p.receipts.freeze) });
  if (p.state === 'paid' && p.ledger?.executedAt) proofs.push({ label: 'Payout executed', why: 'Hedera executed the scheduled transfer after the required signatures arrived.', href: schedule, state: 'Executed' });
  return proofs;
}
const mainnetProofs: Proof[] = [
  { label: 'Cover NFT minted', why: 'An actual mainnet NFT was minted in the recorded demonstration.', href: hashscan('transaction', data.policy.mintTxId, 'mainnet') },
  { label: 'NFT delivered', why: 'The mainnet policy NFT was transferred to the buyer.', href: hashscan('transaction', data.policy.deliverTxId, 'mainnet') },
  { label: 'NFT transfer lock', why: 'The policy token was frozen against resale because its payout destination is fixed.', href: hashscan('transaction', data.policy.freezeTxId, 'mainnet') },
  { label: 'Premium split', why: 'The recorded mainnet premium moved in one transaction: 85% to the pool and 15% to the broker.', href: hashscan('transaction', data.sale.consensus, 'mainnet') },
  { label: 'Agent signature', why: 'The agent created and signed the fixed payout schedule.', href: hashscan('transaction', data.payout.createTxId, 'mainnet') },
  ...data.payout.signatures.filter(s => s.role === 'oracle').map(s => ({ label: `${s.name} signature`, why: 'A controlled oracle signature from the recorded run. This proves the key mechanism, not independent oracle operators or detection of a real insured event.', href: hashscan('transaction', s.consensus, 'mainnet') })),
  { label: '4 HBAR released', why: 'Real HBAR moved on mainnet when the quorum completed. The record demonstrates settlement; live cover creation remains on testnet.', href: hashscan('transaction', data.payout.executedConsensus!, 'mainnet'), state: 'Executed' },
];

export function ChainActivity({ serial, story = false }: { serial?: string; story?: boolean }) {
  const a = useAgent(), id = useId();
  const [open, setOpen] = useState(false), [tab, setTab] = useState<'live' | 'mainnet' | 'x402'>(story ? 'mainnet' : 'live');
  const [selected, setSelected] = useState('');
  const [payments, setPayments] = useState<PaymentReceipt[]>([]), [paymentState, setPaymentState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [checkedAt, setCheckedAt] = useState('');
  const policies = [...(a.policies ?? [])].sort((x, y) => Number(y.serial) - Number(x.serial));
  const p = serial ? policies.find(p => String(p.serial) === serial) : policies.find(p => String(p.serial) === selected) ?? policies[0];
  useEffect(() => { setSelected(''); setTab(story ? 'mainnet' : 'live'); }, [serial, story]);
  useEffect(() => {
    if (!open || tab !== 'x402') return;
    let live = true;
    const update = async () => { try { const r = await activity(); if (!Array.isArray(r.payments)) throw new Error(); if (live) { setPayments(r.payments); setCheckedAt(r.checkedAt); setPaymentState('ready'); } } catch { if (live) setPaymentState('error'); } };
    void update(); const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void update(); }, 10000);
    return () => { live = false; window.clearInterval(timer); };
  }, [open, tab]);
  const proofs = p ? policyProofs(p, a.network, a.pool?.policyTokenId) : [];
  return <section className="chain-activity" aria-label="Blockchain activity">
    <button className="chain-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><span className="chain-toggle-title"><span aria-hidden="true">◈</span> Onchain <span className="chain-scope">{story ? 'Mainnet · recorded settlement' : p ? `${!a.online ? 'Last known' : a.network === 'testnet' ? 'Testnet' : 'Mainnet'} · Policy #${p.serial} · ${p.ledger?.available ? p.state === 'paid' ? 'Paid' : `${p.ledger.oracles.filter(o=>o.signed).length}/2 oracle signatures` : 'Proofs available'}` : serial ? `Policy #${serial} · receipts unavailable` : 'Testnet + mainnet proofs'}</span></span><span>{open ? 'Close −' : 'Verify ↗'}</span></button>
    {open ? <div id={id} className="chain-panel">
      <div className="chain-tabs" role="group" aria-label="Evidence source">{([['live','Live cover'],['mainnet','Mainnet record'],['x402','x402']] as const).map(([value,label]) => <button key={value} aria-pressed={tab===value} onClick={()=>setTab(value)}>{label}</button>)}</div>
      {tab === 'live' ? <>
        <div className="chain-context"><p><strong>{a.network === 'testnet' ? 'Testnet' : 'Mainnet'}</strong> · {a.online ? 'Current policy records' : 'Last available records'}</p>{p && !serial ? <label>Policy <select aria-label="Policy to verify" value={p.serial} onChange={e=>setSelected(e.target.value)}>{policies.map(p=><option key={p.serial} value={p.serial}>#{p.serial} · {p.place ?? 'Earthquake cover'}</option>)}</select></label> : null}</div>
        {a.policiesError ? <p className="chain-note" role="status">{a.policiesError}</p> : null}
        {proofs.length ? <div className="chain-receipts">{proofs.map(proof=><Receipt key={proof.label} proof={proof} network={a.network}/>)}</div> : <p className="chain-note">{a.checked ? serial ? 'No receipts available for this policy.' : 'No policy receipts available yet.' : 'Reading policy records…'}</p>}
        <p className="chain-note">Quote & risk checks: offchain. Cover issuance: onchain. LP preview: not minted.</p>
        {p?.ledger?.checkedAt ? <small className="chain-freshness">Signatures checked {new Date(p.ledger.checkedAt).toLocaleTimeString()}</small> : null}
      </> : tab === 'mainnet' ? <>
        <div className="chain-context"><p><strong>Mainnet</strong> · Recorded {new Date(data.runCreatedAt).toLocaleDateString()}</p></div>
        <p className="chain-note">Mainnet proves real-value settlement. Testnet keeps the live demo free. These receipts are from a controlled recording.</p>
        <div className="chain-receipts">{mainnetProofs.map(proof=><Receipt key={proof.label} proof={proof} network="mainnet"/>)}</div>
      </> : <>
        <div className="chain-context"><p><strong>Testnet</strong> · Self-hosted x402 facilitator</p></div>
        <div className="chain-payment-flow" aria-label="x402 payment flow"><span>402 request</span><i>→</i><span>Onchain payment</span><i>→</i><span>Oracle response</span></div>
        <p className="chain-note">HTTP requests and payment checks run offchain. The payment settles on Hedera before the oracle serves the result.</p>
        {paymentState === 'error' ? <p className="chain-note" role="status">Receipt updates unavailable. {payments.length ? 'Showing the last available records.' : 'No payment status can be confirmed.'}</p> : null}
        {payments.length ? <div className="chain-receipts">{payments.map(r=><Receipt key={r.transaction} network={r.network} proof={{label:r.asset==='0.0.10374011'&&a.pool?.asset.tokenId===r.asset?`Oracle payment · ${(Number(r.amount)/1e6).toLocaleString(undefined,{maximumFractionDigits:6})} ${a.pool.asset.symbol}`:'Oracle payment settled',state:'Settled',href:hashscan('transaction',r.transaction,r.network),why:`${r.amount} base units of ${r.asset} for ${r.resource}. Recorded ${new Date(r.at).toLocaleString()}. A payment receipt alone does not prove that an oracle approved a payout.`}}/>)}</div> : paymentState !== 'error' ? <p className="chain-note">{paymentState==='loading'?'Reading payment receipts…':'No receipts recorded since activity tracking was enabled.'}</p> : null}
        <details className="chain-mainnet-x402"><summary><span className="chain-network chain-mainnet">mainnet</span> Public mainnet facilitator</summary><p><a href="https://api.blocky402.com/supported" target="_blank" rel="noreferrer">Blocky’s public facilitator ↗</a> advertises Hedera mainnet only (checked September 6, 2026). This deployment uses its own testnet facilitator. No Blocky mainnet payment is claimed here.</p></details>
        {checkedAt ? <small className="chain-freshness">Receipt journal checked {new Date(checkedAt).toLocaleTimeString()}</small> : null}
      </>}
    </div> : null}
  </section>;
}
