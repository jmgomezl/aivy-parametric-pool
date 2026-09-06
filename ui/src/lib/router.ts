// A very small path router. The app has four destinations and no nesting, so
// pushState plus a listener is the whole thing. Story beats keep their own
// hash (`/story#3`) for direct step navigation.
import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'policies' }
  | { name: 'policy'; serial: string }
  | { name: 'story' };

export function parse(pathname: string): Route {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/story') return { name: 'story' };
  if (p === '/policies') return { name: 'policies' };
  const m = /^\/policy\/([^/]+)$/.exec(p);
  if (m) {try{return {name:'policy',serial:decodeURIComponent(m[1])};}catch{return {name:'policy',serial:m[1]};}}
  return { name: 'home' };
}

const listeners = new Set<() => void>();
export function navigate(to: string, replace = false) {
  if (replace) history.replaceState(null, '', to); else history.pushState(null, '', to);
  listeners.forEach((l) => l());
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.pathname));
  useEffect(() => {
    const update = () => setRoute(parse(location.pathname));
    listeners.add(update);
    window.addEventListener('popstate', update);
    return () => { listeners.delete(update); window.removeEventListener('popstate', update); };
  }, []);
  return route;
}

/** Click handler for in-app anchors: keeps modifier-clicks and middle-clicks native. */
export function onLink(e: React.MouseEvent<HTMLAnchorElement>) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const href = e.currentTarget.getAttribute('href');
  if (!href || href.startsWith('http')) return;
  e.preventDefault();
  navigate(href);
}

export const policyPath = (serial: string | number) => `/policy/${encodeURIComponent(String(serial))}`;
