// Public receipt references only. Never persist payment headers or signing keys.
import fs from 'node:fs';
import path from 'node:path';
const file = (network, directory) => path.join(directory, `activity-${network}.jsonl`);
const networks = new Set(['testnet', 'mainnet']);
export function recordPayment({ network, transaction, amount, asset, resource }, directory = path.join(process.cwd(), '.artifacts')) {
  if (!networks.has(network) || !/^\d+\.\d+\.\d+@\d+\.\d+$/.test(transaction) || !/^\d+$/.test(String(amount))) throw new Error('Invalid payment receipt');
  const url = new URL(resource);
  const event = { kind: 'x402-payment', network, transaction, amount: String(amount), asset: String(asset), resource: `${url.origin}${url.pathname}`, at: new Date().toISOString() };
  fs.mkdirSync(directory, { recursive: true });
  fs.appendFileSync(file(network, directory), JSON.stringify(event) + '\n', { mode: 0o600 });
}
export function paymentActivity(network, directory = path.join(process.cwd(), '.artifacts')) {
  if (!networks.has(network)) throw new Error('Invalid network');
  try {
    // Bound reads for a long-running service. The first partial line is discarded.
    const fd = fs.openSync(file(network, directory), 'r');
    let text;
    try { const size = fs.fstatSync(fd).size, start = Math.max(0, size - 131072); const bytes = Buffer.alloc(size - start); fs.readSync(fd, bytes, 0, bytes.length, start); text = bytes.toString(); if (start) text = text.slice(text.indexOf('\n') + 1); }
    finally { fs.closeSync(fd); }
    const events = text.trim().split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
    return [...new Map(events.map(e => [e.transaction, e])).values()].slice(-40).reverse();
  } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
