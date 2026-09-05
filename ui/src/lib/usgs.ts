// A live recount against the USGS ComCat catalogue, using the exact query the
// underwriting agent published in the policy terms. If the count today differs
// from the count at issue, that is shown, not hidden.
export interface UsgsEvent { time: string; mag: number; depthKm: number; place: string; id: string; lat: number; lon: number }
export interface UsgsRecount { count: number; events: UsgsEvent[]; url: string }

export async function recount(sourceUrl: string, timeoutMs = 10000): Promise<UsgsRecount> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const url = sourceUrl.includes('orderby=') ? sourceUrl : `${sourceUrl}&orderby=time`;
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`USGS ${res.status}`);
    const j = (await res.json()) as { features: { id: string; properties: { time: number; mag: number; place: string }; geometry: { coordinates: [number, number, number] } }[] };
    const events = j.features.map((f) => ({
      id: f.id,
      time: new Date(f.properties.time).toISOString(),
      mag: f.properties.mag,
      depthKm: f.geometry.coordinates[2],
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      place: f.properties.place,
    }));
    return { count: events.length, events, url };
  } finally {
    clearTimeout(t);
  }
}
