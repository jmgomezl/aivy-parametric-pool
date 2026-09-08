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
const captureIndex=JSON.parse(await fs.readFile(path.join(root,'assets/capture-index.json'),'utf8').catch(()=>'{"_initial":true}'));
const mark=async(phase,name)=>(captureIndex[phase]||JSON.parse(await fs.readFile(`${work}/${phase}.json`,'utf8'))).marks.find(m=>m.name===name).time;
const shots=[];const add=(scene,duration,clip=null,extra={})=>shots.push({scene,duration,clip,...extra});
const clip=async(phase,name,duration,options={})=>({phase,start:await mark(phase,name),duration,...options});
add('hook',4);add('events',6);add('shop',10);add('intro',8);
add('map',6,await clip('map','atlas',6));
add('map',10,await clip('map','search',10));
add('history',9,await clip('map','history',8.4,{crop:'440:510:1000:30'}),{rect:[1082,202,616,714]});
add('create',6,await clip('cover','before',6));
add('create',5,await clip('cover','confirmed',5));
add('nft',7);
add('receipt',6,null,{still:'premium-explorer.png',query:'network=HEDERA%20TESTNET&title=Premium%20paid.%20A%20real%20ledger%20record.',crop:'1440:800:0:160',rect:[100,327,1720,650]});
add('oracle',6,await clip('oracle','before',6));
add('oracle',8,await clip('oracle','confirmed',8));
add('oracle-closeup',8,await clip('oracle','receipts',6.8),{mediaCrop:'430:630:740:10',rect:[1120,180,580,850]});
add('gate',11);
add('release',7,await clip('story','one',7));
add('release',4,await clip('story','release',4));
add('receipt',4,null,{still:'mainnet-explorer.png',query:'network=RECORDED%20MAINNET&title=Four%20HBAR.%20Actually%20transferred.',crop:'1440:800:0:160',rect:[100,327,1720,650]});
add('guard',14,await clip('story','guard',7));
add('crosschain',7);
add('bridge',6,await clip('bridge','before',6));
add('bridge',5,await clip('bridge','source',5));
add('swap',6,await clip('swap','quote',6));
add('swap',5,await clip('swap','confirmed',5));
add('swap-proof',4);
add('lp',8,await clip('liquidity','lp',7));
add('fund',5,await clip('fund','before',5));
add('fund',3,await clip('fund','confirmed',3));
add('fund',5,await clip('fund-position','position',5));
add('business',8);add('novelty',16);add('close',8);
if(shots.reduce((n,s)=>n+s.duration,0)!==225)throw Error('Timeline does not total 3:45.');
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
 if(shot.clip){
  const source=path.join(root,'assets/footage',`${id}-${shot.clip.phase}.mp4`);
  if(!await fs.stat(source).catch(()=>null))await run(['-ss',String(shot.clip.start),'-i',`${work}/raw/${shot.clip.phase}.webm`,'-t',String(shot.clip.duration),'-an','-vf','fps=30','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',source]);
  shot.source=path.relative(root,source);delete shot.clip;
  const crop=shot.mediaCrop?'crop='+shot.mediaCrop+',':shot.scene==='history'?'crop=440:510:1000:30,':'';
  await run(['-loop','1','-framerate','30','-i',frame,'-i',source,'-filter_complex',`[1:v]${crop}scale=${w}:${h},setsar=1,tpad=stop_mode=clone:stop_duration=${shot.duration}[v];[0:v][v]overlay=${x}:${y}:shortest=1,format=yuv420p[out]`,'-map','[out]','-t',String(shot.duration),'-an','-c:v','libx264','-preset','veryfast','-crf','20','-threads','4',output]);
 }else if(shot.still){
  await run(['-loop','1','-framerate','30','-i',frame,'-loop','1','-i',path.join(root,'assets',shot.still),'-filter_complex',`[1:v]split=2[a][b];[a]crop=1400:140:20:220,scale=1720:172[status];[b]crop=1400:300:20:700,scale=1720:368[transfers];[0:v][status]overlay=100:355[base];[base][transfers]overlay=100:574,format=yuv420p[out]`,'-map','[out]','-t',String(shot.duration),'-an','-c:v','libx264','-preset','veryfast','-crf','20','-threads','4',output]);
 }else{
  await run(['-loop','1','-framerate','30','-i',frame,'-t',String(shot.duration),'-vf',`scale=1958:1102,crop=1920:1080:x='19+10*sin(t/12)':y=11,fade=t=in:st=0:d=0.25,format=yuv420p`,'-an','-c:v','libx264','-preset','veryfast','-crf','20','-threads','4',output]);
 }
 shot.start=shots.slice(0,i).reduce((n,s)=>n+s.duration,0);
}
}finally{await browser.close();}
await fs.writeFile(path.join(root,'edit.json'),JSON.stringify({duration:225,resolution:[1920,1080],fps:30,sourcePlaybackRate:1,shots},null,2)+'\n');
await fs.writeFile(path.join(build,'concat.txt'),shots.map((_,i)=>`file '${String(i).padStart(2,'0')}.mp4'`).join('\n'));
await run(['-f','concat','-safe','0','-i',path.join(build,'concat.txt'),'-c','copy','-movflags','+faststart',path.join(root,'aivy-quorum-visual-cut.mp4')]);
console.log('Visual cut exported. Human narration is still required.');
