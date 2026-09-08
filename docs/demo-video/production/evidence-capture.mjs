// Read-only captures of actual explorer pages and the issued policy.
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.QUORUM_VIDEO_WORK||'/tmp/quorum-video';
const b=await chromium.launch({channel:'chrome',headless:true});
const c=await b.newContext({viewport:{width:1440,height:1000},locale:'en-US'});
await c.route('**/api/**',r=>r.request().method()==='GET'?r.continue():r.abort());
const p=await c.newPage(),report=[];
try{
 await p.goto('https://quorum.aivylabs.xyz/policy/33');await p.locator('.position-nft').waitFor();await p.evaluate(()=>document.fonts.ready);await p.locator('.position-nft').screenshot({path:`${out}/stills/nft-full.png`});
 await p.locator('.proof-details summary').filter({hasText:'View on Hedera'}).click();
 const premium=await p.locator('.proof-details[open] a[href*="transaction"]').getAttribute('href');
 const main='https://hashscan.io/mainnet/transaction/1788563478.715401105';
 const swapData=JSON.parse(await fs.readFile(`${out}/swap.json`,'utf8'));
 const execution=JSON.parse(await fs.readFile(`${out}/evm-current.private.json`,'utf8'));
 const swap=execution?.actions?.filter(a=>a.kind==='swap'&&a.status==='complete').at(-1)?.result?.transactionHash;
 for(const [name,url] of [['premium-explorer',premium],['mainnet-explorer',main]]){
  if(!url)continue;
  try{await p.goto(url,{waitUntil:'domcontentloaded',timeout:45000});await p.waitForTimeout(4000);const reject=p.getByRole('button',{name:/^reject$/i});if(await reject.isVisible())await reject.click();await p.evaluate(()=>document.fonts.ready);await p.screenshot({path:`${out}/stills/${name}.png`});report.push({name,url,title:await p.title(),text:(await p.locator('body').innerText()).slice(0,15000)});}catch(e){report.push({name,url,error:e.message});}
 }
}finally{await b.close();await fs.writeFile(`${out}/explorers.json`,JSON.stringify(report,null,2));console.log(report.map(({name,title,error})=>({name,title,error})));}
