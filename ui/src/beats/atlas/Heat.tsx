import { useEffect, useRef } from 'react';
import { MODEL, QUAKES } from '../../lib/hazard';
import { H, W, base, kmToPxX, kmToPxY, type View } from './projection';

// The model, drawn: every event lights the 300 km reference disc it would be
// counted in; where discs overlap the field brightens. Additive blending on a
// canvas, so the drawing is literally the estimator's integrand.
//
// Re-renders when the view, the year or the magnitude floor change. Playback
// (year advancing by one, nothing else changed) draws incrementally.
const S = 2; // device-pixel oversampling

function drawEvents(ctx: CanvasRenderingContext2D, v: View, minMag: number, fromDay: number, toDay: number) {
  ctx.globalCompositeOperation = 'lighter';
  const ry = kmToPxY(MODEL.referenceRadiusKm, v);
  const alpha = Math.min(0.4, 0.12 / Math.sqrt(v.k)); // brighter fields at zoom would saturate to white
  for (const q of QUAKES) {
    if (q.mag < minMag || q.day <= fromDay || q.day > toDay) continue;
    const b = base(q.lon, q.lat);
    const x = (b.x - v.x) * v.k, y = (b.y - v.y) * v.k;
    const rx = kmToPxX(MODEL.referenceRadiusKm, q.lat, v);
    if (x + rx < 0 || x - rx > W || y + ry < 0 || y - ry > H) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx / ry, 1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
    g.addColorStop(0, `rgba(227,179,65,${alpha})`);
    g.addColorStop(0.6, `rgba(227,179,65,${alpha * 0.4})`);
    g.addColorStop(1, 'rgba(227,179,65,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, ry, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const q of QUAKES) {
    if (q.mag < minMag || q.day <= fromDay || q.day > toDay) continue;
    const b = base(q.lon, q.lat);
    const x = (b.x - v.x) * v.k, y = (b.y - v.y) * v.k;
    if (x < -4 || x > W + 4 || y < -4 || y > H + 4) continue;
    const big = q.mag >= 7.5;
    ctx.fillStyle = big ? 'rgba(255,240,200,0.85)' : 'rgba(255,225,150,0.45)';
    const r = (big ? 1.6 : 0.9) * Math.sqrt(v.k);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

export function Heat({ view, toDay, minMag }: { view: View; toDay: number; minMag: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ view: View; toDay: number; minMag: number } | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const c = ref.current; if (!c) return;
      if (c.width !== W * S) { c.width = W * S; c.height = H * S; }
      const ctx = c.getContext('2d')!;
      ctx.setTransform(S, 0, 0, S, 0, 0);
      const prev = last.current;
      const sameField = prev && prev.view.x === view.x && prev.view.y === view.y && prev.view.k === view.k && prev.minMag === minMag;
      if (sameField && toDay > prev.toDay) {
        drawEvents(ctx, view, minMag, prev.toDay, toDay); // playback: add the new events only
      } else {
        ctx.clearRect(0, 0, W, H);
        drawEvents(ctx, view, minMag, -Infinity, toDay);
      }
      last.current = { view, toDay, minMag };
    });
    return () => cancelAnimationFrame(raf.current);
  }, [view, toDay, minMag]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" style={{ mixBlendMode: 'screen' }} />;
}
