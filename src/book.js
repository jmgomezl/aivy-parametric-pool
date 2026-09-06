import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const file = network => path.join(process.cwd(), '.artifacts', `book-${network}.json`);
const read = network => {
  try {
    const book = JSON.parse(fs.readFileSync(file(network), 'utf8'));
    if (!Array.isArray(book.policies)) throw new Error('Invalid policy book');
    return { reservations: [], ...book };
  } catch (error) { if (error.code === 'ENOENT') return { policies: [], reservations: [] }; throw new Error('Policy book cannot be read. Issuance is paused until it is recovered.'); }
};
const write = (network, book) => {
  fs.mkdirSync(path.dirname(file(network)), { recursive: true });
  const temporary = `${file(network)}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(book, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, file(network));
};
export const policies = network => read(network).policies;
export const reservations = network => read(network).reservations;
export const request = (network, requestId) => {
  const book = read(network);
  return book.policies.find(p => p.requestId === requestId) ?? book.reservations.find(p => p.requestId === requestId);
};
export function committedTinybar(network, now = Date.now()) {
  const book = read(network);
  return [...book.policies, ...book.reservations]
    .filter(p => !p.settled && new Date(p.lapsesAt).getTime() > now)
    .reduce((sum,p) => sum + (p.payoutUnits ?? Math.round((p.payoutHbar ?? 0) * 1e8)),0);
}
export function reserve(network, reservation) {
  const book = read(network);
  book.reservations.push({ ...reservation, recordedAt: new Date().toISOString() });
  write(network,book);
}
export function record(network, policy) {
  const book = read(network);
  book.policies.push({ ...policy, recordedAt: new Date().toISOString() });
  book.reservations = book.reservations.filter(r => r.requestId !== policy.requestId);
  write(network, book); return policy;
}
export function settle(network, serial, executedAt) {
  const book=read(network), p=book.policies.find(x=>String(x.serial)===String(serial));
  if(p){p.settled=true;p.executedAt=executedAt;write(network,book);}return p;
}

export function updateReservation(network, requestId, progress) {
  const book=read(network), reservation=book.reservations.find(r=>r.requestId===requestId);
  if(reservation){Object.assign(reservation,progress);write(network,book);}
}
