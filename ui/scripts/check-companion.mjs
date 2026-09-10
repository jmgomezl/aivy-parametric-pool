// Isolated UI fixtures. No request can reach a model or submit to a ledger.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.QUORUM_PREVIEW_URL||'http://127.0.0.1:5186',out='/tmp/quorum-platform-companion';await fs.mkdir(out,{recursive:true});
const policy={serial:'35',lat:35.68,lon:139.65,place:'Tokyo, Japan',premiumUsd:4,payoutUsd:800,premiumHbar:4,payoutHbar:800,asset:'aUSDd',buyerId:'0.0.21',scheduleId:'0.0.31',saleTxId:'0.0.1@1780000000.123',termsPointer:'hcs://0.0.41/5',lapsesAt:'2026-10-10T05:00:00Z',state:'active',trigger:{minMagnitude:6,radiusKm:100,maxDepthKm:70},ledger:{available:true,agentSigned:true,oracles:[{name:'USGS',signed:false},{name:'EMSC',signed:false},{name:'GEOFON',signed:false}],checkedAt:new Date().toISOString()}};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{for(const [width,height] of [[1920,1080],[1600,1000],[1280,900],[2732,786],[768,1000],[390,900],[320,800],[844,390]]){
 const context=await browser.newContext({viewport:{width,height}});const page=await context.newPage(),errors=[],writes=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;let body={ok:true,network:'testnet'},status=200;
  if(req.method()==='POST'){writes.push(path);assert.equal(path,'/api/companion/chat');}
  if(path==='/api/health')body={...body,writesAllowed:true};
  else if(path==='/api/pool')body={...body,capital:200000,committed:20000,headroom:180000,poolAccountId:'0.0.2',policyTokenId:'0.0.3',asset:{symbol:'aUSDd',tokenId:'0.0.4'},budgetToday:{policies:0,usd:0,limits:{policies:100,usd:50000}}};
  else if(path==='/api/policies')body={...body,policies:[policy]};
  else if(path==='/api/policies/35')body={...body,...policy};
  else if(path==='/api/companion/chat'){
   const q=req.postDataJSON();assert(!q.accountId&&!q.owner&&!q.state);assert(q.page);if(q.page==='policy')assert.equal(q.serial,'35');
   if(q.question==='slow')await new Promise(r=>setTimeout(r,450));
   if(q.question==='fail'){status=503;body={message:'The companion is temporarily unavailable. No state was changed.'};}
   else body={...body,mode:'read_only',source:q.topic?'quick':'ai',scope:q.page==='policy'?'Public policy #35 · testnet':q.page==='story'?'Mainnet · recorded':'Network roles · live + recorded',message:q.page==='policy'?'Policy #35 is active. Its payout has not executed.':q.page==='story'?'This is a recorded mainnet experiment. It is not a real earthquake claim.':'Hedera commits cover. Axelar bridges demo tokens to Sepolia. Uniswap supplies trading liquidity.',flow:[{label:'Hedera',detail:'Testnet · cover'},{label:'Axelar',detail:'Testnet · bridge'},{label:'Uniswap',detail:'Sepolia · swap'}],facts:[{label:'Live app',value:'Testnet',tone:'mint'},{label:'Mainnet record',value:'4 HBAR · controlled',tone:'neutral'}],links:[{label:'View policy',url:'/policy/35',network:'testnet'},{label:'Mainnet proof',url:'https://hashscan.io/mainnet/transaction/1788563478.715401105',network:'mainnet'}],checkedAt:new Date().toISOString(),ledgerCheckedAt:q.page==='policy'?new Date().toISOString():null,recordedAt:q.page==='story'?'2026-09-04T23:07:21Z':null};
  }else if(path==='/api/activity')body={...body,payments:[],checkedAt:new Date().toISOString()};
  else{status=503;body={ok:false,message:'Fixture read unavailable'};}
  try{await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});}catch{/* Aborted stale response is expected. */}
 });
 const paths=width===1920||width===390?['/','/policy/35','/policies?view=fund','/swap','/story']:['/','/policy/35'];
 for(const path of paths){
  await page.goto(base+path);await page.getByRole('button',{name:'Ask Quorum',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Quorum companion'});await dialog.waitFor();
  if(height>560)await dialog.locator('.qm-prompts button').first().click();else{await dialog.getByRole('textbox').fill('What is happening?');await dialog.getByRole('button',{name:'Send question to Quorum'}).click();}
  await dialog.locator('.qm-answer').waitFor();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.qm-panel')).transform==='none');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,path+' overflow');
  const bounds=await dialog.boundingBox();assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width&&bounds.y+bounds.height<=height,JSON.stringify(bounds));
  if(width>=1600&&path!=='/story'){const main=await page.locator('.app-body').boundingBox();assert(main.x+main.width<bounds.x,'Canvas should stay beside the chat');}
  if(width>=1600&&path==='/'){const controls=await page.locator('.map-bottom').boundingBox();assert(controls.y+controls.height<=height+2,'Map controls must fit the viewport with chat open');}
  await page.screenshot({path:`${out}/fixture-${width}-${path.replace(/[^a-z0-9]/gi,'_')||'home'}.png`});
  await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);
  await page.getByRole('button',{name:'Ask Quorum',exact:true}).click();await page.getByRole('button',{name:'Close Quorum companion',exact:true}).click();assert.equal(await dialog.count(),0);
  await page.getByRole('button',{name:'Ask Quorum',exact:true}).click();await page.getByRole('button',{name:'Hide Quorum companion',exact:true}).click();assert.equal(await dialog.count(),0);
  await page.getByRole('button',{name:'Ask Quorum',exact:true}).click();await page.locator('.brand').click();await page.waitForURL(base+'/');assert.equal(await dialog.count(),0);
  console.log('PASS',width,height,path,'context, evidence, close paths, no overflow');
 }
 if(width===1920){
  await page.goto(base+'/policy/35');await page.getByRole('button',{name:'Ask Quorum',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Quorum companion'}),input=dialog.getByRole('textbox');
  await input.fill('slow');await dialog.getByRole('button',{name:'Send question to Quorum'}).click();await page.locator('.brand').click();await page.getByRole('button',{name:'Ask Quorum',exact:true}).click();await page.waitForTimeout(550);assert.equal(await dialog.locator('.qm-answer').count(),0);assert.equal(await input.inputValue(),'');assert(await input.isEnabled());
  await input.fill('What is this network?');await input.press('Enter');await dialog.getByText('AI interpreted',{exact:false}).waitFor();
  await input.fill('fail');await input.press('Enter');await dialog.getByRole('alert').waitFor();assert.match(await dialog.getByRole('alert').innerText(),/No state was changed/);
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.qm-launcher .qm-pixel-bot').evaluate(el=>getComputedStyle(el).animationName),'none');
  console.log('PASS stale-response cancellation, typed AI rendering, error and reduced motion');
 }
 assert.deepEqual(errors,[]);assert(writes.every(p=>p==='/api/companion/chat'));await context.close();
}}finally{await browser.close();}
