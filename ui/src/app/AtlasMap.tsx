import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { findPlaces } from '../lib/agent';
import { History } from './History';
import capitalsData from '../data/capitals.json';
import { CATALOGUE, FIRST_YEAR, LAST_YEAR, MODEL, PLACES, dayOf, placeName } from '../lib/hazard';
import { Heat } from '../beats/atlas/Heat';
import { landPath } from '../beats/atlas/land';
import { H, HOME, W, base, clampView, kmToPxX, kmToPxY, pan, project, unproject, zoomAt, type View } from '../beats/atlas/projection';

export interface Pin { lat: number; lon: number; name?: string }
export interface MapState { hover: Pin | null; year: number; live: boolean; now: Date; minMag: number; exploring: boolean }
export interface Marker { lat: number; lon: number; label: string; id: string; tone?: 'ok' | 'pending' | 'neutral' }
const normalize = (v:string) => v.normalize('NFD').replace(/(\p{Script=Latin})\p{M}+/gu,'$1').normalize('NFC').toLocaleLowerCase().trim();
const coordinatePattern = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;
const cities = [{name:'Medellín, Antioquia, Colombia',lat:6.2443382,lon:-75.573553}, ...PLACES, ...capitalsData.rows.map(([name, country, lon, lat]) => ({ name: `${name}, ${country}`, lat: Number(lat), lon: Number(lon) }))];

export function AtlasMap({ pin, onPin, onState, markers = [], onMarker, days = MODEL.days }: {
  pin: Pin | null; onPin: (p: Pin) => void; onState?: (s: MapState) => void;
  markers?: Marker[]; onMarker?: (id: string) => void; days?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>(HOME);
  const [year, setYear] = useState(LAST_YEAR), [minMag, setMinMag] = useState(6);
  const [playing, setPlaying] = useState(false), [exploring, setExploring] = useState(false);
  const [search, setSearch] = useState(''), [searching, setSearching] = useState(false);
  const resultId=useId();
  const [searchRetry,setSearchRetry]=useState(0);
  const [activeResult,setActiveResult]=useState(-1);
  const [remote,setRemote]=useState<{query:string;rows:Pin[];status:'loading'|'ready'|'error'}>({query:'',rows:[],status:'ready'});
  useEffect(()=>{
    const q=search.trim();
    if(!searching||q.length<2||coordinatePattern.test(q))return;
    const controller=new AbortController();
    setRemote({query:q,rows:[],status:'loading'});
    const timer=window.setTimeout(()=>{void findPlaces(q,controller.signal).then(rows=>{if(!controller.signal.aborted){setRemote({query:q,rows,status:'ready'});setActiveResult(-1);}}).catch(()=>{if(!controller.signal.aborted)setRemote({query:q,rows:[],status:'error'});});},500);
    return()=>{controller.abort();window.clearTimeout(timer);};
  },[search,searching,searchRetry]);
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null);
  const live = year === LAST_YEAR;
  const now = useMemo(() => live ? new Date(CATALOGUE.fetchedAt) : new Date(Date.UTC(year, 11, 31)), [year, live]);
  useEffect(() => { onState?.({ hover: null, year, live, now, minMag, exploring }); }, [year, live, now, minMag, exploring, onState]);
  useEffect(() => {
    if (!pin) { setView(HOME); return; }
    const point = base(pin.lon, pin.lat), k = 5;
    setView(clampView({ k, x: point.x - W / k / 2, y: point.y - H / k / 2 }));
  }, [pin?.lat, pin?.lon]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setYear(y => { if (y >= LAST_YEAR) { setPlaying(false); return y; } return y + 1; }), 500);
    return () => clearInterval(timer);
  }, [playing]);
  const xy = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!, point = svg.createSVGPoint(); point.x = e.clientX; point.y = e.clientY;
    return point.matrixTransform(svg.getScreenCTM()!.inverse());
  };
  const wheel = useCallback((e: WheelEvent) => {
    // Page scrolling stays native; zoom has explicit accessible controls.
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault(); const point = xy(e); setView(v => zoomAt(v, point.x, point.y, Math.exp(-e.deltaY * 0.0016)));
  }, []);
  useEffect(() => { const el = svgRef.current!; el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel); }, [wheel]);
  const closeExplore = () => { setExploring(false); setYear(LAST_YEAR); setMinMag(6); setPlaying(false); };
  const choose = (p: Pin) => { onPin(p); setSearch(''); setSearching(false); };
  const results = useMemo(() => {
    const coordinate=coordinatePattern.exec(search);
    if(coordinate){const lat=Number(coordinate[1]),lon=Number(coordinate[2]);return Math.abs(lat)<=90&&Math.abs(lon)<=180?[{lat,lon,name:`${lat.toFixed(2)}, ${lon.toFixed(2)}`}]:[];}
    if(!search.trim())return PLACES.slice(1,4);
    const local=cities.filter(c=>normalize(c.name).includes(normalize(search)));
    const worldwide=remote.query===search.trim()&&remote.status==='ready'?remote.rows:[];
    return [...new Map([...worldwide,...local].map(p=>[normalize(p.name??''),p])).values()].slice(0,8);
  },[search,remote]);
  const looking=searching&&search.trim().length>=2&&!coordinatePattern.test(search)&&(remote.query!==search.trim()||remote.status==='loading');
  const searchError=remote.query===search.trim()&&remote.status==='error'&&!coordinatePattern.test(search);
  const selected = pin ? project(pin.lon, pin.lat, view) : null;
  const land = useMemo(() => landPath(view), [view]);
  return <div className="atlas">
    <div className="place-search">
      <form onSubmit={e => { e.preventDefault(); if (results[activeResult<0?0:activeResult]) choose(results[activeResult<0?0:activeResult]); }} role="search">
        <span aria-hidden="true">⌕</span><input aria-label="Find a city or municipality" placeholder="City, town or municipality" role="combobox" aria-autocomplete="list" aria-expanded={searching} aria-controls={searching?resultId:undefined} aria-activedescendant={searching&&activeResult>=0?`${resultId}-${activeResult}`:undefined} autoComplete="off" maxLength={100} value={search} onFocus={() => setSearching(true)} onChange={e => { setSearch(e.target.value); setSearching(true);setActiveResult(-1); }} onKeyDown={e => { if(e.nativeEvent.isComposing)return; if (e.key === 'Escape') {setSearching(false);setActiveResult(-1);} if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setSearching(true);setActiveResult(i=>results.length?(i<0?(e.key==='ArrowDown'?0:results.length-1):(i+(e.key==='ArrowDown'?1:-1)+results.length)%results.length):-1);} }} />
        <button type="submit" className="search-submit" disabled={!results.length} aria-label="Choose place result">→</button>
      </form>
      {searching ? <div className="search-results"><div className="eyebrow">{search ? 'Matching places' : 'Try a place'}</div><div id={resultId} role="listbox" aria-label="Matching places">{results.map((p,i) => <button type="button" role="option" aria-selected={activeResult===i} id={`${resultId}-${i}`} key={`${p.name}-${p.lat}-${p.lon}`} onMouseEnter={()=>setActiveResult(i)} onClick={() => choose(p)}><span>{p.name}</span><span aria-hidden="true">↗</span></button>)}</div><p className="search-status" role="status">{looking?'Searching worldwide…':searchError?'Worldwide search unavailable. Try again or use coordinates.':!results.length?'No match. Add a country, enter coordinates, or choose the map.':search.trim().length===1?'Keep typing to search worldwide.':''}</p>{remote.query===search.trim()&&remote.status==='ready'&&search.trim().length>=2?<small className="search-credit"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> · Photon</small>:null}<div className="search-actions">{searchError?<button className="search-dismiss" onClick={()=>setSearchRetry(n=>n+1)}>Retry worldwide search</button>:null}<button className="search-dismiss" onClick={() => setSearching(false)}>Close search</button></div></div> : null}
    </div>
    {!pin && !searching ? <div className="suggested-places"><span>Try</span>{PLACES.slice(1,4).map(p=><button key={p.name} className="chip" onClick={()=>choose(p)}>{p.name.split(',')[0]} ↗</button>)}</div> : null}
    <div className="map-frame">
      <Heat view={view} toDay={dayOf(now)} minMag={minMag} />
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="map-svg" aria-label="Recorded earthquakes and selected coverage area. Use city search to choose a location with the keyboard."
        onPointerDown={e => { if (e.button !== 0) return; const p = xy(e); drag.current = { x: p.x, y: p.y, view, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={e => { const d = drag.current; if (!d) return; const p = xy(e); if (Math.hypot(p.x-d.x,p.y-d.y)>5) d.moved=true; if(d.moved) setView(pan(d.view,p.x-d.x,p.y-d.y)); }}
        onPointerUp={e => { const d=drag.current; drag.current=null; if(!d || d.moved) return; const point=xy(e); const p=unproject(point.x,point.y,view); if(Math.abs(p.lon)<=180 && Math.abs(p.lat)<=90) choose({lat:Number(p.lat.toFixed(3)),lon:Number(p.lon.toFixed(3))}); }}
        onPointerCancel={() => { drag.current=null; }}>
        <path d={land} fill="rgba(155,168,171,0.07)" stroke="rgba(191,205,211,0.3)" strokeWidth={0.8} />
        {cities.filter((_,i) => i<6 || (view.k>2 && i%3===0)).map(c => { const p=project(c.lon,c.lat,view); if(p.x<30||p.x>W-110||p.y<20||p.y>H-20) return null; return <g key={`${c.name}-${c.lat}`} pointerEvents="none"><circle cx={p.x} cy={p.y} r={2.2} fill="#aeb3bc"/><text x={p.x+8} y={p.y+4} fill="#aeb3bc" fontSize={15} style={{paintOrder:'stroke',stroke:'#0a0b0d',strokeWidth:4}}>{c.name?.split(',')[0]}</text></g>; })}
        {markers.map(m => { const p=project(m.lon,m.lat,view); return <g key={m.id} role="button" tabIndex={0} aria-label={`Open ${m.label}, policy ${m.id}`} onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>{e.stopPropagation();onMarker?.(m.id);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onMarker?.(m.id);}}}><circle cx={p.x} cy={p.y} r={18} fill="transparent"/><circle cx={p.x} cy={p.y} r={5} fill="#3fcf8e"/></g>; })}
        {pin && selected ? <g pointerEvents="none"><ellipse cx={selected.x} cy={selected.y} rx={kmToPxX(MODEL.triggerRadiusKm,pin.lat,view)} ry={kmToPxY(MODEL.triggerRadiusKm,view)} fill="rgba(63,207,142,.1)" stroke="#3fcf8e" strokeWidth={2}/><circle cx={selected.x} cy={selected.y} r={5} fill="#f2f3f5"/><text x={selected.x} y={selected.y-20} textAnchor="middle" fill="#f2f3f5" fontSize={17} style={{paintOrder:'stroke',stroke:'#0a0b0d',strokeWidth:5}}>{placeName(pin)}</text></g> : null}
      </svg>
      <div className="map-zoom"><button aria-label="Zoom in" onClick={()=>setView(v=>zoomAt(v,W/2,H/2,1.6))}>+</button><button aria-label="Zoom out" onClick={()=>setView(v=>zoomAt(v,W/2,H/2,1/1.6))}>−</button><button aria-label="Show world map" onClick={()=>setView(HOME)}>◎</button></div>
    </div>
    <div className="map-bottom"><div className="map-legend"><span className="legend-quake"/>Recorded earthquakes<span className="legend-cover"/>100 km cover</div><button className={`chip ${exploring ? 'chip-on' : ''}`} aria-expanded={exploring} onClick={()=>exploring?closeExplore():setExploring(true)}>{exploring ? 'Back to cover' : 'Explore data'}</button></div>

    {exploring ? <section className="explore-controls" aria-label="Historical data exploration"><div className="explore-heading"><strong>Explore the record</strong><span>Estimates only · does not change policy terms</span></div><div className="explore-time"><button className="icon-btn" aria-label={playing?'Pause earthquake history':'Play earthquake history'} onClick={()=>{if(!playing&&live)setYear(FIRST_YEAR);setPlaying(!playing);}}>{playing?'Ⅱ':'▶'}</button><label htmlFor="record-year">{year}</label><input id="record-year" type="range" className="slider" min={FIRST_YEAR} max={LAST_YEAR} value={year} onChange={e=>{setPlaying(false);setYear(Number(e.target.value));}}/></div><div className="explore-mags"><span>Recorded magnitude</span>{[6,6.5,7].map(m=><button key={m} className={`chip ${m===minMag?'chip-on':''}`} aria-pressed={m===minMag} onClick={()=>setMinMag(m)}>M{m}+</button>)}</div>{pin ? <History pin={pin} days={days} minMag={minMag} markYear={year} /> : <p className="premium-history-empty">Choose a place on the map to see its premium over time.</p>}<small>USGS snapshot · {CATALOGUE.fetchedAt.slice(0,10)} · brightness shows recorded activity, not a forecast.</small></section> : null}
  </div>;
}
