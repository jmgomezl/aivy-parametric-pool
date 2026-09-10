// Capture the deployed UI, with real responses. No business write is allowed.
// Optional existing demo capabilities are read from private paths, never exported.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),media=path.join(root,'docs/media');
const work=process.env.QUORUM_MEDIA_WORK||'/tmp/quorum-readme-media-20260910';
const phase=process.argv[2]||'quorum';
const base='https://quorum.aivylabs.xyz';
await fs.mkdir(`${work}/raw`,{recursive:true});
const run=args=>new Promise((resolve,reject)=>{const p=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{stdio:['ignore','ignore','pipe']});let err='';p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('exit',c=>c===0?resolve():reject(Error(err)));});
if(phase==='render'){
 for(const [name,file] of [['quorum','quorum-flow.gif'],['aivy','aivy-quorum.gif'],['story','quorum-story.gif']]){
  const m=JSON.parse(await fs.readFile(`${work}/${name}.json`,'utf8'));assert.deepEqual(m.errors,[]);
  const trims=m.segments.map((s,i)=>`[0:v]trim=start=${s.start}:end=${s.end},setpts=PTS-STARTPTS[v${i}]`);
  const graph=trims.join(';')+';'+m.segments.map((_,i)=>`[v${i}]`).join('')+`concat=n=${m.segments.length}:v=1:a=0,fps=10,scale=1280:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle[out]`;
  await run(['-i',`${work}/raw/${name}.webm`,'-filter_complex',graph,'-map','[out]','-loop','0',path.join(media,file)]);
  console.log('Rendered',file);
 }
 process.exit(0);
}
const browser=await chromium.launch({channel:'chrome',headless:true});
const ctx=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,locale:'en-US',timezoneId:'America/Bogota',recordVideo:{dir:`${work}/raw`,size:{width:1920,height:1080}}});
if(phase==='aivy'){
 const cap=(await fs.readFile(process.env.AIVY_MEDIA_SESSION_FILE||'/tmp/quorum-video/cover-agent-capability.private','utf8')).trim();assert(/^[a-f0-9]{64}$/.test(cap));
 await ctx.addInitScript(value=>localStorage.setItem('aivy-quorum-session-v1',value),cap);
}else if(phase==='funded'){
 const state=JSON.parse(await fs.readFile(process.env.QUORUM_MEDIA_STATE_FILE||'/tmp/quorum-video/fund-state.private.json','utf8'));
 const cap=state.origins.find(o=>o.origin===base)?.localStorage.find(k=>k.name==='quorum.testnet.session')?.value;assert(/^[a-f0-9]{64}$/.test(cap));
 await ctx.addInitScript(value=>localStorage.setItem('quorum.testnet.session',value),cap);
}
const requests=[],answers=[],errors=[],segments=[],stills=[];
await ctx.route('**/api/**',r=>{
 const q=r.request(),endpoint=new URL(q.url()).pathname;
 if(q.method()==='GET')return r.continue();
 const allowed=q.method()==='POST'&&['/api/companion/chat','/api/quorum/chat'].includes(endpoint);
 requests.push({method:q.method(),endpoint,allowed});return allowed?r.continue():r.abort();
});
const p=await ctx.newPage(),start=Date.now();
p.on('pageerror',e=>errors.push(e.message));
p.on('response',async r=>{if(r.request().method()==='POST'&&r.url().endsWith('/chat'))answers.push({endpoint:new URL(r.url()).pathname,status:r.status(),answer:await r.json()});});
const pause=ms=>p.waitForTimeout(ms);
async function go(url){await p.goto(url,{waitUntil:'domcontentloaded'});await p.evaluate(()=>document.fonts.ready);}
async function shot(file,fullPage=false){await p.screenshot({path:path.join(media,file),fullPage});stills.push(file);}
async function segment(name,fn){const at=(Date.now()-start)/1000;await fn();segments.push({name,start:at,end:(Date.now()-start)/1000});}
async function move(locator){const b=await locator.boundingBox();assert(b);await p.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:20});}
try{
 if(phase==='quorum'){
  await go(base+'/');await p.locator('[data-policy-id]').first().waitFor();await pause(1300);await shot('01-atlas.png');
  await segment('World map and animated cursor',async()=>{await p.mouse.move(1250,610,{steps:30});await pause(850);await p.mouse.move(820,530,{steps:35});await pause(950);});
  await go(base+'/?at=35.6762,139.6503&place=Tokyo%2C%20Japan');await p.locator('.quote-numbers strong.text-ok').filter({hasText:/\$/}).waitFor();await pause(600);await shot('02-quote.png');
  await segment('Tokyo quote',()=>pause(1900));
  await p.getByRole('button',{name:'Explore data',exact:true}).click();const chart=p.getByRole('slider',{name:'Premium history year',exact:true});await chart.waitFor();await pause(700);
  const b=await chart.boundingBox();
  await segment('Drag through premium history',async()=>{await p.mouse.move(b.x+b.width*.3,b.y+b.height*.6,{steps:20});await p.mouse.down();for(const f of [.3,.45,.6,.75,.88]){await p.mouse.move(b.x+b.width*f,b.y+b.height*.6,{steps:15});await pause(350);}await p.mouse.up();await pause(1000);});await shot('08-explore-history.png');
  await go(base+'/policies?filter=global');await p.locator('.nft-gallery-link').first().waitFor();await pause(500);await shot('04-policies.png');await segment('Global cover NFTs',()=>pause(1900));
  await go(base+'/policy/24');await p.locator('.policy-detail').waitFor();await pause(1100);await segment('Actual Tokyo cover NFT',()=>pause(1900));
  await go(base+'/');await p.locator('[data-policy-id]').first().waitFor();await p.getByRole('button',{name:'Ask Quorum',exact:true}).click();await pause(600);
  await segment('Ask which networks are used',async()=>{
   const input=p.getByLabel('Ask Quorum a question');await input.pressSequentially('Why Hedera, Axelar and Uniswap?',{delay:35});await input.press('Enter');await p.locator('.qm-answer').waitFor();assert.match(await p.locator('.qm-source').innerText(),/AI interpreted/);await pause(3600);
  });await shot('quorum-companion.png');
 }else if(phase==='aivy'){
  await go('https://aivylabs.xyz/');await p.getByRole('link',{name:'Try the cover canvas',exact:false}).scrollIntoViewIfNeeded();await pause(700);await shot('aivy-entry.png');
  await go('https://aivylabs.xyz/quorum');await p.locator('.qc-policy-link').waitFor();assert.match(await p.locator('.qc-policy-link').innerText(),/Policy #34/);await pause(500);await shot('cover-agent.png',true);
  await segment('Saved monthly mandate and policy #34',()=>pause(2400));
  await p.getByRole('button',{name:'Ask your cover companion',exact:true}).click();await pause(600);
  await segment('Ask the monthly agent',async()=>{const input=p.getByRole('textbox',{name:'Ask your cover companion'});await input.pressSequentially('What is my policy status?',{delay:45});await input.press('Enter');await p.locator('.qc-chat-answer').waitFor();assert.match(await p.locator('.qc-chat-source').innerText(),/AI interpreted/);await pause(3300);});await shot('cover-companion.png');
  await p.getByRole('button',{name:'Next renewal',exact:true}).click();await p.locator('.qc-chat-turn').nth(1).locator('.qc-chat-answer').waitFor();
  await segment('Next planned attempt, not a completed purchase',()=>pause(2400));
  const policyLink=p.locator('.qc-chat-proof a').filter({hasText:'Policy #34'}).first();const target=await policyLink.getAttribute('href');assert.equal(target,base+'/policy/34');
  await go(target);await p.locator('.policy-detail').waitFor();await pause(700);await segment('Open the same policy in Quorum',()=>pause(2200));
 }else if(phase==='story'){
  await go(base+'/story');await p.locator('.replay-scene').waitFor();
  for(const [number,title] of [[1,'Choose'],[2,'Commit'],[3,'Confirm'],[4,'Release'],[5,'Verify'],[6,'Protect']]){
   await p.getByRole('button',{name:`Step ${number}: ${title}`,exact:true}).click();await pause(400);await segment(`Recorded mainnet: ${title}`,()=>pause(number===4?1800:1300));if(number===4)await shot('03-story.png');
  }
 }else if(phase==='extra'){
  await p.setViewportSize({width:2732,height:786});await go(base+'/');await p.locator('[data-policy-id]').first().waitFor();await pause(1000);await shot('10-large-screen-map.png');
  await p.setViewportSize({width:1920,height:1080});await go(base+'/swap');await p.locator('.swap-workspace').waitFor();await pause(2000);await shot('05-swap.png');
  await go(base+'/policy/24?position=lp');await p.locator('.policy-detail').waitFor();await pause(1800);await shot('09-policy-clarity.png');
  await p.setViewportSize({width:390,height:900});await go(base+'/policy/34');await p.locator('.policy-detail').waitFor();await p.getByRole('button',{name:'Ask Quorum',exact:true}).click();await p.getByRole('button',{name:'Policy status',exact:true}).click();await p.locator('.qm-answer').waitFor();await shot('quorum-companion-mobile.png');
 }else if(phase==='funded'){
  await p.setViewportSize({width:1440,height:1100});await go(base+'/policies?view=fund');await p.getByRole('region',{name:'Your pool position'}).getByText('26',{exact:true}).waitFor({timeout:45000});await p.getByRole('region',{name:'Fund the shared pool'}).scrollIntoViewIfNeeded();await pause(1000);await shot('11-funding-economics.png');
  await go(base+'/swap?step=swap');await p.getByText('Latest swap · confirmed on Sepolia',{exact:true}).waitFor({timeout:45000});await p.locator('.swap-workspace').scrollIntoViewIfNeeded();await pause(1000);await shot('07-managed-demo.png');
  await p.setViewportSize({width:1920,height:1200});await p.getByRole('button',{name:'Provide swap liquidity →',exact:true}).click();await p.locator('.liquidity-seed').waitFor();await p.locator('#liquidity').scrollIntoViewIfNeeded();await pause(2200);await p.locator('#liquidity').screenshot({path:path.join(media,'06-liquidity.png')});stills.push('06-liquidity.png');
 }else throw Error('Unknown phase');
 assert.deepEqual(errors,[]);assert(requests.every(r=>r.allowed),'A business-write request was attempted');
}catch(e){errors.push(e.message);await p.screenshot({path:`${work}/${phase}-error.png`});process.exitCode=1;console.error(e.message);}
finally{const video=p.video();await ctx.close();await video.saveAs(`${work}/raw/${phase}.webm`);await browser.close();await fs.writeFile(`${work}/${phase}.json`,JSON.stringify({phase,capturedAt:new Date().toISOString(),scope:'Real UI, read-only refresh of existing records. No ledger or mandate changes.',stills,segments,requests,answers,errors},null,2)+'\n');console.log(JSON.stringify({phase,stills,segments:segments.length,posts:requests.length,errors}));}
