// Home is the atlas. Pinning a place opens the quote beside it.
import { useCallback, useEffect, useState } from 'react';
import * as agent from '../lib/agent';
import { PLACES } from '../lib/hazard';
import { navigate, policyPath } from '../lib/router';
import { useAgent } from '../lib/store';
import { AtlasMap, type MapState, type Marker, type Pin } from './AtlasMap';
import { QuotePanel } from './QuotePanel';

function readPin(): Pin | null {
  const m = /[?&]at=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(location.search);
  if (!m) return null;
  const lat = Number(m[1]), lon = Number(m[2]);
  return PLACES.find((p) => p.lat === lat && p.lon === lon) ?? { lat, lon };
}

export function Home() {
  const a = useAgent();
  const [pin, setPinState] = useState<Pin | null>(readPin);
  const [map, setMap] = useState<MapState>({ hover: null, year: new Date().getUTCFullYear(), live: true, now: new Date(), minMag: 6 });
  const [policies, setPolicies] = useState<agent.Policy[]>([]);

  const setPin = useCallback((p: Pin | null) => {
    setPinState(p);
    history.replaceState(null, '', p ? `/?at=${p.lat},${p.lon}` : '/');
  }, []);

  const loadPolicies = useCallback(() => {
    if (!a.online) return;
    agent.policies().then((r) => setPolicies(r.policies ?? [])).catch(() => {});
  }, [a.online]);
  useEffect(loadPolicies, [loadPolicies]);

  const markers: Marker[] = policies
    .filter((p) => !p.settled && new Date(p.lapsesAt).getTime() > Date.now())
    .map((p) => ({ lat: p.lat, lon: p.lon, label: p.place ?? `#${p.serial}`, id: String(p.serial), tone: 'ok' as const }));

  return (
    <div className={`grid h-full min-h-0 ${pin ? 'grid-cols-[minmax(0,1fr)_440px]' : 'grid-cols-1'}`}>
      <div className="relative min-h-0">
        <AtlasMap
          pin={pin}
          onPin={setPin}
          onState={setMap}
          markers={markers}
          onMarker={(id) => navigate(policyPath(id))}
          hint={pin ? undefined : 'click anywhere for a quote'}
        />
      </div>
      {pin ? <QuotePanel key={`${pin.lat},${pin.lon}`} pin={pin} map={map} onClose={() => setPin(null)} onIssued={() => loadPolicies()} /> : null}
    </div>
  );
}
