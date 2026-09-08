import {NetworkPath} from '../components/NetworkPath';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CATALOGUE, FIRST_YEAR, LAST_YEAR, PLACES, MODEL } from '../lib/hazard';
import { navigate, policyPath, onLink } from '../lib/router';
import { useAgent } from '../lib/store';
import { AtlasMap, type MapState, type Pin } from './AtlasMap';
import { QuotePanel } from './QuotePanel';
import { ExploreControls } from './ExploreControls';

function readPin(): Pin | null {
  const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(new URLSearchParams(location.search).get('at')??'');
  if (!m) return null;
  const lat = Number(m[1]), lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const name = new URLSearchParams(location.search).get('place') ?? undefined;
  return PLACES.find(p => p.lat === lat && p.lon === lon) ?? { lat, lon, name };
}

export function Home() {
  const a = useAgent();
  const layout = useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const element=layout.current!;
    // Measure the actual header, including wrapped navigation and onchain details.
    const measure=()=>{
      const top=element.getBoundingClientRect().top+window.scrollY;
      element.style.setProperty('--cover-viewport',`${Math.max(0,window.innerHeight-top)}px`);
    };
    const observer=new ResizeObserver(measure);
    element.closest('.app')?.querySelectorAll('.chrome,.chain-activity').forEach(node=>observer.observe(node));
    window.addEventListener('resize',measure);measure();
    return()=>{observer.disconnect();window.removeEventListener('resize',measure);};
  },[]);
  const [pin, setPinState] = useState<Pin | null>(readPin);
  const [exploring,setExploring]=useState(false);
  const [year,setYear]=useState(LAST_YEAR), [minMag,setMinMag]=useState(6), [playing,setPlaying]=useState(false);
  const [budget, setBudget] = useState(4), [days, setDays] = useState(MODEL.days);
  const map = useMemo<MapState>(()=>({ hover:null, year, live:year===LAST_YEAR, now:year===LAST_YEAR?new Date(CATALOGUE.fetchedAt):new Date(Date.UTC(year,11,31)), minMag, exploring }),[year,minMag,exploring]);
  const changeExploring = (value:boolean) => {
    setExploring(value);
    if (!value) {
      setYear(LAST_YEAR); setMinMag(6); setPlaying(false);
      requestAnimationFrame(()=>document.getElementById('explore-toggle')?.focus({preventScroll:true}));
    }
  };
  const chooseYear = (value:number) => { setPlaying(false); setYear(value); };
  useEffect(()=>{
    if (!playing) return;
    if (year===LAST_YEAR) { setPlaying(false); return; }
    const timer=window.setTimeout(()=>setYear(y=>Math.min(y+1,LAST_YEAR)),500);
    return()=>window.clearTimeout(timer);
  },[playing,year]);
  const setPin = useCallback((p: Pin | null) => {
    setPinState(p);
    const referral=new URLSearchParams(location.search).get('ref');
    const query = p ? new URLSearchParams({ ...(referral?{ref:referral}:{}), at: `${p.lat},${p.lon}`, ...(p.name ? { place: p.name } : {}) }) : null;
    history.replaceState(null, '', query ? `/?${query}` : referral?`/?ref=${encodeURIComponent(referral)}`:'/');
  }, []);
  useEffect(() => { const update = () => setPinState(readPin()); window.addEventListener('popstate', update); return () => window.removeEventListener('popstate', update); }, []);
  const markers = (a.policies ?? []).filter(p => p.state === 'active' || p.state === 'confirming').map(p => ({ lat: p.lat, lon: p.lon, label: p.place ?? `Policy ${p.serial}`, id: String(p.serial), tone: 'ok' as const }));
  const record = exploring ? <ExploreControls pin={pin} days={days} map={map} playing={playing} labelledBy={pin?'explore-toggle':undefined} onPlay={()=>{if(!playing&&map.live)setYear(FIRST_YEAR);setPlaying(!playing);}} onYear={chooseYear} onMagnitude={setMinMag} onClose={()=>changeExploring(false)}/> : null;
  const exploration = pin ? <div className="quote-explore"><button id="explore-toggle" className="quote-option" aria-expanded={exploring} aria-controls={exploring?'historical-exploration':undefined} onClick={()=>changeExploring(!exploring)}>Explore data <span aria-hidden="true">{exploring?'−':'+'}</span></button>{record}</div> : record;
  return <div ref={layout} className={`cover-layout ${pin ? 'has-quote' : ''} ${exploring ? 'is-exploring' : ''}`}>
    <div className="atlas-surface">
      <div className="atlas-intro"><div className="eyebrow">Ready before it happens</div><h1>Earthquake cover.<br /><span>Choose a place.</span></h1><p>A payout committed in advance. Released when two oracles confirm.</p><NetworkPath/><div className="journey-links"><a href="/policies?view=fund" onClick={onLink}>Fund the pool <span>↗</span></a><button className="text-button" onClick={()=>window.dispatchEvent(new Event('quorum:account'))}>Refer & earn <span aria-hidden="true">↗</span></button><a href="/story#1" onClick={onLink}>Watch payout <span>→</span></a></div></div>
      <AtlasMap map={map} onExploringChange={changeExploring} pin={pin} onPin={setPin} markers={markers} onMarker={id => navigate(policyPath(id))} />
    </div>
    {pin ? <QuotePanel key={`${pin.lat},${pin.lon}`} pin={pin} map={map} budget={budget} days={days} onBudget={setBudget} onDays={setDays} exploration={exploration} onReturnToCover={()=>changeExploring(false)} onClose={() => setPin(null)} /> : exploring ? <aside className="panel explore-panel" aria-label="Explore earthquake history">{exploration}</aside> : null}
  </div>;
}
