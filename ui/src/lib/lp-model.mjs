/** Illustrative pro-rata premium income, not a promised or risk-adjusted return. */
export function lpModel(policy, portion = 10) {
  const days = Math.round((Date.parse(policy.trigger?.windowEnd ?? policy.lapsesAt) - Date.parse(policy.trigger?.windowStart ?? policy.recordedAt)) / 86400000);
  const payout = policy.payoutHbar, premium = policy.premiumHbar;
  if (!(days > 0 && days <= 366 && payout > 0 && premium >= 0) || ![days,payout,premium,portion].every(Number.isFinite)) return null;
  const share = Math.min(100, Math.max(0, portion)) / 100;
  // Mirror the actual sale's integer rounding when base units are recorded.
  const commission = policy.brokerId ? (Number.isSafeInteger(policy.premiumUnits) && policy.premiumUnits > 0
    ? premium * Math.round(policy.premiumUnits * .15) / policy.premiumUnits : premium * .15) : 0;
  const poolPremium = premium - commission, poolFraction = premium > 0 ? poolPremium / premium : 1;
  const contribution = payout * share, income = poolPremium * share, termRate = poolPremium / payout * 100;
  return {days,share,poolFraction,poolPremium,commission,contribution,income,termRate,
    annualRate:termRate*365/days,noClaimTotal:contribution+income,claimTotal:income,
    returnPct:contribution?termRate:0,lossPct:contribution?(income-contribution)/contribution*100:0};
}
