// Photon/OpenStreetMap place search. Fixed upstream, bounded cache and concurrency.
export const normalizePlace = value => value.normalize('NFD').replace(/(\p{Script=Latin})\p{M}+/gu, '$1').normalize('NFC').toLocaleLowerCase().trim();
export function placeResults(body) {
  const rows = (body.features ?? []).flatMap(f => {
    const p=f.properties??{}, [lon,lat]=f.geometry?.coordinates??[];
    if(f.geometry?.type!=='Point'||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||typeof p.name!=='string')return [];
    const context=[p.state,p.country].filter(v=>typeof v==='string'&&v.trim());
    const name=[...new Set([p.name,...context])].join(', ');
    return [{name,lat,lon,rank:p.osm_value==='city'?(p.type==='city'?0:0.5):p.osm_value==='town'?1:2}];
  }).sort((a,b)=>a.rank-b.rank);
  const seen=new Set();
  return rows.filter(p=>{const key=normalizePlace(p.name);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,8).map(({rank,...p})=>p);
}
export function createPlaceSearch(fetcher=fetch) {
  const cache=new Map(),pending=new Map();
  let nextStart=0;
  return async query => {
    const q=typeof query==='string'?query.trim():'';
    if(q.length<2||q.length>100)throw Object.assign(new Error('Enter 2 to 100 characters.'),{status:400});
    const key=normalizePlace(q),hit=cache.get(key);
    if(hit&&hit.expires>Date.now())return hit.places;
    if(pending.has(key))return pending.get(key);
    if(pending.size>=3)throw Object.assign(new Error('Place search is busy. Try again shortly.'),{status:503});
    const wait=Math.max(0,nextStart-Date.now());nextStart=Date.now()+wait+400;
    const work=(async()=>{
      if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
      const url=new URL('https://photon.komoot.io/api/');
      url.searchParams.set('q',q);url.searchParams.set('limit','12');url.searchParams.set('lang','en');
      for(const layer of ['city','district','locality','county'])url.searchParams.append('layer',layer);
      const res=await fetcher(url,{signal:AbortSignal.timeout(7000),headers:{'User-Agent':'AivyQuorum/1.0 (https://quorum.aivylabs.xyz)','Accept':'application/json'}});
      if(!res.ok)throw new Error('Place search temporarily unavailable.');
      const places=placeResults(await res.json());
      if(cache.size>=500)cache.delete(cache.keys().next().value);
      cache.set(key,{places,expires:Date.now()+86400000});return places;
    })();
    pending.set(key,work);
    try{return await work;}finally{pending.delete(key);}
  };
}
export const searchPlaces=createPlaceSearch();
