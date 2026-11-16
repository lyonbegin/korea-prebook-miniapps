/* Parallel 29-screen source-website pixel audit.
 * Baselines: real my-doctor.io HTTP 200 browser screenshots captured 2026-11-09,
 * saved in GitHub Actions artifact 13688838734 (run 42650015118).
 * This does NOT compare to the original Android APK.
 * A missing baseline or a broken render NEVER counts as a pass.
 * One failure does NOT stop the other 28 screens.
 */
const {chromium}=require("playwright");
const {PNG}=require("pngjs");
const fs=require("node:fs");
const path=require("node:path");
const inventory=require("../src/data/representative-29.json");
const ROOT=path.resolve(__dirname,"..");
const ORIGINAL=path.resolve(process.env.PIXEL_ORIGINAL_DIR||path.join(ROOT,"qa-original"));
const DEST=path.resolve(process.env.PIXEL_OUTPUT_DIR||path.join(ROOT,"website-pixel-evidence"));
const SITE=(process.env.PAGES_TEST_URL||"http://127.0.0.1:4173/korea-prebook-miniapps/").replace(/\/?$/,"/");
const WORKERS=Math.max(1,Math.min(8,Number(process.env.PIXEL_WORKERS)||4));
const THRESHOLD=25,MAX_MISMATCH=10;
const FULL_BY_ID={"home":"source-full-home.png","hospital-search":"source-full-hospital-search.png"};
const ROOT_SCENES={
 "home":"home","telemedicine-index":"telemedicine","telemedicine-department-list":"telemedicine",
 "hospital-search":"hospital-list","medical-cost-index":"medical-cost",
 "pharmacy-search":"pharmacy","medicine-search":"health","health-landing":"health-landing"
};
const SELECTOR_BY_ID={
 "home":"[data-testid='website-parity-home']",
 "hospital-search":"[data-testid='website-parity-hospital']",
 "hospital-detail":"[data-testid='website-source-hospital-detail']",
 "hospital-by-department":"[data-testid='original-department-landing']",
 "map-emergency":"[data-testid='website-source-emergency-map']",
 "telemedicine-index":"[data-testid='original-telemedicine-landing']",
 "telemedicine-condition":"[data-testid='website-source-hypertension-list']",
 "telemedicine-department-list":"[data-testid='original-telemedicine-landing']",
 "medical-cost-index":"[data-testid='website-parity-medical-cost']",
 "medical-cost-category":"[data-testid='website-parity-medical-cost-category']",
 "medical-cost-item-by-area":"[data-testid='website-parity-medical-cost-item-by-area']",
 "pharmacy-search":"[data-testid='pages-static-directory']",
 "medicine-search":"[data-testid='pages-static-directory']",
 "health-landing":"[data-testid='website-source-health-landing']",
 "qna-index":"[data-testid='website-source-original-detail']"
};
const SUCCESS=new Set(["PASS","PASS_VIEWPORT_ONLY","PASS_VERIFIED_PREFIX"]);
fs.mkdirSync(DEST,{recursive:true});
if(inventory.cases.length!==29||new Set(inventory.cases.map(x=>x.id)).size!==29){
 console.error("SOURCE_WEB_AUDIT_CONFIG_ERROR: inventory must contain 29 unique IDs");process.exit(2);
}
function targetUrl(c){
 const scene=ROOT_SCENES[c.id];
 return SITE+"?screen="+encodeURIComponent(scene||"detail")+
   (scene?"":"&target="+encodeURIComponent(c.path));
}
function getPixels(file){return PNG.sync.read(fs.readFileSync(file));}
function measure(src,dst){
 if(src.width!==dst.width||src.height>dst.height)
  throw Error("Pixel dimensions mismatch "+src.width+"x"+src.height+" vs "+dst.width+"x"+dst.height);
 const count=src.width*src.height;
 let changed=0,sum=0;
 for(let y=0;y<src.height;y++)for(let x=0;x<src.width;x++){
  const i=(y*src.width+x)*4,j=(y*dst.width+x)*4;
  const a=Math.abs(src.data[i]-dst.data[j]);
  const b=Math.abs(src.data[i+1]-dst.data[j+1]);
  const c=Math.abs(src.data[i+2]-dst.data[j+2]);
  if(Math.max(a,b,c)>THRESHOLD)changed++;
  sum+=(a+b+c)/3;
 }
 return {mismatch_pct:+(changed/count*100).toFixed(3),mae:+(sum/count).toFixed(3),
  changed_pixels:changed,total_pixels:count,original:[src.width,src.height],clone:[dst.width,dst.height],threshold_rgb:THRESHOLD};
}
function meaningfulOriginalEnd(png){
 let last=0;
 for(let y=0;y<png.height;y++){
  let nonwhite=0;
  for(let x=0;x<png.width;x++){
   const i=(y*png.width+x)*4;
   if(Math.min(png.data[i],png.data[i+1],png.data[i+2])<242)nonwhite++;
  }
  if(nonwhite/png.width>0.05)last=y;
 }
 return last+1;
}
function topRows(src,height){
 const out=new PNG({width:src.width,height});
 src.data.copy(out.data,0,0,src.width*height*4);
 return out;
}
function writeDiff(src,dst,id){
 const w=src.width,h=src.height;
 const panel=new PNG({width:w*3,height:h});
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const a=(y*w+x)*4,b=(y*panel.width+x)*4,d=(y*dst.width+x)*4;
  const o=w*4;
  const mismatch=Math.max(...[0,1,2].map(k=>Math.abs(src.data[a+k]-dst.data[d+k])))>THRESHOLD;
  for(let k=0;k<3;k++){
   panel.data[b+k]=src.data[a+k];
   panel.data[b+o+k]=dst.data[d+k];
  }
  panel.data[b+o*2]=mismatch?255:240;
  panel.data[b+o*2+1]=mismatch?35:240;
  panel.data[b+o*2+2]=mismatch?35:240;
  panel.data[b+3]=panel.data[b+o+3]=panel.data[b+o*2+3]=255;
 }
 fs.writeFileSync(path.join(DEST,"side-by-side-"+id+".png"),PNG.sync.write(panel,{compressionLevel:3}));
}
async function runOne(browserContext,c){
 const started=Date.now();
 const url=targetUrl(c);
 const rec={id:c.id,label:c.label,path:c.path,source_site:"https://my-doctor.io",
  clone_site:url,source_capture_date:"2026-11-09",source_capture_run:42650015118,
  source_is_android_apk:false,status:"UNVERIFIED",interaction:c.interaction};
 const originalFile=path.join(ORIGINAL,"origin-"+c.id+".png");
 if(!fs.existsSync(originalFile)){
  rec.status="SOURCE_MISSING";rec.reason="Missing original HTTP 200 screenshot: "+path.basename(originalFile);
  return rec;
 }
 let page;
 try{
  page=await browserContext.newPage();
  // Freeze ONLY archived night-pharmacy pixel verification at its captured
  // Tuesday overnight UI state; production page continues using KST clock.
  if(c.id==="pharmacy-condition-search"){
   await page.clock.install({time:new Date("2026-11-10T01:00:00+09:00")});
   rec.reference_clock="2026-11-10T01:00:00+09:00";
  }
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  const response=await page.goto(url,{waitUntil:"networkidle",timeout:30000});
  if(response?.status()!==200)throw Error("Clone HTTP "+(response?.status()??"no response"));
  await page.locator(SELECTOR_BY_ID[c.id]||"[data-testid='pages-static-detail'],[data-testid='website-source-original-detail']").waitFor({timeout:8000});
  await page.evaluate(async()=>{
   await document.fonts.ready;
   await Promise.all([...document.images].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{
    img.addEventListener("load",resolve,{once:true});
    img.addEventListener("error",resolve,{once:true});
    setTimeout(resolve,2500);
   })));
  });
  if(c.id==="home"||c.id==="hospital-search"){
   const imageSelector=c.id==="home"?".owh-phone-illustration img":".ow-hospital-page .owh-brand img";
   await page.waitForFunction(s=>document.querySelector(s)?.naturalWidth>0,imageSelector,{timeout:12000});
  }
  await page.waitForTimeout(200);
  if(errors.length)throw Error("Browser JavaScript errors: "+errors.join("; "));
  rec.render=await page.evaluate(()=>({
   title:document.title,
   text_chars:document.body.innerText.length,
   clickable:document.querySelectorAll("button,a[href],select,input").length,
   detail_type:document.querySelector("[data-detail-type]")?.getAttribute("data-detail-type")||null,
   pathname:location.pathname,
   search:location.search
  }));
  const viewBuffer=await page.screenshot({fullPage:false,animations:"disabled"});
  fs.writeFileSync(path.join(DEST,"clone-"+c.id+".png"),viewBuffer);
  const src=getPixels(originalFile),dst=PNG.sync.read(viewBuffer);
  if(src.width!==dst.width||src.height!==dst.height)
   throw Error("Viewport mismatch "+src.width+"x"+src.height+" vs "+dst.width+"x"+dst.height);
  rec.viewport=measure(src,dst);
  const fullName=FULL_BY_ID[c.id];
  if(fullName&&fs.existsSync(path.join(ORIGINAL,fullName))){
   const refFull=getPixels(path.join(ORIGINAL,fullName));
   const cloneFull=PNG.sync.read(await page.screenshot({fullPage:true,animations:"disabled"}));
   const meaningful=meaningfulOriginalEnd(refFull);
   const referenceQuality=meaningful/refFull.height>.85?"FULL_PAGE_CONTENT_VALID":"INCOMPLETE_LAZY_RENDERED_BLANK_REFERENCE";
   rec.full_page={original_pixels:[refFull.width,refFull.height],
    clone_pixels:[cloneFull.width,cloneFull.height],
    meaningful_source_height:meaningful,reference_quality:referenceQuality,
    height_error_pct:+(100*Math.abs(refFull.height-cloneFull.height)/refFull.height).toFixed(3)};
   if(meaningful>844&&cloneFull.height>=meaningful)
    rec.scroll_verified_prefix=measure(topRows(refFull,meaningful),cloneFull);
   rec.status=rec.viewport.mismatch_pct>MAX_MISMATCH?"FAIL_PIXEL":
    !rec.scroll_verified_prefix?"UNVERIFIED":
    rec.scroll_verified_prefix.mismatch_pct>MAX_MISMATCH?"FAIL_PIXEL":
    referenceQuality!=="FULL_PAGE_CONTENT_VALID"?"PASS_VERIFIED_PREFIX":
    rec.full_page.height_error_pct>10?"FAIL_GEOMETRY":"PASS";
   if(rec.status==="PASS_VERIFIED_PREFIX")
    rec.limitation="Original lazy-loaded full-page screenshot has blank area; only verified prefix was compared";
  }else{
   rec.status=rec.viewport.mismatch_pct>MAX_MISMATCH?"FAIL_PIXEL":"PASS_VIEWPORT_ONLY";
   rec.limitation="Original full-page screenshot unavailable; only 390x844 viewport was compared";
  }
  if(!SUCCESS.has(rec.status))writeDiff(src,dst,c.id);
 }catch(err){
  rec.status="RENDER_ERROR";rec.reason=String(err.stack||err).slice(0,1200);
  if(page)try{await page.screenshot({path:path.join(DEST,"render-error-"+c.id+".png"),fullPage:false,timeout:2500})}catch{}
 }finally{
  if(page)await page.close().catch(()=>{});
  rec.duration_ms=Date.now()-started;
 }
 console.log("SOURCE_WEB_PIXEL_RESULT "+JSON.stringify(rec));
 return rec;
}
(async()=>{
 const started=Date.now();
 const contextOptions={viewport:{width:390,height:844},deviceScaleFactor:1,
  isMobile:true,hasTouch:true,locale:"ko-KR",timezoneId:"Asia/Seoul",reducedMotion:"reduce"};
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const context=await browser.newContext(contextOptions);
 const results=new Array(inventory.cases.length);
 let cursor=0;
 try{
  await Promise.all(Array.from({length:WORKERS},async()=>{
   while(cursor<inventory.cases.length){
    const index=cursor++;
    results[index]=await runOne(context,inventory.cases[index]);
   }
  }));
 }finally{await context.close();await browser.close()}
 const summary={planned:inventory.cases.length,examined:results.filter(Boolean).length,
  passed:results.filter(x=>SUCCESS.has(x?.status)).length,
  failed:results.filter(x=>x?.status?.startsWith("FAIL")).length,
  render_errors:results.filter(x=>x?.status==="RENDER_ERROR").length,
  missing_original:results.filter(x=>x?.status==="SOURCE_MISSING").length,
  unverified:results.filter(x=>x?.status==="UNVERIFIED").length,
  workers:WORKERS,elapsed_ms:Date.now()-started};
 const report={source:"ORIGINAL_PUBLIC_WEB_2026_11_09_HTTP200",not_android_apk:true,
  target:"GitHub Pages static website",pixel_threshold_pct:MAX_MISMATCH,
  rgb_threshold:THRESHOLD,mode:"PARALLEL_29_COLLECT_ALL",
  summary,records:results};
 fs.writeFileSync(path.join(DEST,"pixel-report.json"),JSON.stringify(report,null,2));
 fs.writeFileSync(path.join(DEST,"summary.md"),[
  "# MyDoctor 29-screen original website pixel audit",
  "",
  "Original: my-doctor.io web screenshots, 2026-11-09. Not original Android APK.",
  "Screen: 390 × 844, max 10% mismatched RGB pixels (>25/channel).",
  "Planned "+summary.planned+" | Passed "+summary.passed+
  " | Pixel failed "+summary.failed+" | Render errors "+summary.render_errors+
  " | Missing source "+summary.missing_original+" | Unverified "+summary.unverified,
  "",
  "| Screen | Status | Pixel mismatch | Duration (ms) |",
  "|---|---|---:|---:|",
  ...results.map(x=>"| "+x.id+" | "+x.status+" | "+(x.viewport?.mismatch_pct??"—")+"% | "+(x.duration_ms??"—")+" |")
 ].join("\n"));
 console.log("SOURCE_WEB_PIXEL_SUMMARY "+JSON.stringify(summary));
 if(summary.examined!==29||summary.passed!==29)process.exitCode=2;
})().catch(e=>{console.error("SOURCE_WEB_PIXEL_FATAL",e);process.exitCode=1});
