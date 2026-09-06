type Signer = { name: string; signed: boolean | null };

/** Signature evidence, kept separate from the observed transfer outcome. */
export function SignatureGate({ agent, oracles, outcome, amount, asset, reason }: {
  agent: boolean | null; oracles: Signer[];
  outcome: 'Transferred' | 'Blocked' | 'Awaiting payout' | 'Cover ended' | 'Unable to verify';
  amount?: string; asset?: string; reason?: string;
}) {
  const signed = oracles.filter(o => o.signed === true).length;
  const known = oracles.length > 0 && oracles.every(o => o.signed !== null);
  const tone = outcome === 'Transferred' ? 'complete' : outcome === 'Blocked' ? 'blocked' : 'waiting';
  const mark = (value: boolean | null) => value === null ? '?' : value ? '✓' : '—';
  return <div className={`signature-gate signature-gate--${tone}`}>
    <div className={`signature-agent ${agent === true ? 'is-signed' : ''}`}>
      <span className="signature-mark" aria-hidden="true">{mark(agent)}</span>
      <span>Agent key<small>Required</small></span>
      <span className="signature-state">{agent === null ? 'Unknown' : agent ? 'Signed' : 'Missing'}</span>
    </div>
    <div className="signature-junction"><span>AND</span></div>
    <div className="signature-oracles">
      <div className="signature-threshold"><span>Oracle keys</span><span>{known ? `${signed} signed` : 'Unverified'} · 2 required</span></div>
      <div className="signature-key-grid">{oracles.map(o => <div key={o.name} className={o.signed === true ? 'is-signed' : ''}>
        <span className="signature-mark" aria-hidden="true">{mark(o.signed)}</span><span>{o.name}</span>
        <small>{o.signed === null ? 'Unknown' : o.signed ? 'Signed' : 'Not signed'}</small>
      </div>)}</div>
      {!oracles.length && <p className="signature-unavailable">Signer identities unavailable</p>}
    </div>
    <div className="signature-path" aria-hidden="true"><span>{tone === 'blocked' ? '×' : '↓'}</span></div>
    <div className="signature-result"><span>{outcome}</span>{amount && <strong className="num">{amount} <small>{asset}</small></strong>}{reason && <p>{reason}</p>}</div>
  </div>;
}
