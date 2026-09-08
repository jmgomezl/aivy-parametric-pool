// Keep obligations in their original asset. Tinybars are never token base units.
export const assetKey = asset => asset.kind === 'hbar' ? 'HBAR' : `token:${asset.tokenId}`;

export function summarizeExposure(rows, {legacyTokens = {}, now = Date.now()} = {}) {
  const totals = new Map();
  for (const row of rows) {
    if (row.settled || row.state === 'paid') continue;
    const end = Date.parse(row.lapsesAt);
    if (!Number.isFinite(end)) throw Error('Policy expiry is unknown; capacity needs review.');
    if (end <= now) continue;
    let asset = row.settlementAsset ?? row.quote?.asset;
    if (!asset) {
      // Pre-token records stored only payoutHbar. Historical token symbols are
      // resolved against the permanent registry, never a new environment override.
      if (['HBAR', 'ℏ'].includes(row.asset) || (!row.asset && row.payoutUnits == null && row.payoutHbar != null)) {
        asset = {kind: 'hbar', symbol: 'HBAR', decimals: 8, tokenId: null};
      } else if (legacyTokens[row.asset]) {
        asset = {kind: 'token', symbol: row.asset, decimals: 6, tokenId: legacyTokens[row.asset]};
      } else throw Error('Policy asset is unknown; capacity needs review.');
    }
    if (!['hbar','token'].includes(asset.kind) || !Number.isInteger(asset.decimals) || asset.decimals < 0 || asset.decimals > 18 ||
        (asset.kind === 'hbar' && asset.decimals !== 8) || (asset.kind === 'token' && !/^0\.0\.\d+$/.test(asset.tokenId))) {
      throw Error('Policy asset is invalid; capacity needs review.');
    }
    const units = row.payoutUnits ?? (asset.kind === 'hbar' ? Math.round(row.payoutHbar * 1e8) : NaN);
    if (!Number.isSafeInteger(units) || units < 0) throw Error('Policy amount is invalid; capacity needs review.');
    const key = assetKey(asset), previous = totals.get(key);
    if (previous && previous.decimals !== asset.decimals) throw Error('Policy asset decimals disagree.');
    const total = previous ?? {...asset, symbol: asset.kind === 'hbar' ? 'HBAR' : asset.symbol, committedUnits: 0, obligations: 0};
    total.committedUnits += units; total.obligations++;
    if (!Number.isSafeInteger(total.committedUnits)) throw Error('Policy exposure exceeds supported precision.');
    totals.set(key,total);
  }
  return [...totals.values()];
}

export function exposureFor(rows, asset, options) {
  return summarizeExposure(rows, options).find(group => assetKey(group) === assetKey(asset))?.committedUnits ?? 0;
}
