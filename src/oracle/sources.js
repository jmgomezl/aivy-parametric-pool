// Three seismic catalogues, read independently.
//
// A quorum only means something if its members can disagree, and these do: for
// the same point and the same criteria they return 12, 7 and 6 historical
// events. They are run by different institutions, on different networks, with
// different magnitude conventions, different completeness and different review
// pipelines. That is the point — an attestation that two of them agree on is
// worth more than one catalogue's word.
//
// Each adapter normalises to the same shape so the trigger rule is written once.
const R = 6371.0088;
const rad = (d) => (d * Math.PI) / 180;
export function distanceKm(lat1, lon1, lat2, lon2) {
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

const kmToDeg = (km) => km / 111.19;

// A truncated body is as much a transient failure as a 502, and it arrives as a
// SyntaxError rather than a status code. EMSC in particular cuts responses short
// under load, so parsing lives inside the retry rather than after it.
async function getJson(url, timeout) {
  for (let attempt = 0; ; attempt++) {
    try { return await (await get(url, timeout, attempt >= 2 ? 2 : 0)).json(); }
    catch (err) {
      if (attempt >= 2 || err.fatal) throw err;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
}

async function getText(url, timeout) {
  for (let attempt = 0; ; attempt++) {
    try {
      const body = await (await get(url, timeout, attempt >= 2 ? 2 : 0)).text();
      if (!body.trim()) throw new Error('empty response');
      return body;
    } catch (err) {
      if (attempt >= 2 || err.fatal) throw err;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
}

// These are public research services, not commercial APIs; they rate-limit and
// drop connections under load. A catalogue that blinks is a missing vote, and a
// missing vote can cost a policyholder a payout — so we retry before giving up.
async function get(url, timeout = 25_000, attempt = 0) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { accept: '*/*' } });
    if (res.ok) return res;
    if (attempt < 2 && res.status >= 500) throw new Error(`${res.status}`);
    if (!res.ok) throw Object.assign(new Error(`${res.status} ${(await res.text()).slice(0, 120)}`), { fatal: res.status < 500 });
    return res;
  } catch (err) {
    if (err.fatal || attempt >= 2) throw err;
    await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    return get(url, timeout, attempt + 1);
  }
}

/** United States Geological Survey — ComCat. */
async function usgs({ lat, lon, radiusKm, minMagnitude, since, until }) {
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson` +
    `&minmagnitude=${minMagnitude}&latitude=${lat}&longitude=${lon}&maxradiuskm=${radiusKm}` +
    `&starttime=${since}${until ? `&endtime=${until}` : ''}`;
  const { features } = await getJson(url);
  return {
    url,
    events: features.map((f) => ({
      id: f.id,
      time: new Date(f.properties.time).toISOString(),
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
      depthKm: Math.abs(f.geometry.coordinates[2]),
      magnitude: f.properties.mag,
      place: f.properties.place,
    })),
  };
}

/** European-Mediterranean Seismological Centre — takes its radius in degrees. */
async function emsc({ lat, lon, radiusKm, minMagnitude, since, until }) {
  const url = `https://www.seismicportal.eu/fdsnws/event/1/query?format=json` +
    `&minmag=${minMagnitude}&lat=${lat}&lon=${lon}&maxradius=${kmToDeg(radiusKm).toFixed(4)}` +
    `&start=${since}${until ? `&end=${until}` : ''}&limit=1000`;
  const body = await getJson(url);
  return {
    url,
    events: (body.features ?? []).map((f) => ({
      id: f.id,
      time: new Date(f.properties.time).toISOString(),
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
      // EMSC reports depth as a negative elevation; the sign is a convention,
      // not a different measurement.
      depthKm: Math.abs(f.geometry.coordinates[2]),
      magnitude: f.properties.mag,
      place: f.properties.flynn_region,
    })),
  };
}

/** GEOFON, GFZ Potsdam — pipe-delimited text, no JSON on offer. */
async function geofon({ lat, lon, radiusKm, minMagnitude, since, until }) {
  const url = `https://geofon.gfz-potsdam.de/fdsnws/event/1/query?format=text` +
    `&minmagnitude=${minMagnitude}&latitude=${lat}&longitude=${lon}&maxradius=${kmToDeg(radiusKm).toFixed(4)}` +
    `&starttime=${since}${until ? `&endtime=${until}` : ''}&limit=1000`;
  const text = await getText(url);
  const events = text.split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((line) => {
      const c = line.split('|');
      return {
        id: c[0],
        time: new Date(`${c[1]}Z`).toISOString(),
        lat: Number(c[2]), lon: Number(c[3]),
        depthKm: Math.abs(Number(c[4])),
        magnitude: Number(c[10]),
        place: c[12] || null,
      };
    })
    .filter((e) => Number.isFinite(e.magnitude));
  return { url, events };
}

export const SOURCES = {
  usgs: { name: 'USGS ComCat', operator: 'United States Geological Survey', fetch: usgs },
  emsc: { name: 'EMSC', operator: 'European-Mediterranean Seismological Centre', fetch: emsc },
  geofon: { name: 'GEOFON', operator: 'GFZ Potsdam', fetch: geofon },
};

export const SOURCE_KEYS = Object.keys(SOURCES);

/**
 * How far back each catalogue actually goes, measured near Armenia, Colombia.
 *
 *   USGS ComCat   1970  (188 events within 300 km, M5+)
 *   EMSC          2004  (64)
 *   GEOFON        2007  (53)
 *
 * This is a real constraint on what a quorum can attest to, not a footnote. No
 * two of these catalogues can agree about the 1999 Armenia earthquake, because
 * only USGS has it — so a demo that replays a pre-2007 event will fail to reach
 * quorum no matter how correct the code is.
 */
export const COVERAGE_FROM = { usgs: 1970, emsc: 2004, geofon: 2007 };

/** The earliest year a k-of-n quorum could possibly agree on anything. */
export function quorumCoverageFrom(threshold = 2, keys = SOURCE_KEYS) {
  const years = keys.map((k) => COVERAGE_FROM[k]).sort((a, b) => a - b);
  return years[Math.min(threshold - 1, years.length - 1)];
}
