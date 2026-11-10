/**
 * Real 390x844 touchscreen clicks on EVERY observed row under /dept-hub/피부과.
 * Every item must open a LOCAL detail route. That route reads the DB or
 * fetches the original source on demand. An origin 429 or a missing detail
 * is a failure, not a successful external redirect or a mocked response.
 */
const fs=require("node:fs");
const {chromium}=require("playwright");
const root=process.env.MD_URL||"http://127.0.0.1:5173";
const path="/dept-hub/%ED%94%BC%EB%B6%80%EA%B3%BC";
const key=href=>{const u=new URL(href,"https://my-doctor.io");return decodeURIComponent(u.pathname)+u.search};
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 const rows=[],errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 try{
  const response=await page.goto(root+path,{waitUntil:"domcontentloaded",timeout:25000});
  await page.locator("main h1").first().waitFor({timeout:18000});
  if(await page.locator("main [role=alert]").count())throw Error("Parent clinic directory API unavailable: "+await page.locator("main [role=alert]").first().innerText());
  const links=page.locator("main a.observed-link");
  const count=await links.count();
  console.log("SKIN DIRECTORY SOURCE COUNT "+JSON.stringify({route:path,status:response.status(),rows:count,parentTitle:await page.locator("main h1").innerText()}));
  if(count<70)throw Error("Parent directory has fewer than 70 linked rows; cannot claim all verified");
  const entries=await links.evaluateAll(nodes=>nodes.map(a=>({label:(a.textContent||"").trim().slice(0,140),href:a.href,data:a.getAttribute("data-link-data"),target:a.getAttribute("target")})));
  for(let i=0;i<entries.length;i++){
   const row={number:i+1,label:entries[i].label,href:entries[i].href,kind:entries[i].data,status:"NOT_TESTED"};
   try{
    if(row.kind!=="origin-on-demand")throw Error("Source rows must navigate within the clone (on-demand origin API)");
    if(entries[i].target==="_blank")throw Error("Source row unexpectedly opens a new tab");
    {
     const href=new URL(row.href);
     const before=key(page.url());
     await links.nth(i).tap({timeout:7000});
     await page.waitForURL(url=>key(url.href)===key(row.href),{timeout:7000});
     row.path_changed=key(page.url())!==before;
     await page.locator("main h1,main [role=alert]").first().waitFor({timeout:18000});
     row.source_error=await page.locator("main [role=alert]").first().innerText().catch(()=>"");
     row.detailTitle=await page.locator("main h1").first().innerText().catch(()=>"");
     row.status=row.path_changed&&row.detailTitle&&!row.source_error?"LOCAL_DETAILS_LOADED":"LOCAL_DETAILS_FAILED";
     await page.goBack({waitUntil:"domcontentloaded",timeout:12000});
     await page.locator("main a.observed-link").first().waitFor({timeout:15000});
    }
   }catch(e){row.status="CLICK_FAILED";row.reason=String(e.message).slice(0,350);}
   rows.push(row);console.log("SKIN DIRECTORY CLICK "+JSON.stringify(row));
  }
 }catch(e){errors.push(String(e.message));console.error("SKIN DIRECTORY AUDIT BLOCKED "+String(e.message));}
 finally{await browser.close()}
 fs.mkdirSync("qa-artifacts",{recursive:true});
 fs.writeFileSync("qa-artifacts/skin-directory-clicks.json",JSON.stringify({rows,errors},null,2));
 const breakdown=rows.reduce((t,x)=>(t[x.status]=(t[x.status]||0)+1,t),{});
 const summary={total:rows.length,successful:rows.filter(x=>["OPENED_REAL_ORIGINAL","LOCAL_DETAILS_LOADED"].includes(x.status)).length,failed:rows.filter(x=>!["OPENED_REAL_ORIGINAL","LOCAL_DETAILS_LOADED"].includes(x.status)).length,breakdown,errors};
 console.log("SKIN DIRECTORY CLICK SUMMARY "+JSON.stringify(summary));
 if(rows.length<70||summary.failed||errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});