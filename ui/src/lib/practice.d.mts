export interface Practice {version:number;available:number;positions:{id:string;name:string;amount:number;at?:string}[];purchases:{id:string;name?:string;amount:number;at?:string}[]}
export const INITIAL_CREDITS:number;
export function initialPractice():Practice;
export function validPractice(s:unknown):s is Practice;
export function practiceChange(state:Practice,action:{type:'fund'|'cover'|'remove'|'reset';id?:string;name?:string;amount?:number}):Practice;
