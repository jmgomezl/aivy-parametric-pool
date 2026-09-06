// Isolated manual UI verification. No ledger imports, keys or network calls.
// Run with PORT=8819 node tests/ui-fixture-server.js and VITE_AGENT_URL=http://127.0.0.1:8819.
import http from 'node:http';
let mode='normal',record=null;
const policy={serial:'9001',lat:4.53,lon:-75.68,place:'UI test fixture',premiumUsd:4,payoutUsd:800,premiumHbar:4,payoutHbar:800,asset:'aUSDd',buyerId:'0.0.9001',scheduleId:'0.0.9002',saleTxId:'fixture',termsPointer:'hcs://0.0.9003/1',lapsesAt:new Date(Date.now()+86400000).toISOString(),settled:false,state:'active',ledger:{available:true,checkedAt:new Date().toISOString(),agentSigned:true,oracles:[{name:'Test source A',signed:false},{name:'Test source B',signed:false},{name:'Test source C',signed:false}]}};
const quote={ok:true,premium:4,payout:800,probability:0.0025,days:30,hazard:{count:12,source:'https://example.com',lambda:0.02},settled:{payout:800,premium:4,symbol:'aUSDd'},asset:{symbol:'aUSDd'}};
http.createServer(async(req,res)=>{
 const send=(status,data)=>{res.writeHead(status,{'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'content-type'});res.end(JSON.stringify(data));};
 const url=new URL(req.url,'http://localhost');
 if(req.method==='OPTIONS')return send(204,{});
 if(url.pathname==='/fixture'){mode=url.searchParams.get('mode')??'normal';record=null;return send(200,{mode});}
 if(mode==='offline')return send(503,{ok:false,reason:'offline'});
 if(url.pathname==='/api/health')return send(200,{ok:true,network:'testnet',writesAllowed:true});
 if(url.pathname==='/api/pool')return send(200,{network:'testnet',poolAccountId:'0.0.9000',asset:{symbol:'aUSDd'},capital:10000,committed:800,headroom:9200,livePolicies:1});
 if(url.pathname==='/api/quote')return send(200,mode==='decline'?{ok:false,reason:'no_record',message:'Not enough historical evidence.'}:quote);
 if(url.pathname==='/api/policies'&&req.method==='POST'){
   let raw='';for await(const chunk of req)raw+=chunk;const input=JSON.parse(raw);
   record={id:input.requestId,status:'creating'};await new Promise(r=>setTimeout(r,1500));
   if(mode==='interrupted'){record.status='needs_review';return send(500,{ok:false,reason:'service_unavailable',message:'Fixture interrupted receipt.'});}
   record.status='complete';return send(201,{ok:true,policy,quote});
 }
 if(url.pathname==='/api/policies')return send(200,{network:'testnet',policies:record?.status==='complete'?[policy]:[]});
 if(url.pathname.startsWith('/api/requests/'))return send(record?200:404,record?{ok:true,status:record.status,policy:record.status==='complete'?policy:undefined,message:record.status==='needs_review'?'Your request is reserved for review.':undefined}:{ok:false,reason:'not_found'});
 if(url.pathname.startsWith('/api/policies/'))return send(404,{ok:false,reason:'not_found',message:'No fixture policy at this address.'});
 send(404,{});
}).listen(Number(process.env.PORT??8819),'127.0.0.1',()=>console.log('Isolated UI fixture API on localhost:8819; no ledger writes'));
