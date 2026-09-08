import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {withHttpErrors,HttpError} from '../src/http-safety.js';
import {capability} from '../src/demo/store.js';

test('HTTP failures respond promptly, preserve refusal status and hide unexpected internals',async()=>{
 const logs=[];
 const respond=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body));};
 const server=http.createServer(withHttpErrors(async(req,res)=>{
  const route=new URL(req.url,'http://localhost').pathname;
  if(route==='/account')capability(req);
  if(route==='/invalid')throw new HttpError(400,'Choose a valid location.');
  if(route==='/upstream'){await Promise.resolve();throw Error('private-upstream-detail');}
  respond(res,200,{ok:true});
 },{respond,logger:{warn:(...args)=>logs.push(args),error:(...args)=>logs.push(args)}}));
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  for(const [path,status,message] of [['/account',401,'Start your demo account first.'],['/invalid',400,'Choose a valid location.'],['/upstream',503,null]]){
   const r=await fetch(base+path+'?access=do-not-log',{signal:AbortSignal.timeout(1500)});
   assert.equal(r.status,status);const body=await r.json();assert.equal(body.ok,false);
   if(message)assert.equal(body.message,message);else assert(!JSON.stringify(body).includes('private-upstream-detail'));
  }
  const healthy=await fetch(base+'/healthy',{signal:AbortSignal.timeout(1500)});assert.equal(healthy.status,200);await healthy.text();
  assert.equal(logs.length,3);assert(logs.every(row=>!JSON.stringify(row).includes('do-not-log')));
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
