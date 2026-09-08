// Browser QA. The optional microphone check uses Chrome's synthetic test input,
// never a user's microphone and never as narration in the delivered video.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.QUORUM_STUDIO_URL||'http://127.0.0.1:5180/';
const out=process.env.QUORUM_VIDEO_WORK||'/tmp/quorum-video';
const report=[];
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
try{
 for(const width of [1600,1024,768,390,320]){
  const ctx=await browser.newContext({viewport:{width,height:1000},permissions:['microphone']});const p=await ctx.newPage(),errors=[],failed=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&r.url().startsWith(base))failed.push({url:r.url(),status:r.status()});});
  await p.goto(base);await p.locator('#chapters button').nth(11).waitFor();await p.locator('video').evaluate(v=>new Promise(resolve=>{if(v.readyState>=1)return resolve();v.addEventListener('loadedmetadata',resolve,{once:true});}));
  assert.equal(await p.locator('video').evaluate(v=>v.duration),225);assert.equal(await p.locator('video').evaluate(v=>v.videoWidth),1920);
  for(const [index,start] of [[3,53],[4,77],[7,139],[10,201]]){
   await p.locator('#chapters button').nth(index).click();assert.equal(await p.locator('video').evaluate(v=>Math.round(v.currentTime)),start);assert.equal(await p.locator('#cue-count').innerText(),`${index+1} / 12`);
  }
  await p.locator('#rehearse').click();await p.waitForTimeout(1500);assert.equal(await p.locator('video').evaluate(v=>v.paused),false);assert.equal(await p.locator('#cue-count').innerText(),'1 / 12');await p.locator('video').evaluate(v=>v.pause());
  await p.locator('.full-script summary').click();assert.equal(await p.locator('#script-table tr').count(),12);await p.locator('.full-script summary').click();
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await p.screenshot({path:`${out}/studio-${width}.png`,fullPage:true});
  if(width===1600){
   await p.locator('.record-tools summary').click();await p.locator('#record').click();await p.getByText('Recording your voice. Read naturally; the next passage appears automatically.').waitFor();await p.waitForTimeout(1100);await p.locator('#stop').click();await p.locator('#takes a').waitFor();assert((await p.locator('#takes a').getAttribute('href')).startsWith('blob:'));assert.equal(await p.locator('#record').isEnabled(),true);
   // Ensure an audio export exists and contains bytes, without retaining it.
   const bytes=await p.locator('#takes a').evaluate(async a=>(await (await fetch(a.href)).arrayBuffer()).byteLength);assert(bytes>500);report.push({microphoneQa:'Synthetic browser input recorded locally and exported as a non-empty Blob; not saved or mixed into demo',bytes});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);report.push({width,duration:225,videoWidth:1920,chapters:true,playback:true,noOverflow:true,errors,failed});await ctx.close();console.log('Studio passed',width);
 }
}finally{await browser.close();await fs.writeFile(`${out}/studio-qa.json`,JSON.stringify({base,at:new Date().toISOString(),report},null,2));}
