// Render the editable cut with FFmpeg. Screen footage always plays at 1x;
// confirmation waits are removed with cuts, and final frames may be held.
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(here);
const work=process.env.QUORUM_VIDEO_WORK||'/tmp/quorum-video';
const build=path.join(work,'render');await fs.mkdir(build,{recursive:true});await fs.mkdir(path.join(root,'assets/footage'),{recursive:true});
const run=(args)=>new Promise((resolve,reject)=>{if(args.includes('libx264'))args.splice(args.length-1,0,'-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-color_range','tv');const p=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{stdio:['ignore','ignore','pipe']});let err='';p.stderr.on('data',d=>err+=d);p.on('exit',c=>c===0?resolve():reject(Error(err)));});
const edit=JSON.parse(await fs.readFile(path.join(root,'edit.json'),'utf8'));
const shots=structuredClone(edit.shots);
const duration=JSON.parse(await fs.readFile(path.join(root,'timeline.json'),'utf8')).duration;
if(edit.sourcePlaybackRate!==1||shots.reduce((n,s)=>n+s.duration,0)!==duration)throw Error('Shots do not match the narration timeline at normal speed.');
let elapsed=0;
for(const shot of shots){if(shot.start!==elapsed)throw Error('Non-contiguous shot timeline.');elapsed+=shot.duration;}
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const browserErrors=[];page.on('pageerror',e=>browserErrors.push(e.message));
const frames=new Map();
try{
for(let i=0;i<shots.length;i++){
 const shot=shots[i],id=String(i).padStart(2,'0');console.log(`Rendering ${id}: ${shot.scene}`);
 const key=shot.scene+(shot.query||'');let frame=frames.get(key);
 if(!frame){frame=path.join(build,`frame-${id}.png`);await page.goto(`file://${here}/frames.html?scene=${shot.scene}&${shot.query||''}`);await page.evaluate(()=>window.ready);if(browserErrors.length)throw Error(browserErrors.join('\n'));if(!(await page.locator('#content').innerText()).trim())throw Error('Blank graphics frame: '+shot.scene);const bad=await page.locator('img').evaluateAll(images=>images.filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src));if(bad.length)throw Error('Missing image: '+bad.join(', '));await page.screenshot({path:frame});frames.set(key,frame);}
 const [x,y,w,h]=shot.rect||[160,160,1600,867];
 const output=path.join(build,`${id}.mp4`);
 if(shot.source){
  const source=path.resolve(root,shot.source);
  if(!source.startsWith(root+path.sep)||!await fs.stat(source).catch(()=>null))throw Error('Missing source footage: '+shot.source);
  const crop=shot.mediaCrop?'crop='+shot.mediaCrop+',':'';
  await run(['-loop','1','-framerate','30','-i',frame,'-i',source,'-filter_complex',`[1:v]${crop}scale=${w}:${h},setsar=1,tpad=stop_mode=clone:stop_duration=${shot.duration}[v];[0:v][v]overlay=${x}:${y}:shortest=1,format=yuv420p[out]`,'-map','[out]','-t',String(shot.duration),'-an','-c:v','libx264','-preset','veryfast','-crf','20','-threads','4',output]);
 }else if(shot.still){
  await run(['-loop','1','-framerate','30','-i',frame,'-loop','1','-i',path.join(root,'assets',shot.still),'-filter_complex',`[1:v]split=2[a][b];[a]crop=1400:140:20:220,scale=1720:172[status];[b]crop=1400:300:20:700,scale=1720:368[transfers];[0:v][status]overlay=100:355[base];[base][transfers]overlay=100:574,format=yuv420p[out]`,'-map','[out]','-t',String(shot.duration),'-an','-c:v','libx264','-preset','veryfast','-crf','20','-threads','4',output]);
 }else{
  await run(['-loop','1','-framerate','30','-i',frame,'-t',String(shot.duration),'-vf',`scale=1958:1102,crop=1920:1080:x='19+10*sin(t/12)':y=11,fade=t=in:st=0:d=0.25,format=yuv420p`,'-an','-c:v','libx264','-preset','veryfast','-crf','20','-threads','4',output]);
 }
 shot.start=shots.slice(0,i).reduce((n,s)=>n+s.duration,0);
}
}finally{await browser.close();}
// edit.json remains the source of truth; rendering does not rewrite editorial choices.
await fs.writeFile(path.join(build,'concat.txt'),shots.map((_,i)=>`file '${String(i).padStart(2,'0')}.mp4'`).join('\n'));
await run(['-f','concat','-safe','0','-i',path.join(build,'concat.txt'),'-c','copy','-movflags','+faststart',path.join(root,'aivy-quorum-visual-cut.mp4')]);
console.log('Visual cut exported. Human narration is still required.');
