import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import fsExt from 'fs-ext';

const flock = promisify(fsExt.flock);
const wait = () => new Promise(resolve => setTimeout(resolve, 100));
const busy = () => Object.assign(new Error('Another issuance is in progress or requires recovery. Try again later.'), { reason: 'issuance_busy' });
// Only ESRCH proves absence. Permission errors and unexpected failures fail closed.
const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; } };

/**
 * All writers on this host hold the same kernel lock for the entire operation.
 * The .guard inode is permanent: deleting it could create two independent locks.
 * Closing its descriptor (including process death) releases flock automatically.
 * The older .lock file remains an owner/recovery marker, not the exclusion primitive.
 */
export async function withIssuanceLock(network, work, { directory = path.join(process.cwd(), '.artifacts'), timeoutMs = 30000 } = {}) {
  if (!/^[a-z0-9-]+$/i.test(network)) throw new Error('Invalid network');
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) throw new Error('Invalid lock timeout');
  await fs.mkdir(directory, { recursive: true });
  const lock = path.join(directory, `issuance-${network}.lock`), started = Date.now();
  const guard = await fs.open(`${lock}.guard`, 'a+', 0o600);
  let owner;
  try {
    for (;;) {
      try { await flock(guard.fd, 'exnb'); break; }
      catch (error) {
        if (!['EAGAIN', 'EWOULDBLOCK', 'EACCES'].includes(error.code)) throw error;
        if (Date.now() - started >= timeoutMs) throw busy();
        await wait();
      }
    }
    // Only the kernel-lock holder may inspect/remove the marker. A second
    // recovering process cannot remove this holder's replacement marker.
    while (!owner) {
      try { owner = await fs.open(lock, 'wx', 0o600); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        let previous;
        try { previous = JSON.parse(await fs.readFile(lock, 'utf8')); } catch { throw busy(); }
        if (!Number.isSafeInteger(previous?.pid) || previous.pid <= 0) throw busy();
        if (!alive(previous.pid)) { await fs.unlink(lock); continue; }
        if (Date.now() - started >= timeoutMs) throw busy();
        await wait();
      }
    }
    await owner.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    return await work();
  } finally {
    try { if (owner) { await owner.close(); await fs.unlink(lock); } }
    finally { await guard.close(); }
  }
}
