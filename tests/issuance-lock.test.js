import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fork,spawnSync} from 'node:child_process';
import {withIssuanceLock} from '../src/issuance-lock.js';
const fixture=new URL('./fixtures/lock-worker.js',import.meta.url);
function worker(directory,mode,timeout=3000){
 const child=fork(fixture,[directory,mode,String(timeout)],{stdio:['ignore','ignore','pipe','ipc']}),messages=[];let stderr='';
 child.stderr.on('data',d=>stderr+=d);child.on('message',m=>messages.push(m));
 const wait=predicate=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>finish(Error('Worker timeout: '+stderr)),5000);
  const receive=()=>{const value=messages.find(predicate);if(value!==undefined)finish(null,value);};
  const finish=(error,value)=>{clearTimeout(timer);child.off('message',receive);error?reject(error):resolve(value);};
  child.on('message',receive);receive();
 });
 return {child,wait,send:m=>child.send(m),messages,kill:async()=>{if(child.exitCode!==null||child.signalCode)return;const exited=new Promise(r=>child.once('exit',r));child.kill('SIGKILL');await exited;}};
}
async function setup(t){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'quorum-kernel-lock-')),workers=[];t.after(async()=>{await Promise.all(workers.map(w=>w.kill()));await fs.rm(directory,{recursive:true,force:true});});return {directory,spawn:(...args)=>{const w=worker(directory,...args);workers.push(w);return w;}};}

test('a second process cannot replace an abandoned marker while its recovery is paused',async t=>{
 const f=await setup(t),dead=spawnSync(process.execPath,['-e','']).pid;
 await fs.writeFile(path.join(f.directory,'issuance-testnet.lock'),JSON.stringify({pid:dead}));
 const a=f.spawn('pause-inspection');await a.wait(m=>m==='ready');a.send('start');await a.wait(m=>m==='inspecting');
 const b=f.spawn('critical',100);await b.wait(m=>m==='ready');b.send('start');
 assert.equal((await b.wait(m=>m.done)).reason,'issuance_busy');assert(!b.messages.includes('entered'));
 a.send('resume-inspection');await a.wait(m=>m==='entered');a.send('release');assert.deepEqual(await a.wait(m=>m.done),{done:true});
});

test('crash recovery admits only one of several competing processes at a time',async t=>{
 const f=await setup(t),owner=f.spawn('hold');await owner.wait(m=>m==='ready');owner.send('start');await owner.wait(m=>m==='entered');
 const guard=path.join(f.directory,'issuance-testnet.lock.guard'),inode=(await fs.stat(guard)).ino;
 await owner.kill();
 // The critical marker belongs to this test, not the application; leave the
 // actual owner marker in place so every contender sees a crashed holder.
 await fs.unlink(path.join(f.directory,'critical'));
 const contenders=Array.from({length:6},()=>f.spawn('critical'));
 await Promise.all(contenders.map(w=>w.wait(m=>m==='ready')));contenders.forEach(w=>w.send('start'));
 const results=await Promise.all(contenders.map(w=>w.wait(m=>m.done)));
 assert(results.every(r=>!r.reason),JSON.stringify(results));assert.equal((await fs.stat(guard)).ino,inode);
});

test('failed work releases the kernel lock without removing its stable inode',async t=>{
 const f=await setup(t);
 await assert.rejects(withIssuanceLock('testnet',async()=>{throw Error('interrupted');},{directory:f.directory}),/interrupted/);
 const inode=(await fs.stat(path.join(f.directory,'issuance-testnet.lock.guard'))).ino;
 assert.equal(await withIssuanceLock('testnet',async()=>42,{directory:f.directory,timeoutMs:0}),42);
 assert.equal((await fs.stat(path.join(f.directory,'issuance-testnet.lock.guard'))).ino,inode);
});
