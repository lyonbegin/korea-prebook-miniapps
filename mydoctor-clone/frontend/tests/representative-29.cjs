/** Strict source-vs-clone template audit. No fake data, no default PASS.
 *  29 representative original URLs; newly discovered distinct behaviors are queued separately.
 *  Read-only navigation and reversible UI actions. Avoid sustained requests after HTTP 429.
 */
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const {PNG}=require("pngjs");
const manifest=require("../src/data/representative-29.json");
const extra=require("../src/data/new-variant-candidates.json");
const OUT="qa-artifacts";
const base=process.env.MD_URL||"http://127.0.0.1:5173";
const origin=manifest.source_origin;
const timeout=Number(process.env.MD_PAGE_TIMEOUT||8500);
const max=Number(process.env.MD_MAX_CASES||29);
const VISUAL_MAX_DIFF_PERCENT=10;
const isVisualPass=percent=>Number.isFinite(percent)&&percent<=VISUAL_MAX_DIFF_PERCENT;
const normalize=s=>String(s||"").replace(/\s+/g," ").replace(/[^\p{L}\p{N}]/gu,"").trim().toLowerCase();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function screenshotDiff(x,y){
 const a=PNG.sync.read(x),b=PNG.sync.read(y);
 if(a.width!==b.width||a.height!==b.height)throw Error("Image dimensions differ");
 let count=0;
 for(let i=0;i<a.data.length;i+=4){
  if(Math.max(Math.abs(a.data[i]-b.data[i]),Math.abs(a.data[i+1]-b.data[i+1]),Math.abs(a.data[i+2]-b.data[i+2]))>20)count++;
 }
 return +(count/(a.width*a.height)*100).toFixed(2);
}
async function snapshot(page){
 return page.evaluate(()=>{
  const main=document.querySelector("main")||document.body;
  const text=(main?.innerText||"").replace(/\s+/g," ").trim();
  const h1=(main?.querySelector("h1")||document.querySelector("h1"))?.innerText?.trim()||"";
  const title=document.title||"";
  const links=[...(main?.querySelectorAll("a[href]")||[])].slice(0,150)
    .map(a=>({label:a.innerText.trim().slice(0,100),href:a.href})).filter(x=>x.label);
  const selects=main?.querySelectorAll("select").length||0;
  const buttons=main?.querySelectorAll("button").length||0;
  const inputs=main?.querySelectorAll("input").length||0;
  const tables=main?.querySelectorAll("table").length||0;
  return {title,h1,chars:text.length,excerpt:text.slice(0,300),links,controls:{selects,buttons,inputs,tables}};
 });
}
async function clickProbe(page,label) {
 const c=(await page.locator("main").count())?page.locator("main").first():page.locator("body");
 const candidates=[
  {kind:"tab",locator:c.locator('[role="tab"],.md-tabs button,.md-clinic-tabs button').filter({visible:true})},
  {kind:"accordion",locator:c.locator('button[aria-expanded]')},
  {kind:"select",locator:c.locator("select")},
  {kind:"search",locator:c.locator('input[type="search"],input[placeholder*="검색"]')},
  {kind:"navigation",locator:c.locator('a[href^="/"]')}
 ];
 for(const z of candidates){
  const n=await z.locator.count();
  if(!n)continue;
  const target=z.locator.first();
  try{
   if(z.kind==="tab"||z.kind==="accordion"){
    await target.click({timeout:1800});
    const expanded=await target.getAttribute("aria-expanded");
    return {kind:z.kind,status:"ACTUATED",expanded};
   }
   if(z.kind==="select"){
    const options=await target.locator("option").count();
    return {kind:z.kind,status:options>=2?"OPTIONS_VERIFIED":"NO_OPTIONS",option_count:options};
   }
   if(z.kind==="search"){
    await target.fill("서울",{timeout:1800});
    return {kind:z.kind,status:"TEXT_ENTERED",value:await target.inputValue()};
   }
   if(z.kind==="navigation"){
    const href=await target.getAttribute("href");
    const linkText=(await target.innerText()).trim();
    return {kind:z.kind,status:"LINK_IDENTIFIED",href,label:linkText.slice(0,80)};
   }
  }catch(e){return {kind:z.kind,status:"ACTION_FAILED",reason:String(e.message).slice(0,180)}}
 }
 return {kind:"none",status:"NO_INTERACTION_FOUND"};
}
(async()=>{
 fs.mkdirSync(OUT,{recursive:true});
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const report={date:new Date().toISOString(),reference:"https://my-doctor.io",viewport:[390,844],
   planned:manifest.cases.length, additional_discovered:extra.length,
   test_policy:"Representative UI type + actual unique behavior; never infer all URLs are tested",
   cases:[]};
 let rateLimited=false;
 try{
  for(const test of manifest.cases.slice(0,max)){
   if(rateLimited){
    report.cases.push({id:test.id,path:test.path,status:"NOT_RUN_SOURCE_RATE_LIMIT",source_verified:false,
     clone_data_verified:false,ui_verified:false});
    continue;
   }
   const item={id:test.id,path:test.path,interaction:test.interaction,
     status:"NOT_VERIFIED",source_verified:false,clone_data_verified:false,ui_verified:false};
   const src=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
   const dst=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
   try{
    let originResponse;
    try{originResponse=await src.goto(origin+test.path,{waitUntil:"domcontentloaded",timeout});}
    catch(e){item.status="SOURCE_LOAD_FAILED";item.error=String(e.message).slice(0,200);continue}
    item.source_http=originResponse?.status()||0;
    if(item.source_http===429||item.source_http===403){
      item.status="SOURCE_RATE_LIMITED";rateLimited=true;continue;
    }
    if(item.source_http!==200){item.status="SOURCE_HTTP_ERROR";continue}
    await wait(600);
    item.source_verified=true;
    const sourceState=await snapshot(src);
    item.source_evidence={title:sourceState.title,h1:sourceState.h1,chars:sourceState.chars,
                         controls:sourceState.controls,link_count:sourceState.links.length};
    if(sourceState.chars<35){item.status="SOURCE_EMPTY";continue}
    const response=await dst.goto(base+test.path,{waitUntil:"domcontentloaded",timeout});
    item.clone_http=response?.status()||0;
    if(item.clone_http!==200){item.status="CLONE_HTTP_ERROR";continue}
    await wait(950);
    if(await dst.locator('[role="alert"]').count()){
      item.status="CLONE_SOURCE_UNAVAILABLE";
      item.clone_error=(await dst.locator('[role="alert"]').first().innerText()).slice(0,220);
      continue;
    }
    // Visual audit independently of original data/function tests. Capture the
    // same initial 390x844 viewport BEFORE any click, including visible images.
    const safe=test.id.replace(/[^a-z0-9-]/gi,"-");
    await Promise.all([src,dst].map(p=>p.evaluate(async()=>{
      await document.fonts.ready;
      await Promise.all([...document.images].filter(img=>!img.complete)
        .map(img=>new Promise(done=>{
          const finish=()=>done();img.addEventListener("load",finish,{once:true});
          img.addEventListener("error",finish,{once:true});
          setTimeout(finish,2500);
        })));
    })));
    const srcScreenshot=await src.screenshot({path:path.join(OUT,"origin-"+safe+".png")});
    const cloneScreenshot=await dst.screenshot({path:path.join(OUT,"clone-"+safe+".png")});
    item.pixel_delta_percent=screenshotDiff(srcScreenshot,cloneScreenshot);
    item.visual_threshold_percent=VISUAL_MAX_DIFF_PERCENT;
    item.visual_status=isVisualPass(item.pixel_delta_percent)?"VISUAL_PASS":"VISUAL_FAIL";
    const cloneState=await snapshot(dst);
    item.clone_evidence={title:cloneState.title,h1:cloneState.h1,chars:cloneState.chars,
                         controls:cloneState.controls,link_count:cloneState.links.length};
    // Generic one-title page or empty placeholders are never accepted as the full original data.
    if(cloneState.chars<35||cloneState.chars<sourceState.chars*.72){
      item.status="CONTENT_MISSING";
      item.observed_content_ratio=+(cloneState.chars/Math.max(1,sourceState.chars)).toFixed(2);
      continue;
    }
    if(sourceState.h1&&normalize(sourceState.h1)!==normalize(cloneState.h1)){
      item.status="HEADING_MISMATCH";continue;
    }
    // Passing a text-length threshold does not prove original data completeness.
    item.visible_content_threshold_passed=true;
    // Run user-interaction probes only AFTER matching initial viewport images are captured.
    item.source_interaction=await clickProbe(src,test.label);
    item.clone_interaction=await clickProbe(dst,test.label);
    if(item.source_interaction?.status==="NO_INTERACTION_FOUND"||
       item.source_interaction?.status==="ACTION_FAILED"){
      item.status="SOURCE_INTERACTION_UNOBSERVED";continue;
    }
    if(item.source_interaction.status!==item.clone_interaction.status||
       item.source_interaction.kind!==item.clone_interaction.kind){
      item.status="INTERACTION_PROBE_DIFFERS";continue;
    }
    item.interaction_probe_matched=true; // one probe, never full UI parity
    item.status="INTERACTION_PROBE_MATCHED";
   }catch(e){item.status="TEST_ERROR";item.error=String(e.message).slice(0,250)}
   finally{await src.close();await dst.close();report.cases.push(item);
     console.log("TYPE AUDIT",JSON.stringify(item));
     fs.writeFileSync(path.join(OUT,"representative-29.json"),JSON.stringify(report,null,2));
   }
   await wait(400);
  }
 }finally{await browser.close()}
 report.summary=report.cases.reduce((o,c)=>(o[c.status]=(o[c.status]||0)+1,o),{});
 report.visual_threshold_percent=VISUAL_MAX_DIFF_PERCENT;
 report.visual_passed=report.cases.filter(x=>x.visual_status==="VISUAL_PASS").length;
 report.visual_failed=report.cases.filter(x=>x.visual_status==="VISUAL_FAIL").length;
 report.visual_unverified=report.cases.filter(x=>!x.visual_status).length;
 report.verified_complete=0; // Actual full source data & complete feature parity are not established by screenshot alone.
 report.source_data_real=report.cases.filter(x=>x.source_verified).length;
 report.content_length_threshold_passed=report.cases.filter(x=>x.visible_content_threshold_passed).length;
 report.genuine_visible_data_matched=0; // Not provable by page-length or generic DOM probes.
 report.new_test_candidates=extra;
 fs.writeFileSync(path.join(OUT,"representative-29.json"),JSON.stringify(report,null,2));
 console.log("REPRESENTATIVE AUDIT SUMMARY",JSON.stringify({planned:report.planned,summary:report.summary,observed_source:report.source_data_real,content_length_threshold_passed:report.content_length_threshold_passed,full_source_data_verified:0,visual_threshold_percent:VISUAL_MAX_DIFF_PERCENT,visual_passed:report.visual_passed,visual_failed:report.visual_failed,visual_unverified:report.visual_unverified,complete:report.verified_complete,candidate_additions:extra.length}));
 // No green CI when comparisons did not genuinely pass. No mass source retry after 429.
 if(report.visual_passed!==manifest.cases.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
