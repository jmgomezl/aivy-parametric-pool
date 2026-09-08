// Genuine public-site footage. No mocked responses or replacement transaction UI.
// Ledger actions require --execute and an existing service-managed testnet session.
// The private recording directory preserves requests and browser state on failure.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const phase=process.argv[2]||'map';
const serial=process.env.QUORUM_VIDEO_POLICY||'32';
const root=process.env.QUORUM_VIDEO_WORK || '/tmp/quorum-video';
const base=process.env.QUORUM_VIDEO_SITE || 'https://quorum.aivylabs.xyz';
const execute=process.argv.includes('--execute');
await fs.mkdir(`${root}/raw`,{recursive:true});await fs.mkdir(`${root}/stills`,{recursive:true});
const manifest=`${root}/${phase}.json`;
if(await fs.stat(manifest).catch(()=>null))throw Error('Capture exists. Reuse it; do not repeat financial actions.');
const allowed={cover:['/api/policies'],oracle:[`/api/policies/${serial}/check`],fund:['/api/demo/deposit'],swap:['/api/demo/evm/quote','/api/demo/evm/execute'],bridge:['/api/demo/evm/bridge','/api/demo/evm/quote','/api/demo/evm/execute']}[phase]||[];
const token=process.env.QUORUM_VIDEO_SESSION_FILE? (await fs.readFile(process.env.QUORUM_VIDEO_SESSION_FILE,'utf8')).trim():'';
const browser=await chromium.launch({channel:'chrome',headless:true});
const ctx=await browser.newContext({viewport:{width:1440,height:780},deviceScaleFactor:1,locale:'en-US',timezoneId:'America/Bogota',recordVideo:{dir:`${root}/raw`,size:{width:1440,height:780}}});
if(token)await ctx.addInitScript(value=>localStorage.setItem('quorum.testnet.session',value),token);
const requests=[],responses=[],marks=[],errors=[];
let p,start;
async function mark(name){marks.push({name,time:(Date.now()-start)/1000});console.log(name);}
async function pause(s=2){await p.waitForTimeout(s*1000);}
async function shot(name){await p.screenshot({path:`${root}/stills/${name}.png`});}
async function go(route){await p.goto(base+route,{waitUntil:'domcontentloaded'});await p.evaluate(()=>document.fonts.ready);if(!route.startsWith('/story'))await p.getByText('Testnet demo',{exact:true}).waitFor();else await p.locator('.replay-scene').waitFor();}
async function click(locator){await locator.scrollIntoViewIfNeeded();const r=await locator.boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2,{steps:30});await pause(.5);await locator.click();}
async function scroll(locator){await locator.evaluate(el=>el.scrollIntoView({behavior:'smooth',block:'center'}));await pause(1.2);}
await ctx.route('**/api/**',async r=>{
 if(r.request().method()==='GET')return r.continue();
 const endpoint=new URL(r.request().url()).pathname;
 if(!execute||!allowed.includes(endpoint)){console.log('Blocked write',endpoint);return r.abort();}
 const body=r.request().postDataJSON();
 requests.push({path:endpoint,body,at:new Date().toISOString()});
 await fs.writeFile(`${root}/${phase}-requests.private.json`,JSON.stringify(requests,null,2),{mode:0o600});
 return r.continue();
});
try{
 p=await ctx.newPage();start=Date.now();p.on('pageerror',e=>errors.push(e.message));
 p.on('response',async r=>{if(r.request().method()==='POST'&&r.url().startsWith(base+'/api/')){try{responses.push({path:new URL(r.url()).pathname,status:r.status(),result:await r.json()});}catch{}}});
 if(phase==='map'){
  await go('/');await p.locator('[data-policy-id]').first().waitFor();await pause(2);await mark('atlas');await shot('atlas');
  await p.mouse.move(1000,450,{steps:60});await pause(2);await p.mouse.move(810,370,{steps:45});await pause(2);
  await mark('search');const field=p.getByRole('combobox',{name:'Find a city or municipality'});await click(field);await field.pressSequentially('Medellin',{delay:130});const option=p.getByRole('option').filter({hasText:/Medellín|Medellin/}).first();await option.waitFor();await pause(2);await click(option);
  await p.locator('.quote-numbers strong.text-ok').filter({hasText:/\$/}).waitFor();await mark('quote');await pause(3);await shot('quote');
  await click(p.getByRole('button',{name:'Explore data',exact:true}));const chart=p.getByRole('slider',{name:'Premium history year',exact:true});await scroll(chart);await mark('history');const b=await chart.boundingBox();
  await p.mouse.move(b.x+b.width*.3,b.y+b.height*.58,{steps:40});await p.mouse.down();for(const f of [.3,.4,.55,.7,.85,.98]){await p.mouse.move(b.x+b.width*f,b.y+b.height*.58,{steps:18});await pause(.65);}await p.mouse.up();await pause(2);await shot('history');
 }else if(phase==='cover'){
  await go('/?at=6.2442,-75.5812&place=Medell%C3%ADn%2C%20Colombia');const buy=p.getByRole('button',{name:'Pay premium & create cover'});await buy.waitFor();await pause(3);await mark('before');await shot('cover-before');await click(buy);await mark('submitted');
  await p.getByText('Payout committed.',{exact:true}).waitFor({timeout:115000});await mark('confirmed');await pause(4);await shot('cover-confirmed');await click(p.getByRole('link',{name:/View policy/}));await p.locator('.policy-detail').waitFor();await mark('nft');await pause(5);await shot('nft');
  await click(p.locator('.proof-details summary').filter({hasText:'View on Hedera'}));await scroll(p.locator('.proof-details[open]'));await mark('proof');await pause(6);await shot('policy-proof');
 }else if(phase==='oracle'){
  await go(`/policy/${serial}`);const check=p.getByRole('button',{name:'Check now · up to 0.003 aUSDd →'});await check.waitFor();await scroll(p.locator('.policy-checks'));await mark('before');await pause(3);await click(check);await mark('submitted');
  const response=await p.waitForResponse(r=>r.url().endsWith(`/api/policies/${serial}/check`)&&r.request().method()==='POST',{timeout:115000});if(!response.ok())throw Error('Oracle response failed; inspect original request.');await pause(2);await mark('confirmed');await shot('oracles');await click(p.locator('.oracle-result-details summary'));await scroll(p.locator('.oracle-result-details'));await mark('receipts');await pause(7);await shot('oracle-receipts');
 }else if(phase==='fund'){
  await go('/policies?view=fund');const panel=p.getByRole('region',{name:'Fund the shared pool'});await panel.waitFor();await p.getByLabel('Deposit amount').fill('25');await scroll(panel);await mark('before');await pause(3);await click(p.getByRole('button',{name:'Deposit into shared pool →'}));await mark('submitted');await p.getByText('25 aUSDd deposited · 25 ARPS received',{exact:true}).waitFor({timeout:115000});await mark('confirmed');await pause(5);await shot('fund-confirmed');
 }else if(phase==='fund-position'){
  await go('/policies?view=fund');const panel=p.getByRole('region',{name:'Fund the shared pool'});await panel.waitFor();await p.getByRole('region',{name:'Your pool position'}).getByText('26',{exact:true}).waitFor({timeout:45000});await scroll(panel);await mark('position');await pause(8);await shot('fund-position');
 }else if(phase==='swap'){
  await go('/swap?step=swap');const quote=p.getByRole('button',{name:'Get swap quote →',exact:true});await quote.waitFor({timeout:45000});await scroll(p.locator('.swap-workspace'));await mark('before');await pause(3);await click(quote);const swap=p.getByRole('button',{name:'Swap on Sepolia →',exact:true});await swap.waitFor({timeout:45000});await mark('quote');await pause(3);await shot('swap-quote');await click(swap);await mark('submitted');
  await p.waitForResponse(r=>r.url().endsWith('/api/demo/evm/execute')&&r.request().method()==='POST',{timeout:115000});await pause(2);await mark('returned');await p.getByText('Latest swap · confirmed on Sepolia',{exact:true}).waitFor({timeout:115000});await mark('confirmed');await pause(6);await shot('swap-confirmed');
 }else if(phase==='bridge'){
  await go('/swap');await p.getByRole('button',{name:'Bridge test tokens →',exact:true}).waitFor();await p.locator('.demo-wallet-note a').waitFor({timeout:45000});await scroll(p.locator('.swap-workspace'));await mark('before');await pause(4);await click(p.getByRole('button',{name:'Bridge test tokens →',exact:true}));await mark('submitted');await p.getByText('Source confirmed. Axelar is delivering your tokens.',{exact:true}).waitFor({timeout:115000});await mark('source');await pause(5);await shot('bridge-source');
 }else if(phase==='bridge-status'){
  await go('/swap');await p.locator('.testnet-swap-receipt').waitFor({timeout:45000});await scroll(p.locator('.swap-workspace'));await pause(4);await mark('status');await shot('bridge-status');await pause(6);
 }else if(phase==='liquidity'){
  await go('/swap?step=swap');await p.getByRole('button',{name:'Provide swap liquidity →',exact:true}).waitFor();await click(p.getByRole('button',{name:'Provide swap liquidity →',exact:true}));await p.locator('.liquidity-seed').waitFor().catch(()=>{});await scroll(p.locator('#liquidity'));await pause(5);await mark('lp');await shot('liquidity');await pause(7);
 }else if(phase==='story'){
  await go('/story#3');await p.getByRole('heading',{name:'One vote is not enough.'}).waitFor();await scroll(p.locator('.replay-scene'));await mark('one');await pause(5);await shot('one-signature');await click(p.getByRole('button',{name:'Step 4: Release'}));await scroll(p.locator('.replay-scene'));await mark('release');await pause(7);await shot('release');await click(p.getByRole('button',{name:'Step 6: Protect'}));await scroll(p.locator('.replay-scene'));await mark('guard');await pause(7);await shot('guard');
 }else if(phase==='gallery'){
  await go('/policies?filter=global');await p.locator('.nft-gallery-link').first().waitFor();await scroll(p.locator('.policy-cards'));await mark('gallery');await pause(7);await shot('gallery');
 }else throw Error('Unknown phase');
 await mark('end');
}catch(e){errors.push(e.message);console.error(e.message);if(p)await shot(`${phase}-error`);process.exitCode=1;}
finally{
 if(p)await ctx.storageState({path:`${root}/${phase}-state.private.json`});
 const video=p?.video();await ctx.close();if(video)await video.saveAs(`${root}/raw/${phase}.webm`);await browser.close();
 await fs.writeFile(manifest,JSON.stringify({phase,site:base,capturedAt:new Date().toISOString(),viewport:{width:1440,height:780},video:`raw/${phase}.webm`,marks,errors,requests:requests.map(x=>({path:x.path,at:x.at})),responses},null,2));
 console.log(JSON.stringify({phase,marks,errors,requests:requests.length}));
}
