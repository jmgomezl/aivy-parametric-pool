// Isolated browser QA only. No ledger imports, keys or external calls.
// PORT=8819 node tests/ui-fixture-server.js
// VITE_AGENT_URL=http://127.0.0.1:8819 npm run dev --prefix ui -- --port 5178
import http from 'node:http';
let mode='normal',record=null,account=null;
const policy={serial:'9001',lat:4.53,lon:-75.68,place:'QA fixture · no ledger writes',premiumUsd:4,payoutUsd:800,premiumHbar:4,payoutHbar:800,asset:'aUSDd',buyerId:'0.0.9001',scheduleId:'0.0.9002',saleTxId:'fixture',termsPointer:'hcs://0.0.9003/1',lapsesAt:new Date(Date.now()+30*86400000).toISOString(),recordedAt:new Date().toISOString(),brokerId:null,settled:false,state:'active',trigger:{windowStart:new Date().toISOString(),windowEnd:new Date(Date.now()+30*86400000).toISOString()},ledger:{available:true,checkedAt:new Date().toISOString(),agentSigned:true,oracles:[{name:'Test source A',signed:false},{name:'Test source B',signed:false},{name:'Test source C',signed:false}]}};
const quote={ok:true,premium:4,payout:800,probability:.0025,days:30,hazard:{count:12,source:'https://example.com',lambda:.02},settled:{payout:800,premium:4,symbol:'aUSDd'},asset:{symbol:'aUSDd'}};
const start=()=>account??={ok:true,network:'testnet',accountId:'0.0.9001',asset:'aUSDd',balance:1000,shares:0,shareTokenId:'0.0.9004',referralCode:'abcdef012345',starterTx:'fixture',commissions:[],actions:[],checkedAt:new Date().toISOString()};
http.createServer(async(req,res)=>{
 const send=(status,data)=>{res.writeHead(status,{'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'content-type,authorization'});res.end(JSON.stringify(data));};
 const url=new URL(req.url,'http://localhost');if(req.method==='OPTIONS')return send(204,{});
 if(url.pathname==='/fixture'){mode=url.searchParams.get('mode')??'normal';if(url.searchParams.get('reset')){record=null;account=null;}return send(200,{mode});}
 if(mode==='offline')return send(503,{ok:false,reason:'offline'});
 if(url.pathname==='/api/health')return send(200,{ok:true,network:'testnet',writesAllowed:true});
 if(url.pathname==='/api/pool')return send(200,{network:'testnet',poolAccountId:'0.0.9000',asset:{symbol:'aUSDd'},capital:10000,committed:800,headroom:9200,livePolicies:1,budgetToday:{policies:1,usd:800,limits:{policies:100,usd:100000}}});
 if(url.pathname==='/api/demo/start')return send(200,start());
 if(url.pathname==='/api/demo')return account?send(200,{...account,checkedAt:new Date().toISOString()}):send(401,{ok:false,message:'Start your demo account first.'});
 if(url.pathname==='/api/demo/deposit'){
  let raw='';for await(const chunk of req)raw+=chunk;const input=JSON.parse(raw),a=start();
  const old=a.actions.find(x=>x.requestId===input.requestId);if(old)return send(200,old.result);
  const result={ok:true,amount:input.amount,shares:input.amount,depositTxId:'fixture-not-a-transaction'};a.balance-=input.amount;a.shares+=input.amount;a.actions.push({...input,kind:'deposit',status:'complete',result});
  return mode==='interrupted'?send(503,{ok:false,message:'Fixture: response lost after completion.'}):send(200,result);
 }
 if(url.pathname==='/api/quote')return send(200,mode==='decline'?{ok:false,reason:'no_record',message:'Not enough historical evidence.'}:quote);
 if(url.pathname==='/api/policies'&&req.method==='POST'){
  let raw='';for await(const chunk of req)raw+=chunk;const input=JSON.parse(raw);record={id:input.requestId,status:'creating'};await new Promise(r=>setTimeout(r,500));
  if(mode==='interrupted'){record.status='needs_review';return send(503,{ok:false,reason:'service_unavailable',message:'Fixture interrupted receipt.'});}
  record.status='complete';return send(201,{ok:true,policy,quote});
 }
 if(url.pathname==='/api/policies')return send(200,{network:'testnet',policies:[policy]});
 if(url.pathname==='/api/policies/9001')return send(200,policy);
 if(url.pathname.startsWith('/api/requests/'))return send(record?200:404,record?{ok:true,status:record.status,policy:record.status==='complete'?policy:undefined,message:record.status==='needs_review'?'Your request is reserved for review.':undefined}:{ok:false,reason:'not_found'});
 if(url.pathname.endsWith('/check'))return send(200,{ok:true,check:null});
 if(url.pathname.startsWith('/api/policies/'))return send(404,{ok:false,reason:'not_found',message:'No fixture policy at this address.'});
 if(url.pathname==='/api/places')return send(200,{places:[]});
 if(url.pathname==='/api/activity')return send(200,{network:'testnet',payments:[],checkedAt:new Date().toISOString()});
 if(url.pathname==='/api/bridge')return send(503,{ok:false});
 send(404,{ok:false,message:'Isolated QA fixture route unavailable.'});
}).listen(Number(process.env.PORT??8819),'127.0.0.1',()=>console.log('Isolated UI fixture on 8819; no ledger writes'));
