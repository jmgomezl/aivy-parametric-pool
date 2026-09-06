import fs from 'node:fs/promises';
import path from 'node:path';

/** Serialize the entire capital-check / reservation / issuance operation across processes.
 * A crashed writer leaves the lock behind: fail closed until an operator reconciles it.
 */
export async function withIssuanceLock(network, work, { directory = path.join(process.cwd(), '.artifacts'), timeoutMs = 30000 } = {}) {
  if (!/^[a-z0-9-]+$/i.test(network)) throw new Error('Invalid network');
  await fs.mkdir(directory, { recursive: true });
  const lock = path.join(directory, `issuance-${network}.lock`), started = Date.now();
  let handle;
  while (!handle) {
    try { handle = await fs.open(lock, 'wx', 0o600); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() - started >= timeoutMs) throw Object.assign(new Error('Another issuance is in progress or requires recovery. Try again later.'), { reason: 'issuance_busy' });
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  try { await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })); return await work(); }
  finally { await handle.close(); await fs.unlink(lock); }
}
