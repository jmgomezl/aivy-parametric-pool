import type { Policy } from './agent';
export function lpModel(policy: Policy, portion?: number): {days:number;share:number;poolFraction:number;contribution:number;income:number;annualRate:number;noClaimTotal:number;claimTotal:number} | null;
