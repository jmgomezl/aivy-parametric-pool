import fs from 'node:fs/promises';
import path from 'node:path';

/** Is that process still running? EPERM means alive but not ours, so wait. */
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; } };

// One reclaim at a time. Two callers in this process must not each decide the
// same lock is abandoned and then unlink one another's replacement.
let reclaiming = Promise.resolve();

/**
 * Drop a lock whose owner is provably gone — killed mid-issuance by a restart,
 * a crash, or the memory ceiling. Without this the next issuance waits out the
 * timeout and every one after it fails until someone deletes the file by hand.
 *
 * A lock we cannot read is left alone: an unreadable lock is a state that needs
 * a person, not a guess. A pid we cannot prove dead counts as alive, so this
 * fails closed in every case it is unsure about.
 */
async function reclaimIfAbandoned(lock) {
  const attempt = reclaiming.then(async () => {
    let raw, owner;
    try { raw = await fs.readFile(lock, 'utf8'); } catch { return false; }
    try { owner = JSON.parse(raw); } catch { return false; }
    if (!Number.isInteger(owner?.pid) || owner.pid <= 0 || alive(owner.pid)) return false;
    try {
      // Re-read first: never unlink a lock that was taken since we judged it.
      if (await fs.readFile(lock, 'utf8') !== raw) return false;
      await fs.unlink(lock);
    } catch { return false; }
    return true;
  });
  reclaiming = attempt.then(() => {}, () => {});
  return attempt;
}

/** Serialize the entire capital-check / reservation / issuance operation across processes. */
export async function withIssuanceLock(network, work, { directory = path.join(process.cwd(), '.artifacts'), timeoutMs = 30000 } = {}) {
  if (!/^[a-z0-9-]+$/i.test(network)) throw new Error('Invalid network');
  await fs.mkdir(directory, { recursive: true });
  const lock = path.join(directory, `issuance-${network}.lock`), started = Date.now();
  let handle;
  while (!handle) {
    try { handle = await fs.open(lock, 'wx', 0o600); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (await reclaimIfAbandoned(lock)) continue;
      if (Date.now() - started >= timeoutMs) throw Object.assign(new Error('Another issuance is in progress or requires recovery. Try again later.'), { reason: 'issuance_busy' });
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  try { await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })); return await work(); }
  finally { await handle.close(); await fs.unlink(lock); }
}
