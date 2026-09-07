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

// FDSN defines HTTP 204 as a successful empty catalogue. Empty/malformed 200
// responses are failures, never evidence that no event happened.
// One bounded retry loop includes parsing; nested retries previously outlived
// the paid client's timeout and hid otherwise successful payment receipts.
async function readCatalogue(url, format, timeout = 18_000) {
  const deadline = Date.now() + timeout;
  for (let attempt = 0; ; attempt++) {
    try {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw Object.assign(new Error('Catalogue deadline exceeded'), {fatal: true});
      const res = await fetch(url, {signal: AbortSignal.timeout(Math.min(6000, remaining)), headers: {accept: '*/*'}});
      if (res.status === 204) return format === 'json' ? {features: []} : '';
      if (!res.ok) throw Object.assign(new Error(`Catalogue HTTP ${res.status}`), {fatal: res.status < 500});
      if (format === 'json') {
        const body = await res.json();
        if (!Array.isArray(body?.features)) throw new Error('Invalid catalogue features');
        return body;
      }
      const body = await res.text();
      if (!body.trim()) throw new Error('Empty catalogue response');
      return body;
    } catch (err) {
      if (attempt >= 2 || err.fatal || Date.now() >= deadline) throw err;
      await new Promise(resolve => setTimeout(resolve, Math.min(600 * (attempt + 1), Math.max(0, deadline - Date.now()))));
    }
  }
}
const getJson = url => readCatalogue(url, 'json');
const getText = url => readCatalogue(url, 'text');

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
    events: body.features.map((f) => ({
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
