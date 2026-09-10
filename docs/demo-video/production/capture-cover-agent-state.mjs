// Read-only re-capture of the existing mandate after UI changes. All POSTs blocked.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.env.QUORUM_VIDEO_WORK||'/tmp/quorum-video';
const cap=(await fs.readFile(process.env.QUORUM_COVER_AGENT_SESSION_FILE||`${root}/cover-agent-capability.private`,'utf8')).trim();
assert(/^[a-f0-9]{64}$/.test(cap));
const browser=await chromium.launch({channel:'chrome',headless:true});
const ctx=await browser.newContext({viewport:{width:1440,height:780},deviceScaleFactor:1,locale:'en-US',timezoneId:'America/Bogota',recordVideo:{dir:`${root}/raw`,size:{width:1440,height:780}}});
await ctx.addInitScript(token=>localStorage.setItem('aivy-quorum-session-v1',token),cap);
await ctx.route('**/api/**',r=>r.request().method()==='GET'?r.continue():r.abort());
const p=await ctx.newPage(),start=Date.now(),errors=[],marks=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto('https://aivylabs.xyz/quorum');await p.locator('.qc-policy-link').waitFor();await p.evaluate(()=>document.fonts.ready);
 assert.equal(await p.getByRole('alert').count(),0);assert.match(await p.locator('.qc-policy-link').innerText(),/Policy #34/);
 await p.screenshot({path:`${root}/stills/cover-agent-current.png`,fullPage:true});
 await p.locator('.qc-board').evaluate(el=>scrollTo({top:el.getBoundingClientRect().top+scrollY-24,behavior:'smooth'}));await p.waitForTimeout(1000);marks.push({name:'confirmed',time:(Date.now()-start)/1000});await p.screenshot({path:`${root}/stills/cover-agent-overview.png`});
 const b=await p.getByRole('button',{name:'Pause agent'}).boundingBox();await p.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:40});await p.waitForTimeout(6500);
 for(const width of [390,320]){await p.setViewportSize({width,height:900});await p.evaluate(()=>scrollTo(0,0));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:`${root}/stills/cover-agent-current-${width}.png`,fullPage:true});}
 assert.deepEqual(errors,[]);
}finally{
 const video=p.video();await ctx.close();await video.saveAs(`${root}/raw/cover-agent-state.webm`);await browser.close();
 await fs.writeFile(`${root}/cover-agent-state.json`,JSON.stringify({phase:'cover-agent-state',site:'https://aivylabs.xyz/quorum',capturedAt:new Date().toISOString(),scope:'Read-only view of existing policy #34. No new purchase.',viewport:{width:1440,height:780},marks,errors,requests:[]},null,2)+'\n');
}
