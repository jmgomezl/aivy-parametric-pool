// The app is the default; the story is a mode.
import { useRoute, onLink } from './lib/router';
import { Chrome } from './app/Chrome';
import { Home } from './app/Home';
import { PoliciesPage } from './app/PoliciesPage';
import { PolicyPage } from './app/PolicyPage';
import { lazy, Suspense, useEffect } from 'react';
const Story=lazy(()=>import('./story/Story').then(m=>({default:m.Story})));

export default function App() {
  const route = useRoute();
  const pageKey=route.name==='policy'?`policy-${route.serial}`:route.name;
  useEffect(()=>{window.scrollTo(0,0);},[pageKey]);
  if (route.name === 'story') return <Suspense fallback={<div className="page" role="status">Loading demonstration…</div>}><Story /></Suspense>;
  return (
    <div className="app">
      <Chrome route={route} />
      <main className="app-body" id="main-content" tabIndex={-1}>
        {route.name === 'home' ? <Home /> : route.name === 'policies' ? <PoliciesPage /> : route.name==='notfound'?<div className="page"><div className="page-inner empty-state"><h1>Page not found.</h1><p>Choose a place to start, or explore the demo policies.</p><a className="buy compact" href="/" onClick={onLink}>Choose a place →</a><a className="hs" href="/policies" onClick={onLink}>Explore policies ↗</a></div></div>: <PolicyPage key={route.serial} serial={route.serial} />}
      </main>
    </div>
  );
}
