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

/**
 * @param spec  { lat, lon, radiusKm, minMagnitude, maxDepthKm, windowStart, windowEnd }
 */
export async function attest(sourceKey, spec) {
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
  const yes = attestations.filter((a) => a.triggered);
  return { reached: yes.length >= threshold, agreeing: yes.length, threshold, total: attestations.length };
}
