// The persistent frame: where you are, and what the underwriter owes.
import { Id } from '../components/ui';
import { onLink, type Route } from '../lib/router';
import { useAgent } from '../lib/store';

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: n >= 1000 ? 0 : 2 });

export function Chrome({ route }: { route: Route }) {
  const a = useAgent();
  const p = a.pool;
  const sym = p?.asset.symbol ?? '';
  const nav = [
    { href: '/', label: 'Atlas', on: route.name === 'home' },
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

      <div className="flex items-center gap-[26px] text-[14px]">
        {p ? (
          <div className="flex items-baseline gap-[22px]">
            <Vital label="capital" value={`${fmt(p.capital)} ${sym}`} />
            <Vital label="committed" value={`${fmt(p.committed)} ${sym}`} />
            <Vital label="headroom" value={`${fmt(p.headroom)} ${sym}`} tone={p.headroom > 0 ? 'ok' : 'refused'} />
            <Vital label="live policies" value={String(p.livePolicies)} />
          </div>
        ) : null}
        <span className="flex items-center gap-[8px] text-fg-2">
          <span className={`inline-block h-[7px] w-[7px] rounded-full ${!a.checked ? 'bg-fg-3' : a.online ? 'bg-ok' : 'bg-pending'}`} />
          {!a.checked ? 'agent' : a.online ? <>agent · Hedera {a.network}</> : <span className="text-pending">agent offline · frozen catalogue</span>}
        </span>
        {p ? <span className="text-fg-2">pool <Id kind="account" id={p.poolAccountId} size="sm" network={p.network} /></span> : null}
      </div>
    </header>
  );
}

function Vital({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'refused' }) {
  return (
    <span className="flex items-baseline gap-[8px]">
      <span className="label">{label}</span>
      <span className={`num text-[15px] ${tone === 'ok' ? 'text-ok' : tone === 'refused' ? 'text-refused' : 'text-fg-0'}`}>{value}</span>
    </span>
  );
}
