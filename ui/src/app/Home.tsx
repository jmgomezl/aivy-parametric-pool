import { useCallback, useEffect, useState } from 'react';
import { PLACES, MODEL } from '../lib/hazard';
import { navigate, policyPath } from '../lib/router';
import { useAgent } from '../lib/store';
import { AtlasMap, type MapState, type Pin } from './AtlasMap';
import { QuotePanel } from './QuotePanel';

function readPin(): Pin | null {
  const m = /[?&]at=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(location.search);
  if (!m) return null;
  const lat = Number(m[1]), lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const name = new URLSearchParams(location.search).get('place') ?? undefined;
  return PLACES.find(p => p.lat === lat && p.lon === lon) ?? { lat, lon, name };
}

export function Home() {
  const a = useAgent();
  const [pin, setPinState] = useState<Pin | null>(readPin);
  const [budget, setBudget] = useState(4), [days, setDays] = useState(MODEL.days);
  const [map, setMap] = useState<MapState>({ hover: null, year: new Date().getUTCFullYear(), live: true, now: new Date(), minMag: 6, exploring: false });
  const setPin = useCallback((p: Pin | null) => {
    setPinState(p);
    const query = p ? new URLSearchParams({ at: `${p.lat},${p.lon}`, ...(p.name ? { place: p.name } : {}) }) : null;
    history.replaceState(null, '', query ? `/?${query}` : '/');
  }, []);
  useEffect(() => { const update = () => setPinState(readPin()); window.addEventListener('popstate', update); return () => window.removeEventListener('popstate', update); }, []);
  const markers = (a.policies ?? []).filter(p => p.state === 'active' || p.state === 'confirming').map(p => ({ lat: p.lat, lon: p.lon, label: p.place ?? `Policy ${p.serial}`, id: String(p.serial), tone: 'ok' as const }));
  return <div className={`cover-layout ${pin ? 'has-quote' : ''}`}>
    <div className="atlas-surface">
      <div className="atlas-intro"><div className="eyebrow">Ready before it happens</div><h1>Earthquake cover.<br /><span>Choose a place.</span></h1><p>A payout committed in advance. Released when two oracles confirm.</p></div>
      <AtlasMap days={days} pin={pin} onPin={setPin} onState={setMap} markers={markers} onMarker={id => navigate(policyPath(id))} />
    </div>
    {pin ? <QuotePanel key={`${pin.lat},${pin.lon}`} pin={pin} map={map} budget={budget} days={days} onBudget={setBudget} onDays={setDays} onClose={() => setPin(null)} /> : null}
  </div>;
}
