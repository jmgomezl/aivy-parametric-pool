// The book of live policies.
//
// The solvency guard needs to know committed exposure, and exposure is the sum
// of what live policies promise. That number cannot be read off the ledger:
// a pre-signed payout is a schedule that has not executed, and the pool's
// balance says nothing about what it has already promised away.
//
// So the agent keeps its own book. It is deliberately a plain file — an agent
// that cannot say what it owes has no business underwriting.
import fs from 'node:fs';
import path from 'node:path';

const file = (network) => path.join(process.cwd(), '.artifacts', `book-${network}.json`);

const read = (network) => {
  try { return JSON.parse(fs.readFileSync(file(network), 'utf8')); }
  catch { return { policies: [] }; }
};

const write = (network, book) => {
  fs.mkdirSync(path.dirname(file(network)), { recursive: true });
  fs.writeFileSync(file(network), JSON.stringify(book, null, 2));
};

export const policies = (network) => read(network).policies;

/** Cover promised by policies that have neither paid out nor lapsed. */
export function committedTinybar(network, now = Date.now()) {
  return policies(network)
    .filter((p) => !p.settled && new Date(p.lapsesAt).getTime() > now)
    .reduce((sum, p) => sum + (p.payoutUnits ?? Math.round((p.payoutHbar ?? 0) * 1e8)), 0);
}

/** Exposure a single trigger zone already carries — what a correlated event would cost. */
export function zoneExposureTinybar(network, { lat, lon, radiusKm = 100 }, now = Date.now()) {
  const R = 6371.0088, rad = (d) => (d * Math.PI) / 180;
  const km = (a, b, c, d) => {
    const dLat = rad(c - a), dLon = rad(d - b);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  return policies(network)
    .filter((p) => !p.settled && new Date(p.lapsesAt).getTime() > now)
    .filter((p) => km(lat, lon, p.lat, p.lon) <= radiusKm)
    .reduce((sum, p) => sum + (p.payoutUnits ?? Math.round((p.payoutHbar ?? 0) * 1e8)), 0);
}

export function record(network, policy) {
  const book = read(network);
  book.policies.push({ ...policy, recordedAt: new Date().toISOString() });
  write(network, book);
  return policy;
}

export function settle(network, serial, executedAt) {
  const book = read(network);
  const p = book.policies.find((x) => String(x.serial) === String(serial));
  if (p) { p.settled = true; p.executedAt = executedAt; write(network, book); }
  return p;
}
