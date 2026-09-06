import { ChainActivity } from './ChainActivity';
import { Id } from '../components/ui';
import { onLink, type Route } from '../lib/router';
import { useAgent } from '../lib/store';

const number = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

export function Chrome({ route }: { route: Route }) {
  const a = useAgent(), p = a.pool;
  const used = p && p.capital > 0 ? Math.min(100, Math.max(0, p.committed / p.capital * 100)) : 0;
  return <><a className="skip-content" href="#main-content" onClick={e=>{e.preventDefault();document.getElementById('main-content')?.focus();}}>Skip to content</a><header className="chrome">
    <a href="/" onClick={onLink} className="brand" aria-label="Aivy Quorum home"><span className="brand-mark" aria-hidden="true">◉</span> Aivy Quorum<span className="brand-caption">earthquake cover</span></a>
    <nav aria-label="Main navigation" className="main-nav">
      {[['/', 'Cover', route.name === 'home'], ['/policies', 'Policies', route.name === 'policies' || route.name === 'policy'], ['/story', 'How it works', route.name === 'story']].map(([href, label, active]) => <a key={String(href)} href={String(href)} onClick={onLink} className={`navlink ${active ? 'navlink-on' : ''}`} aria-current={active ? 'page' : undefined}>{label}</a>)}
    </nav>
    <div className="chrome-status">
      <span className={`network-label ${a.checked && !a.online ? 'text-pending' : ''}`}><span className={`status-dot ${a.online ? 'bg-ok' : 'bg-pending'}`} />{route.name==='story'?'Mainnet recording':!a.checked ? 'Connecting' : !a.online ? 'Estimates only' : `${a.network === 'testnet' ? 'Testnet demo' : 'Mainnet · read only'}`}</span>
      {p && route.name!=='story' ? <details className="pool-summary">
        <summary><span className="capacity-mini"><span style={{ width: `${used}%` }} /></span><span>Pool capacity</span></summary>
        <div className="pool-popover">
          <div className="eyebrow">Pool · {p.asset.symbol}</div>
          <dl className="facts"><div><dt>Total</dt><dd>{number(p.capital)}</dd></div><div><dt>Committed</dt><dd>{number(p.committed)}</dd></div><div><dt>Available</dt><dd>{number(p.headroom)}</dd></div><div><dt>Active policies</dt><dd>{p.livePolicies}</dd></div></dl>
          <Id kind="account" id={p.poolAccountId} size="sm" network={p.network} />
          <small>{a.poolAt ? `Updated ${new Date(a.poolAt).toLocaleTimeString()}` : 'Reading unavailable'}{!a.online ? ' · last known values' : ''}</small>
        </div>
      </details> : null}
    </div>
  </header><ChainActivity serial={route.name==='policy'?route.serial:undefined} story={route.name==='story'}/></>;
}
