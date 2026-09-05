// Formatting for ledger values. Amounts arrive as tinybar integers and leave as
// fixed-width strings so columns line up; nothing here rounds away precision.

export const HBAR = 'ℏ';

/** tinybar -> "4.00000000" (8 decimals, sign preserved). */
export function hbar(tinybar: number, decimals = 8): string {
  const sign = tinybar < 0 ? '−' : '';
  const unit = 10 ** (8 - decimals);
  const abs = Math.round(Math.abs(tinybar) / unit); // in units of 10^-decimals ℏ
  const scale = 10 ** decimals;
  const whole = Math.floor(abs / scale);
  const frac = String(abs % scale).padStart(decimals, '0');
  return `${sign}${whole}${decimals > 0 ? '.' + frac : ''}`;
}

/** Signed with an explicit + for credits. */
export function hbarSigned(tinybar: number, decimals = 8): string {
  const s = hbar(tinybar, decimals);
  return tinybar > 0 ? `+${s}` : s;
}

/** Share-token units (8 decimals) -> "4.00000000". */
export const units = (n: number, decimals = 8) => hbar(n, decimals);

export function pct(p: number, digits = 3): string {
  return `${(p * 100).toFixed(digits)} %`;
}

export function sci(n: number, digits = 3): string {
  const [m, e] = n.toExponential(digits).split('e');
  const exp = Number(e);
  return `${m} × 10${superscript(exp)}`;
}

function superscript(n: number): string {
  const map: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  return String(n).split('').map((c) => map[c] ?? c).join('');
}

/** ISO -> "23:11:18.715" (UTC, with millis). */
export function clock(iso: string, ms = true): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  const mmm = String(d.getUTCMilliseconds()).padStart(3, '0');
  return ms ? `${hh}:${mm}:${ss}.${mmm}` : `${hh}:${mm}:${ss}`;
}

/** ISO -> "2026-09-04" */
export const day = (iso: string) => iso.slice(0, 10);

/** ISO -> "2026-09-04 23:11:18 UTC" */
export const stamp = (iso: string) => `${day(iso)} ${clock(iso, false)} UTC`;

/** ISO -> "2026-09-04 23:11 UTC" */
export const stampShort = (iso: string) => `${day(iso)} ${clock(iso, false).slice(0, 5)} UTC`;

/** Seconds between two ISO timestamps, as "3.38 s". */
export function between(a: string, b: string): string {
  const s = (new Date(b).getTime() - new Date(a).getTime()) / 1000;
  if (s < 90) return `${s.toFixed(2)} s`;
  if (s < 3600 * 2) return `${(s / 60).toFixed(1)} min`;
  if (s < 86400 * 2) return `${(s / 3600).toFixed(1)} h`;
  return `${Math.round(s / 86400)} days`;
}

/** Consensus timestamp "1788563478.715401105" -> shown as-is but grouped. */
export const consensus = (ts: string) => ts;

export function shortKey(hex: string, head = 6, tail = 4): string {
  return hex.length <= head + tail ? hex : `${hex.slice(0, head)}…${hex.slice(-tail)}`;
}
