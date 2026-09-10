// Refresh the public UI and existing policy #34. Only read-only chat POSTs may pass.
// No account creation, activation, purchase, payment, approval, swap or mandate change.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const work=process.env.QUORUM_VIDEO_REFRESH_WORK||'/tmp/quorum-video/refresh-20260910';
const base='https://quorum.aivylabs.xyz',phase=process.argv[2]||'aivy';
assert(['aivy','map'].includes(phase));
await fs.mkdir(`${work}/raw`,{recursive:true});
const cap=phase==='aivy'?(await fs.readFile(process.env.AIVY_MEDIA_SESSION_FILE||'/tmp/quorum-video/cover-agent-capability.private','utf8')).trim():null;
if(cap)assert(/^[a-f0-9]{64}$/.test(cap));
const browser=await chromium.launch({channel:'chrome',headless:true});
const ctx=await browser.newContext({viewport:{width:1440,height:780},deviceScaleFactor:1,locale:'en-US',timezoneId:'America/Bogota',recordVideo:{dir:`${work}/raw`,size:{width:1440,height:780}}});
if(cap)await ctx.addInitScript(value=>localStorage.setItem('aivy-quorum-session-v1',value),cap);
const requests=[],answers=[],errors=[],segments=[];
await ctx.route('**/api/**',route=>{
 const req=route.request(),endpoint=new URL(req.url()).pathname;
 if(req.method()==='GET')return route.continue();
 const allowed=req.method()==='POST'&&['/api/quorum/chat','/api/companion/chat'].includes(endpoint);
 requests.push({method:req.method(),endpoint,allowed});
 return allowed?route.continue():route.abort();
});
const page=await ctx.newPage(),start=Date.now();
page.on('pageerror',e=>errors.push(e.message));
const pause=ms=>page.waitForTimeout(ms),time=()=>Math.round((Date.now()-start)/10)/100;
async function go(url){await page.goto(url,{waitUntil:'domcontentloaded'});await page.evaluate(()=>document.fonts.ready);}
async function move(locator){const b=await locator.boundingBox();assert(b);await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:20});}
async function segment(name,duration,fn){const at=time();if(fn)await fn();await pause(Math.max(0,(at+duration-time())*1000));segments.push({name,start:at,duration});console.log('Captured',name);}
async function chat(question,input,send,endpoint,selector){
 await input.pressSequentially(question,{delay:55});
 const response=page.waitForResponse(r=>r.url().endsWith(endpoint)&&r.request().method()==='POST');
 await move(send);await send.click();const r=await response;assert.equal(r.status(),200);const answer=await r.json();
 assert.equal(answer.source,'ai');assert.equal(answer.mode,'read_only');assert.equal(answer.topic,'status');assert.ok(answer.ledgerCheckedAt);
 await page.locator(selector).waitFor();answers.push({site:page.url(),question,answer});
 return answer;
}
try{
 if(phase==='map'){
  await go(base+'/');await page.locator('[data-policy-id]').first().waitFor();await pause(1200);
  await segment('map-atlas-current',3,async()=>{await page.mouse.move(1000,450,{steps:30});await pause(500);await page.mouse.move(810,370,{steps:35});});
  const field=page.getByRole('combobox',{name:'Find a city or municipality'});
  await segment('map-search-current',9,async()=>{await move(field);await field.click();await field.pressSequentially('Medellin',{delay:90});const option=page.getByRole('option').filter({hasText:/Medellín|Medellin/}).first();await option.waitFor();await pause(500);await move(option);await option.click();await page.locator('.quote-numbers strong.text-ok').filter({hasText:/\$/}).waitFor();});
  await page.getByRole('button',{name:'Explore data',exact:true}).click();
  const chart=page.getByRole('slider',{name:'Premium history year',exact:true});await chart.waitFor();await chart.scrollIntoViewIfNeeded();await pause(700);
  const panel=await page.locator('#historical-exploration').boundingBox();
  assert(panel);await fs.writeFile(`${work}/history-panel.json`,JSON.stringify(panel));
  const b=await chart.boundingBox();
  await segment('map-history-current',8,async()=>{await page.mouse.move(b.x+b.width*.27,b.y+b.height*.5,{steps:25});await page.mouse.down();for(const f of [.27,.4,.55,.7,.85,.97]){await page.mouse.move(b.x+b.width*f,b.y+b.height*.5,{steps:18});await pause(350);}await page.mouse.up();});
  await page.screenshot({path:path.join(root,'assets/history-current.png')});
 }else{
  await go('https://aivylabs.xyz/');const entry=page.getByRole('link',{name:'Try the cover canvas',exact:false});await entry.scrollIntoViewIfNeeded();await pause(900);
  await page.screenshot({path:path.join(root,'assets/aivy-entry-current.png')});
  await segment('aivy-entry-current',3,async()=>{await pause(1000);await move(entry);await entry.click();await page.locator('.qc-policy-link').waitFor();});
  assert.match(await page.locator('.qc-policy-link').innerText(),/Policy #34/);
  await page.locator('.qc-board').evaluate(el=>scrollTo({top:el.getBoundingClientRect().top+scrollY-24,behavior:'smooth'}));await pause(600);
  await segment('aivy-canvas-current',5,async()=>{await move(page.getByRole('button',{name:'Pause agent',exact:true}));});
  await page.evaluate(()=>scrollTo(0,0));await page.getByRole('button',{name:'Ask your cover companion',exact:true}).click();await pause(900);
  const panel=await page.locator('.qc-chat-panel').boundingBox();assert(panel);
  await fs.writeFile(`${work}/aivy-panel.json`,JSON.stringify(panel));
  await segment('aivy-companion-current',10,async()=>{await chat('Am I covered?',page.getByRole('textbox',{name:'Ask your cover companion'}),page.getByRole('button',{name:'Send question'}),'/api/quorum/chat','.qc-chat-answer');});
  await page.screenshot({path:path.join(root,'assets/aivy-companion-current.png')});
  const link=page.locator('.qc-chat-proof a').filter({hasText:'Policy #34'}).first();assert.equal(await link.getAttribute('href'),base+'/policy/34');
  // Open the exact receipt URL exposed by the answer; use this page for a continuous recording.
  await move(link);await go(await link.getAttribute('href'));await page.locator('.policy-detail').waitFor();await pause(700);
  await segment('aivy-policy-current',6,async()=>{await page.mouse.move(950,450,{steps:25});});
  await page.getByRole('button',{name:'Ask Quorum',exact:true}).click();await pause(900);
  const qp=await page.locator('.qm-panel').boundingBox();await fs.writeFile(`${work}/quorum-panel.json`,JSON.stringify(qp));
  await segment('quorum-status-current',8,async()=>{await chat('Is this policy active?',page.getByLabel('Ask Quorum a question'),page.getByRole('button',{name:'Send question to Quorum'}),'/api/companion/chat','.qm-answer');});
  await page.screenshot({path:path.join(root,'assets/quorum-status-current.png')});
 }
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);assert(requests.every(r=>r.allowed));
}catch(e){errors.push(e.message);await page.screenshot({path:`${work}/${phase}-error.png`});process.exitCode=1;console.error(e.message);}
finally{
 const video=page.video();await ctx.close();await video.saveAs(`${work}/raw/${phase}.webm`);await browser.close();
 await fs.writeFile(`${work}/${phase}.json`,JSON.stringify({capturedAt:new Date().toISOString(),phase,scope:'Read-only refresh of actual UI and existing policy #34; no ledger or mandate change.',viewport:{width:1440,height:780},sourcePlaybackRate:1,segments,requests,answers,errors},null,2)+'\n');
}
if(errors.length)process.exit(1);
for(const s of segments){
 await new Promise((resolve,reject)=>{const p=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(s.start),'-i',`${work}/raw/${phase}.webm`,'-t',String(s.duration),'-an','-vf','fps=30','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-color_range','tv','-movflags','+faststart',path.join(root,'assets/footage',s.name+'.mp4')],{stdio:['ignore','ignore','pipe']});let err='';p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('exit',c=>c===0?resolve():reject(Error(err)));});
}
await fs.copyFile(`${work}/${phase}.json`,path.join(root,`${phase}-refresh-evidence.json`));
console.log(JSON.stringify({phase,segments:segments.length,answers:answers.map(a=>({question:a.question,topic:a.answer.topic})),errors}));
