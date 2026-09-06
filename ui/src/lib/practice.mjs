/** Browser-only accounting. Never authorizes a ledger transaction. */
export const INITIAL_CREDITS=1000;
export const initialPractice=()=>({version:1,available:INITIAL_CREDITS,positions:[],purchases:[]});
export function validPractice(s){return s?.version===1&&Number.isFinite(s.available)&&s.available>=0&&Array.isArray(s.positions)&&Array.isArray(s.purchases)&&s.positions.every(p=>typeof p.id==='string'&&typeof p.name==='string'&&Number.isFinite(p.amount)&&p.amount>0)&&s.purchases.every(p=>typeof p.id==='string'&&Number.isFinite(p.amount)&&p.amount>=0);}
export function practiceChange(state,action){
 if(!validPractice(state))throw new Error('Practice balance unavailable. Reset the simulation to continue.');
 if(action.type==='reset')return initialPractice();
 if(action.type==='remove') {const p=state.positions.find(p=>p.id===action.id);return p?{...state,available:state.available+p.amount,positions:state.positions.filter(p=>p.id!==action.id)}:state;}
 if(!['fund','cover'].includes(action.type)||!Number.isFinite(action.amount)||action.amount<=0||typeof action.id!=='string')throw new Error('Choose a valid amount.');
 const list=action.type==='fund'?state.positions:state.purchases;
 if(list.some(p=>p.id===action.id))return state;
 if(action.amount>state.available+1e-8)throw new Error('Not enough practice credits. Remove a simulated position or reset your practice balance.');
 const item={id:action.id,name:action.name??action.id,amount:action.amount,at:action.at??new Date().toISOString()};
 return {...state,available:Math.max(0,state.available-action.amount),[action.type==='fund'?'positions':'purchases']:[...list,item]};
}
