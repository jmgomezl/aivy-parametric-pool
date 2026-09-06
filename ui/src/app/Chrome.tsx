// The persistent frame: where you are, and what the underwriter owes.
import { Id } from '../components/ui';
import { onLink, type Route } from '../lib/router';
import { useAgent } from '../lib/store';

const fmt = (n: number | undefined) => (typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: n >= 1000 ? 0 : 2 }) : '—');

export function Chrome({ route }: { route: Route }) {
  const a = useAgent();
  const p = a.pool;
  const nav = [
    { href: '/', label: 'Map', on: route.name === 'home' },
    { href: '/policies', label: 'Policies', on: route.name === 'policies' || route.name === 'policy' },
    { href: '/story', label: 'Story', on: false },
  ];
  return (
    <header className="chrome">
      <div className="flex items-center gap-[26px]">
        <a href="/" onClick={onLink} className="text-[16px] font-medium tracking-[-0.01em] text-fg-0">Aivy Parametric Pool</a>
        <nav className="flex items-center gap-[18px]">
          {nav.map((n) => (
            <a key={n.href} href={n.href} onClick={onLink} className={`navlink ${n.on ? 'navlink-on' : ''}`}>{n.label}</a>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-[22px] text-[14px]">
        {p ? (
          <span className="flex items-baseline gap-[16px]" title="what the pool holds, what it has promised, and what it can still promise">
            <span className="label">pool</span>
            <Vital label="holds" value={`${fmt(p.capital)} ${p.asset?.symbol ?? ''}`} />
            <Vital label="promised" value={fmt(p.committed)} />
            <Vital label="can still promise" value={fmt(p.headroom)} tone={(p.headroom ?? 0) > 0 ? 'ok' : 'refused'} />
            <Vital label="live" value={String(p.livePolicies ?? '—')} />
          </span>
        ) : null}
        <span className="flex items-center gap-[8px] text-fg-2">
          <span className={`inline-block h-[7px] w-[7px] rounded-full ${!a.checked ? 'bg-fg-3' : a.online ? 'bg-ok' : 'bg-pending'}`} />
          {!a.checked ? 'agent' : a.online ? <>agent · Hedera {a.network}</> : <span className="text-pending">agent offline · estimates only</span>}
        </span>
        {p ? <Id kind="account" id={p.poolAccountId} size="sm" network={p.network} /> : null}
        {route.name === 'home' ? (
          <button type="button" className="icon-btn" title="what is this?" onClick={() => window.dispatchEvent(new Event('aivy:help'))}><span className="mono text-[13px]">?</span></button>
        ) : null}
      </div>
    </header>
  );
}

function Vital({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'refused' }) {
  return (
    <span className="flex items-baseline gap-[6px]">
      <span className="label">{label}</span>
      <span className={`num text-[15px] ${tone === 'ok' ? 'text-ok' : tone === 'refused' ? 'text-refused' : 'text-fg-0'}`}>{value}</span>
    </span>
  );
}
