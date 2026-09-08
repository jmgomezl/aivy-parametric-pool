import fs from 'node:fs/promises';
import path from 'node:path';
import { withIssuanceLock } from '../../src/issuance-lock.js';
const [directory,mode='hold',timeout='3000']=process.argv.slice(2);
const receive=expected=>new Promise(resolve=>{const handler=message=>{if(message===expected){process.off('message',handler);resolve();}};process.on('message',handler);});
if(mode==='pause-inspection'){
  const read=fs.readFile.bind(fs);let paused=false;
  fs.readFile=async(...args)=>{const value=await read(...args);if(!paused&&String(args[0]).endsWith('issuance-testnet.lock')){paused=true;const resume=receive('resume-inspection');process.send('inspecting');await resume;}return value;};
}
process.send('ready');await receive('start');
try{
  await withIssuanceLock('testnet',async()=>{
    const critical=path.join(directory,'critical');
    const file=await fs.open(critical,'wx');
    try{
      const release=mode==='critical'?new Promise(r=>setTimeout(r,40)):receive('release');
      process.send('entered');await release;
    }finally{await file.close();await fs.unlink(critical);}
  },{directory,timeoutMs:Number(timeout)});
  process.send({done:true});
}catch(error){process.send({done:true,reason:error.reason??error.code??error.message});}
process.disconnect();
