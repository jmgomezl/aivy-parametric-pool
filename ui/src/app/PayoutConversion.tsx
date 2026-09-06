import { useEffect, useState } from 'react';
import { conversionPath, conversionQuote, type ConversionQuote } from '../lib/agent';

/** A market quote, never an assertion that demo funds are redeemable. */
export function PayoutConversion({ usd }: { usd: number }) {
  const [open, setOpen] = useState(false), [chain, setChain] = useState(8453);
  const [refresh, setRefresh] = useState(0), [clock, setClock] = useState(Date.now());
  const [state, setState] = useState<{ quote?: ConversionQuote; error?: string }>({});
  const amount = Math.round(usd * 100) / 100;
  useEffect(() => {
    if (!open) return;
    let active = true;
    setState({});
    const timer = window.setTimeout(() => {
      conversionQuote(amount, chain).then(q => {
        if (active) { setState(q.ok ? { quote: q } : { error: q.message }); setClock(Date.now()); }
      }).catch(() => { if (active) setState({ error: 'Quote unavailable. Please retry.' }); });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [open, amount, chain, refresh]);
  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open]);
  if (!Number.isFinite(amount) || amount < .01 || amount > 1_000_000) return null;
  const q = state.quote;
  const expired = q ? clock >= Date.parse(q.expiresAt) : false;
  const eth = q ? Number(q.to.amount) / 10 ** q.to.decimals : null;
  return <details className="payout-conversion" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
    <summary><span>Payout in ETH?</span><span className="conversion-brand">Uniswap <span aria-hidden="true">↗</span></span></summary>
    {open ? <div className="conversion-body">
      <div className="conversion-top"><span>Mainnet · quote only</span><label><span className="sr-only">Quote network</span><select aria-label="Quote network" value={chain} onChange={e => setChain(Number(e.target.value))}><option value={8453}>Base</option><option value={130}>Unichain</option></select></label></div>
      <p className="conversion-context">If the modeled payout were held as USDC:</p>
      <div className="conversion-amounts" aria-live="polite"><div><strong>{amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong><span>USDC equivalent</span></div><span aria-hidden="true">→</span><div><strong>{eth === null ? '—' : '≈ ' + eth.toLocaleString(undefined, { maximumSignificantDigits: 6 })}</strong><span>ETH</span></div></div>
      <div className="conversion-status" role="status"><span>{state.error ? state.error : q ? expired ? 'Quote expired · refresh for current price' : `Quoted ${new Date(q.quotedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Requesting Uniswap price…'}</span>{q || state.error ? <button className="text-button" onClick={() => setRefresh(v => v + 1)}>{state.error ? 'Retry' : 'Refresh'} ↻</button> : null}</div>
      <p className="conversion-boundary">Demo tokens cannot be converted. No bridge or swap is executed.</p>
      {q ? <details className="conversion-proof"><summary>Verify Uniswap quote <span>+</span></summary><dl className="facts"><div><dt>Source</dt><dd>Uniswap Trading API</dd></div><div><dt>Network</dt><dd>{chain === 8453 ? 'Base' : 'Unichain'} mainnet</dd></div><div><dt>Approval / transaction</dt><dd>None</dd></div>{q.gasFeeUsd ? <div><dt>Estimated gas · extra</dt><dd>${Number(q.gasFeeUsd).toFixed(4)}</dd></div> : null}</dl><p>This prices the policy’s modeled USD amount as USDC on an EVM chain. It does not change the Hedera payout or redeem aUSDd.</p>{q.quoteId ? <p className="conversion-id">Quote ID · {q.quoteId}</p> : null}<a className="hs" href={conversionPath(amount, chain)} target="_blank" rel="noreferrer">Open latest API response & route ↗</a></details> : null}
    </div> : null}
  </details>;
}
