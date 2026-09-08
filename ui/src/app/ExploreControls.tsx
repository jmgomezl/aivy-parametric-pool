import { useEffect, useId, useRef } from 'react';
import { CATALOGUE, FIRST_YEAR, LAST_YEAR } from '../lib/hazard';
import { History } from './History';
import type { MapState, Pin } from './AtlasMap';

export function ExploreControls({ pin, days, map, playing, onPlay, onYear, onMagnitude, onClose }: {
  pin: Pin | null; days: number; map: MapState; playing: boolean;
  onPlay: () => void; onYear: (year: number) => void;
  onMagnitude: (magnitude: number) => void; onClose: () => void;
}) {
  const section = useRef<HTMLElement>(null), yearId = useId();
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const mobile = window.matchMedia('(max-width: 900px)').matches;
    const bounds = el.getBoundingClientRect();
    if (mobile || bounds.top < 0 || bounds.bottom > window.innerHeight) {
      (el.closest('aside') ?? el).scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        block: 'start',
      });
    }
  }, []);
  return <section id="historical-exploration" className="explore-controls" ref={section} tabIndex={-1} aria-label="Historical data exploration" onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
  }}>
    <div className="explore-heading"><strong>Explore the record</strong><button className="icon-btn" onClick={onClose} aria-label="Close historical exploration">×</button></div>
    <span className="explore-disclaimer">Estimates only · policy terms stay fixed</span>
    <div className="explore-time"><button className="icon-btn" aria-label={playing ? 'Pause earthquake history' : 'Play earthquake history'} onClick={onPlay}>{playing ? 'Ⅱ' : '▶'}</button><label htmlFor={yearId}>{map.year}</label><input id={yearId} type="range" className="slider" aria-label="Record year" min={FIRST_YEAR} max={LAST_YEAR} value={map.year} onChange={event => onYear(Number(event.target.value))}/></div>
    <div className="explore-mags"><span>Recorded magnitude</span>{[6, 6.5, 7].map(m => <button key={m} className={`chip ${m === map.minMag ? 'chip-on' : ''}`} aria-pressed={m === map.minMag} onClick={() => onMagnitude(m)}>M{m}+</button>)}</div>
    {pin ? <History pin={pin} days={days} minMag={map.minMag} markYear={map.year} onYear={onYear}/> : <p className="premium-history-empty">Choose a place on the map to see its premium over time.</p>}
    <small>USGS snapshot · {CATALOGUE.fetchedAt.slice(0, 10)} · recorded activity, not a forecast.</small>
  </section>;
}
