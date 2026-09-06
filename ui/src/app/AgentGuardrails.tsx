import {useEffect,useState} from 'react';
import {guardrails,type Guardrails} from '../lib/agent';
export function AgentGuardrails(){
 const [state,setState]=useState<Guardrails|null>(null),[error,setError]=useState(false);
 useEffect(()=>{let live=true;guardrails().then(r=>{if(live){if('ok'in r){setError(true);}else setState(r);}}).catch(()=>{if(live)setError(true);});return()=>{live=false;};},[]);
 return <section className="agent-guardrails" aria-label="Agent guardrails">
  <h3>Code checks. Ledger authorization.</h3>
  <p>Underwriting is deterministic. An LLM does not choose the payout or authorize a transfer.</p>
  <div className="guardrail-path" aria-label="Issuance guardrails"><span>Validate inputs</span><i>→</i><span>Reserve capacity</span><i>→</i><span>Sign fixed terms</span></div>
  {state?<dl className="facts"><div><dt>Public creation</dt><dd>{state.publicWrites?`${state.network} only`:'Disabled'}</dd></div><div><dt>Attempt budget · per IP</dt><dd>{state.limits.perIpPerHour} / hour</dd></div><div><dt>Attempts · rolling 24h</dt><dd>{state.budget.policies} / {state.limits.policiesPerDay}</dd></div><div><dt>Cover budget · rolling 24h</dt><dd>${state.budget.usd.toLocaleString(undefined,{maximumFractionDigits:0})} / ${state.limits.usdPerDay.toLocaleString()}</dd></div></dl>:<p role="status">{error?'Runtime configuration unavailable.':'Reading runtime limits…'}</p>}
  <p>Limits survive restarts. Interrupted writes retain their reservation and need review. Demo keys share one host; independent operators and managed key custody remain production work.</p>
  <a className="hs" href="https://github.com/jmgomezl/aivy-parametric-pool/blob/main/docs/AGENT-SECURITY.md" target="_blank" rel="noreferrer">Architecture, tests & trust boundaries ↗</a>
  {state?<small>Runtime configuration · checked {new Date(state.checkedAt).toLocaleTimeString()}</small>:null}
 </section>;
}
