// Home is the atlas. Pinning a place opens the quote beside it.
import { useCallback, useEffect, useState } from 'react';
import * as agent from '../lib/agent';
import { MODEL, PLACES, coverForBudget } from '../lib/hazard';
import { navigate, onLink, policyPath } from '../lib/router';
import { useAgent } from '../lib/store';
import { AtlasMap, type MapState, type Marker, type Pin } from './AtlasMap';
import { QuotePanel } from './QuotePanel';

const WELCOME_KEY = 'aivy.welcomed';
const usd0 = (n: number) => `$${Math.round(n).toLocaleString()}`;

function readPin(): Pin | null {
  const m = /[?&]at=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(location.search);
  if (!m) return null;
  const lat = Number(m[1]), lon = Number(m[2]);
  return PLACES.find((p) => p.lat === lat && p.lon === lon) ?? { lat, lon };
}

export function Home() {
  const a = useAgent();
  const [pin, setPinState] = useState<Pin | null>(readPin);
  const [budget, setBudget] = useState(4);
  const [days, setDays] = useState(MODEL.days);
  const [map, setMap] = useState<MapState>({ hover: null, year: new Date().getUTCFullYear(), live: true, now: new Date(), minMag: 6 });
  const [policies, setPolicies] = useState<agent.Policy[]>([]);
  const [welcome, setWelcome] = useState<boolean>(() => { try { return !pin && localStorage.getItem(WELCOME_KEY) !== '1'; } catch { return !pin; } });

  const setPin = useCallback((p: Pin | null) => {
    setPinState(p);
    history.replaceState(null, '', p ? `/?at=${p.lat},${p.lon}` : '/');
    if (p) { setWelcome(false); try { localStorage.setItem(WELCOME_KEY, '1'); } catch { /* fine */ } }
  }, []);

  const loadPolicies = useCallback(() => {
    if (!a.online) return;
    agent.policies().then((r) => setPolicies(r.policies ?? [])).catch(() => {});
  }, [a.online]);
  useEffect(loadPolicies, [loadPolicies]);

  // "?" in the header reopens the welcome
  useEffect(() => {
    const open = () => setWelcome(true);
    window.addEventListener('aivy:help', open);
    return () => window.removeEventListener('aivy:help', open);
  }, []);

  const markers: Marker[] = policies
    .filter((p) => !p.settled && new Date(p.lapsesAt).getTime() > Date.now())
    .map((p) => ({ lat: p.lat, lon: p.lon, label: p.place ?? `#${p.serial}`, id: String(p.serial), tone: 'ok' as const }));

  // what the cursor would buy, from the same model the agent runs — instant, no request
  const preview = useCallback((lat: number, lon: number) => {
    const { coverHbar, priced } = coverForBudget(lat, lon, budget, { now: map.now, minMag: map.minMag, days });
    if (!priced.count) return { text: 'nothing to insure here', tone: 'dim' as const };
    return { text: `$${budget} → ${usd0(coverHbar)} · ${days} days`, tone: 'ok' as const };
  }, [budget, days, map.now, map.minMag]);

  return (
    <div className={`grid h-full min-h-0 ${pin ? 'grid-cols-[minmax(0,1fr)_440px]' : 'grid-cols-1'}`}>
      <div className="relative min-h-0">
        <AtlasMap pin={pin} onPin={setPin} onState={setMap} markers={markers} onMarker={(id) => navigate(policyPath(id))} preview={preview} hint={pin ? undefined : 'click anywhere to price it'} />
        {welcome ? (
          <div className="welcome-veil" onClick={() => setWelcome(false)}>
            <div className="welcome" onClick={(e) => e.stopPropagation()}>
              <div className="kicker">earthquake cover · priced by an agent</div>
              <h1 className="title" style={{ fontSize: 40 }}>Pick a place. See what $4 buys. Protect it in one press.</h1>
              <p className="text-[16px] leading-[1.5] text-fg-1">
                Every glow is a recorded M6+ earthquake since 1970. Move over the map to see the price anywhere on Earth; click to get the agent's quote. If the ground moves, the payout is already signed and waiting.
              </p>
              <div className="flex flex-wrap items-center gap-[12px]">
                <button type="button" className="buy" style={{ width: 'auto' }} onClick={() => setPin(PLACES[0])}><span>Try Armenia, Colombia</span><span className="num">→</span></button>
                <button type="button" className="chip" onClick={() => setWelcome(false)}>or click anywhere on the map</button>
              </div>
              <div className="label">Hedera testnet · quotes are free, one press writes a real policy · <a href="/story" onClick={onLink} className="hs">the mainnet story<span className="arrow">→</span></a></div>
            </div>
          </div>
        ) : null}
      </div>
      {pin ? (
        <QuotePanel key={`${pin.lat},${pin.lon}`} pin={pin} map={map} budget={budget} days={days} onBudget={setBudget} onDays={setDays} onClose={() => setPin(null)} onIssued={() => loadPolicies()} />
      ) : null}
    </div>
  );
}
