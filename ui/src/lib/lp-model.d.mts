import type { Policy } from './agent';
export function lpModel(policy: Policy, portion?: number): {days:number;share:number;poolFraction:number;poolPremium:number;commission:number;contribution:number;income:number;termRate:number;annualRate:number;noClaimTotal:number;claimTotal:number;returnPct:number;lossPct:number} | null;
