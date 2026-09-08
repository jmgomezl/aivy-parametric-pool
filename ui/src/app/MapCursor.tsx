import {useEffect,useRef,type RefObject} from 'react';

/** A screen-sized pointer detail; never participates in map selection or pricing. */
export function MapCursor({mapRef}:{mapRef:RefObject<SVGSVGElement|null>}) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const map=mapRef.current, cursor=ref.current;
    if(!map||!cursor)return;
    const eligible=window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) and (forced-colors: none)');
    let frame=0;
    let pointer:{x:number;y:number;pressed:boolean;policy:boolean}|null=null;
    const hide=()=>{
      cancelAnimationFrame(frame);frame=0;pointer=null;
      cursor.removeAttribute('data-visible');map.removeAttribute('data-cursor-active');
    };
    const draw=()=>{
      frame=0;
      if(!pointer||!eligible.matches)return hide();
      const matrix=map.getScreenCTM();
      if(!matrix)return hide();
      const point=new DOMPoint(pointer.x,pointer.y).matrixTransform(matrix.inverse());
      const box=map.viewBox.baseVal;
      if(point.x<box.x||point.x>box.x+box.width||point.y<box.y||point.y>box.y+box.height)return hide();
      const bounds=map.getBoundingClientRect();
      cursor.style.transform=`translate3d(${pointer.x-bounds.left}px,${pointer.y-bounds.top}px,0)`;
      cursor.dataset.mode=pointer.pressed?'drag':pointer.policy?'policy':'map';
      cursor.setAttribute('data-visible','');map.setAttribute('data-cursor-active','');
    };
    const move=(event:PointerEvent)=>{
      if(!eligible.matches||event.pointerType!=='mouse')return hide();
      pointer={x:event.clientX,y:event.clientY,pressed:Boolean(event.buttons&1),policy:event.target instanceof Element&&Boolean(event.target.closest('[data-policy-id]'))};
      if(!frame)frame=requestAnimationFrame(draw);
    };
    const observer=new ResizeObserver(hide);observer.observe(map);
    for(const event of ['pointerenter','pointermove','pointerdown','pointerup'] as const)map.addEventListener(event,move);
    for(const event of ['pointerleave','pointercancel','contextmenu'] as const)map.addEventListener(event,hide);
    eligible.addEventListener('change',hide);
    window.addEventListener('blur',hide);
    window.addEventListener('scroll',hide,true);
    window.addEventListener('keydown',hide);
    document.addEventListener('visibilitychange',hide);
    return()=>{
      hide();observer.disconnect();
      for(const event of ['pointerenter','pointermove','pointerdown','pointerup'] as const)map.removeEventListener(event,move);
      for(const event of ['pointerleave','pointercancel','contextmenu'] as const)map.removeEventListener(event,hide);
      eligible.removeEventListener('change',hide);
      window.removeEventListener('blur',hide);
      window.removeEventListener('scroll',hide,true);
      window.removeEventListener('keydown',hide);
      document.removeEventListener('visibilitychange',hide);
    };
  },[mapRef]);
  return <div ref={ref} className="map-cursor" aria-hidden="true">
    <svg viewBox="-24 -24 48 48" fill="none">
      <g className="map-cursor-ring"><circle r="14" fill="rgba(8,11,10,.2)" stroke="currentColor" strokeOpacity=".55"/>
        <circle className="map-cursor-orbit" r="20" stroke="currentColor" strokeDasharray="9 22.416" strokeLinecap="round"/>
      </g>
      <path d="M-8 0h4M4 0h4M0-8v4M0 4v4" stroke="currentColor" strokeLinecap="round"/>
      <circle r="1.5" fill="#f2f3f5"/>
    </svg>
  </div>;
}
