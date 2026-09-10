// One genuine, bounded testnet activation. Never rerun a submitted purchase to improve footage.
// Raw video and the browser capability stay in the private working directory.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
if(!process.argv.includes('--execute'))throw Error('This recording creates one real testnet policy. Pass --execute only for an authorized capture.');
const root=process.env.QUORUM_VIDEO_WORK||'/tmp/quorum-video';
await fs.mkdir(`${root}/raw`,{recursive:true});await fs.mkdir(`${root}/stills`,{recursive:true});
await fs.writeFile(`${root}/cover-agent-submission.private.json`,JSON.stringify({reservedAt:new Date().toISOString()}),{flag:'wx',mode:0o600});
const browser=await chromium.launch({channel:'chrome',headless:true});
const ctx=await browser.newContext({viewport:{width:1440,height:780},deviceScaleFactor:1,locale:'en-US',timezoneId:'America/Bogota',recordVideo:{dir:`${root}/raw`,size:{width:1440,height:780}}});
const posts=[],marks=[],errors=[];let page,start;
const mark=name=>{marks.push({name,time:(Date.now()-start)/1000});console.log('Recorded',name);};
const pause=seconds=>page.waitForTimeout(seconds*1000);
async function click(locator){await locator.scrollIntoViewIfNeeded();const b=await locator.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:24});await pause(.35);await locator.click();}
async function shot(name){await page.screenshot({path:`${root}/stills/cover-agent-${name}.png`,fullPage:true});}
async function state(){return page.evaluate(async()=>{const r=await fetch('/api/quorum/',{headers:{Authorization:`Bearer ${localStorage.getItem('aivy-quorum-session-v1')}`}});if(!r.ok)throw Error('State read failed');return r.json();});}
await ctx.route('**/api/**',async route=>{
 const r=route.request(),p=new URL(r.url()).pathname;
 if(r.method()==='GET')return route.continue();
 const allowed=['/api/quorum/quote','/api/quorum/start','/api/quorum/activate','/api/quorum/pause','/api/quorum/resume','/api/quorum/run'];
 if(!allowed.includes(p))return route.abort();
 if(['/api/quorum/start','/api/quorum/activate'].includes(p)&&posts.includes(p))throw Error('Refusing a repeated starter or activation during capture.');
 posts.push(p);
 await fs.writeFile(`${root}/cover-agent-submission.private.json`,JSON.stringify({submittedAt:new Date().toISOString(),paths:posts}),{mode:0o600});
 return route.continue();
});
try{
 page=await ctx.newPage();start=Date.now();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://aivylabs.xyz/',{waitUntil:'domcontentloaded'});
 const entry=page.getByRole('link',{name:'Try the cover canvas'});await entry.waitFor();await entry.scrollIntoViewIfNeeded();await pause(2);mark('homepage');await shot('homepage');await pause(2);await click(entry);
 await page.getByRole('button',{name:'Review my plan'}).waitFor();await page.evaluate(()=>document.fonts.ready);await pause(1);
 await click(page.getByRole('button',{name:'Review my plan'}));
 const activate=page.getByRole('button',{name:'Activate & buy first cover'});await activate.waitFor({timeout:45000});assert(await activate.isDisabled());
 await page.evaluate(()=>scrollTo({top:250,behavior:'smooth'}));await pause(1);mark('review');await shot('review');await pause(2);
 await click(page.getByRole('checkbox'));await pause(1);await click(activate);mark('submitted');
 // Persist access immediately, before awaiting confirmation or any additional action.
 await ctx.storageState({path:`${root}/cover-agent-state.private.json`});
 const cap=await page.evaluate(()=>localStorage.getItem('aivy-quorum-session-v1'));
 assert(/^[a-f0-9]{64}$/.test(cap||''));await fs.writeFile(`${root}/cover-agent-capability.private`,cap,{mode:0o600});
 await page.locator('.qc-policy-link').waitFor({timeout:160000});
 await page.evaluate(()=>scrollTo({top:240,behavior:'smooth'}));await pause(1);mark('confirmed');await shot('confirmed');await pause(8);
 const first=await state();assert.equal(first.mandate.attempts.length,1);assert.equal(first.mandate.attempts[0].status,'complete');assert.equal(first.mandate.rules.monthlyBudget,10);assert.equal(first.mandate.rules.minimumPayout,800);
 await click(page.getByRole('button',{name:'Check renewal now'}));await page.getByText('No extra policy purchased.',{exact:false}).waitFor();
 assert.equal((await state()).mandate.attempts.length,1);
 await click(page.getByRole('button',{name:'Pause agent'}));await page.getByRole('button',{name:'Resume agent'}).waitFor();mark('paused');await pause(2);await shot('paused');
 await page.reload();await page.getByRole('button',{name:'Resume agent'}).waitFor();assert.equal((await state()).mandate.enabled,false);
 await click(page.getByRole('button',{name:'Resume agent'}));await page.getByRole('button',{name:'Pause agent'}).waitFor();
 const final=await state();assert.equal(final.mandate.enabled,true);assert.equal(final.mandate.attempts.length,1);assert.equal(final.mandate.attempts[0].policy.serial,first.mandate.attempts[0].policy.serial);
 const desktopErrors=[...errors];assert.deepEqual(desktopErrors,[]);
 for(const width of [390,320]){await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));await pause(.5);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await shot(`mobile-${width}`);}
 await fs.writeFile(`${root}/cover-agent-evidence.json`,JSON.stringify({checkedAt:new Date().toISOString(),site:'https://aivylabs.xyz/quorum',scope:'One real first purchase. Future monthly dates are planned, not executed.',checks:['consent required','first policy confirmed','run did not duplicate','pause persisted across reload','resume did not duplicate','390/320 no overflow'],...final},null,2)+'\n');
 console.log(JSON.stringify({policy:final.mandate.attempts[0].policy,nextDueAt:final.mandate.nextDueAt,enabled:final.mandate.enabled}));mark('end');
}catch(e){errors.push(e.message);console.error(e.message);if(page)await shot('error');process.exitCode=1;}
finally{
 if(page)await ctx.storageState({path:`${root}/cover-agent-state.private.json`});
 const video=page?.video();await ctx.close();if(video)await video.saveAs(`${root}/raw/cover-agent.webm`);await browser.close();
 await fs.writeFile(`${root}/cover-agent.json`,JSON.stringify({phase:'cover-agent',site:'https://aivylabs.xyz/quorum',capturedAt:new Date().toISOString(),viewport:{width:1440,height:780},marks,errors,requests:posts},null,2)+'\n');
}
