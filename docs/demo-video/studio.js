const video=document.getElementById('video');
const byId=id=>document.getElementById(id);
const fmt=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
let chapters=[],active=-1,narration=null,recorder=null,stream=null,recording=false;
const proofs={
 0:[['USGS · Colombia record','https://earthquake.usgs.gov/earthquakes/eventpage/us7000kp2i'],['USGS · Venezuela record','https://earthquake.usgs.gov/earthquakes/eventpage/us1000gez7']],
 3:[['New Medellín cover #33','https://quorum.aivylabs.xyz/policy/33']],
 4:[['Blocky402 payment evidence','EVIDENCE.md']],
 5:[['4 HBAR mainnet transfer','https://hashscan.io/mainnet/transaction/1788563478.715401105']],
 6:[['Blocked oracle-only schedule','https://hashscan.io/mainnet/schedule/0.0.10843725']],
 7:[['New confirmed Uniswap swap','https://sepolia.etherscan.io/tx/0x2676ea1b5b9ee1b571c94a3e9b0d1ea6996a50fa08a05199c7b0b502145c389c'],['Raw Sepolia RPC receipt','assets/swap-receipt.json']],
 8:[['Recorded Uniswap position lifecycle','https://github.com/jmgomezl/aivy-parametric-pool/blob/main/docs/evidence/uniswap-liquidity.json']],
 9:[['Shared-pool economics','https://github.com/jmgomezl/aivy-parametric-pool/blob/main/docs/ECONOMIC-MODEL.md']],
 10:[['Open the Aivy cover canvas','https://aivylabs.xyz/quorum'],['Actual monthly purchase · policy #34','https://quorum.aivylabs.xyz/policy/34']],
 11:[['Actual answers from both sites','aivy-refresh-evidence.json'],['Mirror Node response','mirror-refresh-evidence.json'],['Read-only architecture','https://github.com/jmgomezl/aivy-parametric-pool/blob/main/docs/MIRROR-NODE.md']],
 12:[['Prior-work disclosure','https://github.com/jmgomezl/aivy-parametric-pool#prior-work-boundary-continuity-track']]
};
function show(i){if(i===active||!chapters[i])return;active=i;const c=chapters[i];byId('cue-title').textContent=c.title;byId('cue-script').textContent=c.script;byId('cue-direction').textContent=c.direction;byId('cue-time').textContent=`${fmt(c.start)}–${fmt(c.end)}`;byId('cue-count').textContent=`${i+1} / ${chapters.length}`;byId('prev').disabled=i===0;byId('next').disabled=i===chapters.length-1;document.querySelectorAll('.chapters button').forEach((b,j)=>b.setAttribute('aria-current',String(i===j)));const nav=byId('chapters'),selected=nav.children[i];if(selected){const left=selected.getBoundingClientRect().left-nav.getBoundingClientRect().left+nav.scrollLeft;nav.scrollLeft=Math.max(0,left-nav.clientWidth/2+selected.clientWidth/2);}const box=byId('chapter-proof');box.replaceChildren();for(const [title,url] of proofs[i]||[]){const a=document.createElement('a');a.href=url;a.textContent=title+' ↗';a.target='_blank';a.rel='noreferrer';box.append(a);}}
function seek(i){if(recording)return;video.currentTime=chapters[Math.max(0,Math.min(chapters.length-1,i))].start;show(Math.max(0,Math.min(chapters.length-1,i)));}
fetch('timeline.json?v=20260910-mirror').then(r=>{if(!r.ok)throw Error('Script could not load.');return r.json();}).then(data=>{chapters=data.chapters;chapters.forEach((c,i)=>{const b=document.createElement('button');b.textContent=String(i+1).padStart(2,'0');b.title=c.title;b.setAttribute('aria-label',`${fmt(c.start)} · ${c.title}`);b.onclick=()=>seek(i);byId('chapters').append(b);const row=document.createElement('tr');for(const value of [`${fmt(c.start)}–${fmt(c.end)}`,c.script,c.direction]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}byId('script-table').append(row);});show(0);}).catch(e=>byId('cue-script').textContent=e.message);
video.addEventListener('timeupdate',()=>{const i=chapters.findIndex(c=>video.currentTime>=c.start&&video.currentTime<c.end);if(i>=0)show(i);});
async function playPreview(){try{await video.play();}catch(e){if(e.name!=='AbortError')byId('record-status').textContent='Playback could not start. Use the video controls to try again.';}}
byId('aivy-preview').onclick=()=>{if(recording)return;seek(10);void playPreview();};
byId('prev').onclick=()=>seek(active-1);byId('next').onclick=()=>seek(active+1);
byId('rehearse').onclick=()=>{if(recording)return;video.currentTime=0;void playPreview();};
video.addEventListener('play',()=>{if(narration&&!recording){narration.currentTime=video.currentTime;void narration.play().catch(()=>{});}});
video.addEventListener('pause',()=>{narration?.pause();});video.addEventListener('seeking',()=>{if(narration)narration.currentTime=video.currentTime;});
byId('audio-file').onchange=e=>{const file=e.target.files?.[0];if(!file)return;if(narration){narration.pause();URL.revokeObjectURL(narration.src);}narration=new Audio(URL.createObjectURL(file));narration.addEventListener('error',()=>byId('record-status').textContent='That recording could not be played. Try a supported audio file.');byId('record-status').textContent=`Previewing “${file.name}”. Press Rehearse to play it with the video.`;};
function stop(){if(recorder?.state==='recording')recorder.stop();video.pause();stream?.getTracks().forEach(t=>t.stop());stream=null;recording=false;byId('record').disabled=false;byId('stop').disabled=true;byId('rehearse').disabled=false;video.controls=true;byId('record-status').classList.remove('recording');}
byId('stop').onclick=stop;video.addEventListener('ended',()=>{if(recording)stop();});
byId('record').onclick=async()=>{
 try{
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Microphone recording needs a supported browser on HTTPS or localhost. You can still download the script and visual edit.');
  byId('record').disabled=true;narration?.pause();video.pause();video.currentTime=0;
  stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
  const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(x=>MediaRecorder.isTypeSupported(x));recorder=new MediaRecorder(stream,mime?{mimeType:mime}:{});const chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=()=>{const blob=new Blob(chunks,{type:recorder.mimeType}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`quorum-narration-${Date.now()}.${recorder.mimeType.includes('mp4')?'m4a':'webm'}`;a.textContent='Download your voice recording ↓';byId('takes').append(a);byId('record-status').textContent='Your take is ready. Download it before closing this tab; it has not been uploaded.';};
  const countdown=byId('countdown');countdown.hidden=false;for(let i=3;i>0;i--){countdown.textContent=String(i);await new Promise(r=>setTimeout(r,1000));}countdown.hidden=true;
  recording=true;byId('stop').disabled=false;byId('rehearse').disabled=true;video.controls=false;recorder.start(1000);await video.play();byId('record-status').textContent='Recording your voice. Read naturally; the next passage appears automatically.';byId('record-status').classList.add('recording');
 }catch(e){stop();byId('countdown').hidden=true;byId('record-status').textContent=e.message;}
};
window.addEventListener('beforeunload',e=>{if(recording){e.preventDefault();e.returnValue='';}});
