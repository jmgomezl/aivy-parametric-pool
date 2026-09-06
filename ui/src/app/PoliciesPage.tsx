// Every policy the agent has written on this network, newest first. The ones
// bought from this browser are marked; the demo is custodial, so "yours" means
// "issued from here".
import { useEffect, useState } from 'react';
import * as agent from '../lib/agent';
import { Pill } from '../components/ui';
import { placeName } from '../lib/hazard';
import { onLink, policyPath } from '../lib/router';
import { mine, useAgent } from '../lib/store';

const usd = (n: number, d = 2) => `$${n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));

export function PoliciesPage() {
  const a = useAgent();
  const [rows, setRows] = useState<agent.Policy[] | null>(null);
  useEffect(() => {
    if (!a.checked || !a.online) return;
    agent.policies().then((r) => setRows([...(r.policies ?? [])].sort((x, y) => Number(y.serial) - Number(x.serial)))).catch(() => setRows([]));
  }, [a.checked, a.online]);
  const my = new Set(mine());

  return (
    <div className="page">
      <div className="page-inner">
        <div className="flex items-end justify-between gap-[24px]">
          <div className="flex flex-col gap-[8px]">
            <div className="kicker">policies · Hedera {a.network}</div>
            <h1 className="title" style={{ fontSize: 44 }}>What the pool has promised.</h1>
          </div>
          {a.pool ? <div className="label num">{a.pool.livePolicies} live · {a.pool.committed.toLocaleString(undefined, { maximumFractionDigits: 0 })} {a.pool.asset.symbol} committed</div> : null}
        </div>

        {!a.checked ? <div className="label mt-[32px]">reaching the agent…</div>
        : !a.online ? <div className="mt-[32px] flex flex-col gap-[10px]"><Pill state="pending">agent offline</Pill><div className="label">Policies live in the agent's book. Start it with <span className="num">npm run serve</span>.</div></div>
        : rows === null ? <div className="label mt-[32px]">loading…</div>
        : rows.length === 0 ? <div className="label mt-[32px]">No policies yet. <a href="/" onClick={onLink} className="hs">Pin a place on the atlas<span className="arrow">→</span></a></div>
        : (
          <table className="mt-[28px] w-full border-collapse">
            <thead>
              <tr className="text-left">
                {['#', 'place', 'premium', 'cover', 'window', 'state', ''].map((h) => <th key={h} className="label pb-[10px] pr-[16px] font-normal border-b border-line">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const lapsed = !p.settled && new Date(p.lapsesAt).getTime() < Date.now();
                const state = p.settled ? 'paid' : lapsed ? 'lapsed' : 'awaiting quorum';
                const tone = p.settled ? 'ok' : lapsed ? 'refused' : 'pending';
                return (
                  <tr key={p.serial} className="border-b border-line hover:bg-bg-1 transition-colors">
                    <td className="num py-[12px] pr-[16px] text-fg-2">{p.serial}</td>
                    <td className="py-[12px] pr-[16px] text-fg-0">{placeName(p)}{my.has(String(p.serial)) ? <span className="label ml-[8px]">yours</span> : null}</td>
                    <td className="num py-[12px] pr-[16px]">{usd(p.premiumUsd)}</td>
                    <td className="num py-[12px] pr-[16px] text-ok">{usd(p.payoutUsd, 0)}</td>
                    <td className="num py-[12px] pr-[16px] text-fg-1">{lapsed || p.settled ? p.lapsesAt.slice(0, 10) : `${daysLeft(p.lapsesAt)} days left`}</td>
                    <td className="py-[12px] pr-[16px]"><Pill state={tone as 'ok' | 'refused' | 'pending'}>{state}</Pill></td>
                    <td className="py-[12px] text-right"><a href={policyPath(p.serial)} onClick={onLink} className="hs label">open<span className="arrow">→</span></a></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
