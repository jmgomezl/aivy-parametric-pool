import type { Policy } from './agent';
export function lpModel(policy: Policy, portion?: number): {days:number;share:number;poolFraction:number;contribution:number;income:number;annualRate:number;noClaimTotal:number;claimTotal:number} | null;
export function lpScenario(policy:Policy,portion:number,horizon:'term'|'month'|'year'): (NonNullable<ReturnType<typeof lpModel>> & {horizonDays:number;returnPct:number;lossPct:number}) | null;
