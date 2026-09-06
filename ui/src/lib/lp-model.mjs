/** Illustrative pro-rata premium income, not a promised or risk-adjusted return. */
export function lpModel(policy, portion = 10) {
  const days = Math.round((Date.parse(policy.trigger?.windowEnd ?? policy.lapsesAt) - Date.parse(policy.trigger?.windowStart ?? policy.recordedAt)) / 86400000);
  const payout = policy.payoutHbar, premium = policy.premiumHbar;
  if (!(days > 0 && days <= 366 && payout > 0 && premium >= 0) || ![days,payout,premium,portion].every(Number.isFinite)) return null;
  const share = Math.min(100, Math.max(0, portion)) / 100;
  const poolFraction = policy.brokerId ? .85 : 1;
  const contribution = payout * share, income = premium * poolFraction * share;
  return {days,share,poolFraction,contribution,income,annualRate:premium*poolFraction/payout*365/days*100,noClaimTotal:contribution+income,claimTotal:income};
}
