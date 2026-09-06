// What an oracle actually does before it signs.
//
// Until now the oracles signed when told, which made every other honest thing in
// this project rest on a dishonest one. An oracle attests: it reads its own
// catalogue, applies the policy's trigger rule, and says yes or no with the
// evidence attached.
//
// It reports near misses too — events that failed exactly one condition — because
// an oracle that only ever says "no" is indistinguishable from one that is
// broken, and because the reason a claim was refused is the part a policyholder
// deserves to see.
import { SOURCES, distanceKm } from './sources.js';

export function validateAttestationSpec(spec, now=Date.now()) {
  if(!spec||typeof spec!=='object'||Array.isArray(spec)||!Number.isFinite(spec.lat)||Math.abs(spec.lat)>90||!Number.isFinite(spec.lon)||Math.abs(spec.lon)>180||!Number.isFinite(spec.radiusKm)||spec.radiusKm<1||spec.radiusKm>300||!Number.isFinite(spec.minMagnitude)||spec.minMagnitude<0||spec.minMagnitude>10||!Number.isFinite(spec.maxDepthKm??70)||(spec.maxDepthKm??70)<0||(spec.maxDepthKm??70)>700)throw new Error('Invalid attestation conditions.');
  const start=Date.parse(spec.windowStart),end=spec.windowEnd?Date.parse(spec.windowEnd):now;
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end>now+1000||end-start>366*86400000)throw new Error('Attestation window must be a past interval of at most 366 days.');
  return {lat:spec.lat,lon:spec.lon,radiusKm:spec.radiusKm,minMagnitude:spec.minMagnitude,maxDepthKm:spec.maxDepthKm??70,windowStart:new Date(start).toISOString(),windowEnd:new Date(end).toISOString()};
}

/**
 * @param spec  { lat, lon, radiusKm, minMagnitude, maxDepthKm, windowStart, windowEnd }
 */
export async function attest(sourceKey, spec) {
  spec=validateAttestationSpec(spec);
  const source = SOURCES[sourceKey];
  if (!source) throw new Error(`Unknown source "${sourceKey}". Known: ${Object.keys(SOURCES).join(', ')}`);

  const queriedAt = new Date().toISOString();
  // Ask wider than the rule and filter here, so the decision is ours and the
  // same for every catalogue, whatever each one's query parameters allow.
  const { url, events } = await source.fetch({
    lat: spec.lat, lon: spec.lon,
    radiusKm: spec.radiusKm,
    minMagnitude: Math.max(0, spec.minMagnitude - 0.5),
    since: spec.windowStart,
    until: spec.windowEnd,
  });

  const judge = (e) => {
    const km = distanceKm(spec.lat, spec.lon, e.lat, e.lon);
    const fails = [];
    const time=Date.parse(e.time), start=Date.parse(spec.windowStart), end=spec.windowEnd?Date.parse(spec.windowEnd):Date.now();
    if(!Number.isFinite(time)||time<start||time>end)fails.push('outside the coverage window');
    if(!Number.isFinite(e.magnitude)||!Number.isFinite(e.depthKm)||!Number.isFinite(km))fails.push('incomplete event data');
    if (e.magnitude < spec.minMagnitude) fails.push(`magnitude ${e.magnitude} below ${spec.minMagnitude}`);
    if (km > spec.radiusKm) fails.push(`${km.toFixed(0)} km away, outside ${spec.radiusKm} km`);
    if (spec.maxDepthKm != null && e.depthKm > spec.maxDepthKm) fails.push(`${e.depthKm} km deep, below ${spec.maxDepthKm} km`);
    return { ...e, distanceKm: Number(km.toFixed(1)), fails };
  };

  const judged = events.map(judge);
  const matches = judged.filter((e) => e.fails.length === 0).map(({ fails, ...e }) => e);
  const nearMisses = judged
    .filter((e) => e.fails.length === 1)
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 3);

  return {
    source: source.name,
    operator: source.operator,
    sourceKey,
    queriedAt,
    query: url,
    spec,
    triggered: matches.length > 0,
    matches,
    nearMisses,
    // The sentence a policyholder should be able to read.
    verdict: matches.length > 0
      ? `${source.name} recorded ${matches.length} qualifying event${matches.length > 1 ? 's' : ''}: ` +
        matches.map((m) => `M${m.magnitude} at ${m.distanceKm} km, ${m.depthKm} km deep, ${m.time.slice(0, 10)}`).join('; ')
      : nearMisses.length > 0
        ? `${source.name} recorded nothing that qualifies. Closest: M${nearMisses[0].magnitude} — ${nearMisses[0].fails[0]}.`
        : `${source.name} recorded no seismic activity meeting these terms in the window.`,
  };
}

/** Ask every source independently. One failing catalogue must not stop the others. */
export async function attestAll(spec, keys = Object.keys(SOURCES)) {
  const results = await Promise.allSettled(keys.map((k) => attest(k, spec)));
  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          sourceKey: keys[i], source: SOURCES[keys[i]].name, operator: SOURCES[keys[i]].operator,
          queriedAt: new Date().toISOString(),
          triggered: false, unavailable: true,
          matches: [], nearMisses: [],
          error: String(r.reason?.message ?? r.reason).slice(0, 160),
          // An unreachable catalogue is not a "no". It is a missing vote, and the
          // quorum has to be able to tell the difference.
          verdict: `${SOURCES[keys[i]].name} could not be reached, so it casts no vote.`,
        });
}

/** Does a quorum of catalogues agree the trigger fired? */
export function quorumReached(attestations, threshold = 2) {
  const yes = [...new Set(attestations.filter(a=>a.triggered===true&&!a.unavailable&&Object.hasOwn(SOURCES,a.sourceKey)).map(a=>a.sourceKey))];
  return { reached: yes.length >= threshold, agreeing: yes.length, threshold, total: attestations.length };
}
