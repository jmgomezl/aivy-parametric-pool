// Actual public Quorum interaction. Anonymous; all API writes except read-only chat blocked.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const work=process.env.QUORUM_VIDEO_WORK||'/tmp/quorum-video';
await fs.mkdir(`${work}/raw`,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const ctx=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,locale:'en-US',timezoneId:'America/Bogota',recordVideo:{dir:`${work}/raw`,size:{width:1920,height:1080}}});
const writes=[],errors=[],question='Why Hedera, Axelar and Uniswap?';
await ctx.route('**/api/**',r=>{
 const req=r.request();
 if(req.method()==='GET')return r.continue();
 const endpoint=new URL(req.url()).pathname;writes.push({method:req.method(),endpoint});
 return req.method()==='POST'&&endpoint==='/api/companion/chat'?r.continue():r.abort();
});
const p=await ctx.newPage(),start=Date.now();let answer,mark,panel;
p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto('https://quorum.aivylabs.xyz/');await p.evaluate(()=>document.fonts.ready);
 await p.getByRole('button',{name:'Ask Quorum',exact:true}).click();
 await p.locator('.qm-panel').waitFor();await p.waitForTimeout(900);
 panel=await p.locator('.qm-panel').boundingBox();
 assert.deepEqual(Object.fromEntries(Object.entries(panel).map(([k,v])=>[k,Math.round(v)])),{x:1510,y:284,width:390,height:700});
 await p.getByLabel('Ask Quorum a question').pressSequentially(question,{delay:35});
 mark=(Date.now()-start)/1000;
 const response=p.waitForResponse(r=>r.url().endsWith('/api/companion/chat')&&r.request().method()==='POST');
 await p.getByRole('button',{name:'Send question to Quorum'}).click();
 const r=await response;assert.equal(r.status(),200);answer=await r.json();
 assert.equal(answer.source,'ai');assert.equal(answer.topic,'network');assert.equal(answer.mode,'read_only');
 await p.locator('.qm-answer').waitFor();await p.waitForTimeout(600);
 assert.match(await p.locator('.qm-source').innerText(),/AI interpreted/);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await p.screenshot({path:path.join(root,'assets/quorum-companion.png')});
 await p.waitForTimeout(10500);
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[{method:'POST',endpoint:'/api/companion/chat'}]);
}finally{
 const video=p.video();await ctx.close();await video.saveAs(`${work}/raw/quorum-companion.webm`);await browser.close();
}
const clipStart=Math.max(0,Math.round((mark-0.25)*100)/100);
await fs.mkdir(path.join(root,'assets/footage'),{recursive:true});
await new Promise((resolve,reject)=>{
 const ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(clipStart),'-i',`${work}/raw/quorum-companion.webm`,'-t','10','-an','-vf','fps=30','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-color_range','tv','-movflags','+faststart',path.join(root,'assets/footage/quorum-companion.mp4')],{stdio:['ignore','ignore','pipe']});let err='';ff.stderr.on('data',d=>err+=d);ff.on('error',reject);ff.on('exit',c=>c===0?resolve():reject(Error(err)));
});
await fs.writeFile(path.join(root,'companion-evidence.json'),JSON.stringify({capturedAt:new Date().toISOString(),site:'https://quorum.aivylabs.xyz/',scope:'Actual anonymous read-only chat, not a transaction or a fresh health check of all networks.',question,answer,viewport:{width:1920,height:1080},panel,sourcePlaybackRate:1,chatStart:mark,clipStart,clipDuration:10,requests:writes,errors},null,2)+'\n');
console.log(JSON.stringify({source:answer.source,topic:answer.topic,chatStart:mark,panel,errors}));
