import {onLink} from '../lib/router';

/** Technology roles, not live transaction progress. */
export function NetworkPath(){
 return <div className="network-path" aria-label="Hedera commits cover; Axelar bridges tokens; Uniswap swaps them">
  <a href="/story#2" onClick={onLink}><span className="network-symbol" aria-hidden="true">ℏ</span><span><strong>Hedera</strong><small>Commit cover</small></span></a>
  <span className="network-connector" aria-hidden="true">→</span>
  <a href="/swap" onClick={onLink}><span className="network-symbol" aria-hidden="true">↗</span><span><strong>Axelar</strong><small>Bridge tokens</small></span></a>
  <span className="network-connector" aria-hidden="true">→</span>
  <a className="network-uniswap" href="/swap?step=swap" onClick={onLink}><span className="network-symbol" aria-hidden="true">⇄</span><span><strong>Uniswap</strong><small>Swap assets</small></span></a>
 </div>;
}
