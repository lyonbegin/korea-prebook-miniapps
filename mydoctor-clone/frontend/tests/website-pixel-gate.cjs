/* Strict source-website-versus-GitHub-Pages pixel audit.
 * Source PNG captured from actual my-doctor.io web browser, 2026-11-09, HTTP 200.
 * NOT an Android APK screenshot. Compare in the exact order; stop at first fail.
 * A pass requires <=10% RGB mismatch per viewport AND near-equal full-page
 * geometry. RGB max-channel difference >25 counts as mismatched.
 */
const {chromium}=require("playwright");
const {PNG}=require("pngjs");
const fs=require("fs"),path=require("path");
const ROOT=path.resolve(__dirname,"..");
const ORIGINAL=path.join(ROOT,"qa-original");
const DEST=path.join(ROOT,"website-pixel-evidence");
const SITE=process.env.PAGES_TEST_URL||"http://127.0.0.1:4173/korea-prebook-miniapps/";
const THRESHOLD=25,MAX_MISMATCH=10;
const cases=[
 {id:"home",source:"origin-home.png",full:"source-full-home.png",url:"?screen=home"},
 /* Only add the next page after the previous page has actually passed */
];
fs.mkdirSync(DEST,{recursive:true});
function renderMetrics(source,target,label){
 const w=source.width,h=source.height;
 const diff=new PNG({width:w,height:h}),overlay=new PNG({width:w,height:h});
 const total=w*h;let changed=0,mae=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;
  const j=(y*target.width+x)*4;
  const sa=y<source.height&&x<source.width;
  const ta=y<target.height&&x<target.width;
  const aa=sa?[source.data[i],source.data[i+1],source.data[i+2]]:[255,255,255];
  const bb=ta?[target.data[j],target.data[j+1],target.data[j+2]]:[255,255,255];
  const vals=aa.map((v,k)=>Math.abs(v-bb[k]));
  const magnitude=Math.max(...vals);
  if(!ta||magnitude>THRESHOLD)changed++;
  mae+=(vals[0]+vals[1]+vals[2])/3;
  const redness=!ta?255:Math.min(255,magnitude*2);
  diff.data[i]=redness;diff.data[i+1]=magnitude>THRESHOLD?30:240;
  diff.data[i+2]=magnitude>THRESHOLD?38:240;diff.data[i+3]=255;
  for(let k=0;k<3;k++)overlay.data[i+k]=Math.round((aa[k]+bb[k])/2);
  overlay.data[i+3]=255;
 }
 fs.writeFileSync(path.join(DEST,"heatmap-"+label+".png"),PNG.sync.write(diff));
 fs.writeFileSync(path.join(DEST,"overlay-"+label+".png"),PNG.sync.write(overlay));
 return {mismatch_pct:+(changed/total*100).toFixed(3),mae:+(mae/total).toFixed(3),
  total_pixels:total,original:[source.width,source.height],
  clone:[target.width,target.height],threshold_rgb:THRESHOLD};
}
function meaningfulOriginalScrollEnd(png){
  // Original browser's fullPage screenshot was captured without scrolling.
  // The sections below ~2,365px are pure white because lazy content did not
  // render. Never treat these blank rows as pixel ground truth.
  let last=0;
  for(let y=0;y<png.height;y++){
    let nonwhite=0;
    for(let x=0;x<png.width;x++){
      const i=(y*png.width+x)*4;
      if(Math.min(png.data[i],png.data[i+1],png.data[i+2])<242)nonwhite++;
    }
    if(nonwhite/png.width>.05)last=y;
  }
  return last+1;
}
function topRows(src,height){
  const out=new PNG({width:src.width,height});
  src.data.copy(out.data,0,0,src.width*height*4);
  return out;
}
function comparisonPanel(source,target,label){
 const w=source.width,h=source.height,panel=new PNG({width:w*3,height:h});
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const si=(y*w+x)*4;const clonePixel=y<target.height;
  const ti=(y*target.width+x)*4;
  const before=(y*panel.width+x)*4,after=(y*panel.width+x+w)*4,diff=(y*panel.width+x+w*2)*4;
  for(let k=0;k<3;k++){
   panel.data[before+k]=source.data[si+k];
   panel.data[after+k]=clonePixel?target.data[ti+k]:255;
  }
  const d=Math.max(...[0,1,2].map(k=>Math.abs(source.data[si+k]-(clonePixel?target.data[ti+k]:255))));
  panel.data[diff]=d>THRESHOLD?255:244;
  panel.data[diff+1]=d>THRESHOLD?35:244;
  panel.data[diff+2]=d>THRESHOLD?35:244;
  panel.data[before+3]=panel.data[after+3]=panel.data[diff+3]=255;
 }
 fs.writeFileSync(path.join(DEST,"side-by-side-"+label+".png"),PNG.sync.write(panel));
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,
   isMobile:true,hasTouch:true,locale:"ko-KR",timezoneId:"Asia/Seoul",reducedMotion:"reduce"});
 const records=[];
 try{
  for(const c of cases){
   const rec={id:c.id,source_site:"https://my-doctor.io",clone_site:SITE,original_capture_run:42650015118,
    original_captured_date:"2026-11-09",comparison_date:new Date().toISOString(),status:"UNVERIFIED"};
   const sourceFile=path.join(ORIGINAL,c.source),sourceFull=path.join(ORIGINAL,c.full);
   if(!fs.existsSync(sourceFile)||!fs.existsSync(sourceFull)){
    rec.reason="SOURCE_SCREENSHOTS_MISSING";records.push(rec);break;
   }
   const page=await context.newPage();
   const pageErrors=[];
   page.on("pageerror",e=>pageErrors.push(e.message));
   try{
    const http=await page.goto(SITE+c.url,{waitUntil:"networkidle",timeout:35000});
    if(http?.status()!==200)throw Error("Clone HTTP "+http?.status());
    await page.locator("[data-testid='website-parity-home']").waitFor({timeout:12000});
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(
      [...document.images].map(img=>img.complete?Promise.resolve():new Promise(r=>{
        img.addEventListener("load",r,{once:true});img.addEventListener("error",r,{once:true});setTimeout(r,3000);
      })))});
    await page.waitForTimeout(250);
    if(pageErrors.length)throw Error("Page JavaScript errors: "+pageErrors.join("; "));
    const viewport=await page.screenshot({fullPage:false});
    const full=await page.screenshot({fullPage:true});
    fs.writeFileSync(path.join(DEST,"clone-"+c.id+".png"),viewport);
    fs.writeFileSync(path.join(DEST,"clone-full-"+c.id+".png"),full);
    const sourcePng=PNG.sync.read(fs.readFileSync(sourceFile)),clonePng=PNG.sync.read(viewport);
    const origFullPng=PNG.sync.read(fs.readFileSync(sourceFull)),clFullPng=PNG.sync.read(full);
    if(sourcePng.width!==clonePng.width||sourcePng.height!==clonePng.height)
      throw Error("Viewport mismatch "+sourcePng.width+"x"+sourcePng.height+" vs "+clonePng.width+"x"+clonePng.height);
    rec.viewport=renderMetrics(sourcePng,clonePng,c.id);
    comparisonPanel(sourcePng,clonePng,c.id);
    const meaningfulRows=meaningfulOriginalScrollEnd(origFullPng);
    const fullReferenceQuality=meaningfulRows/origFullPng.height>.85?
      "FULL_PAGE_CONTENT_VALID":"INCOMPLETE_LAZY_RENDERED_BLANK_REFERENCE";
    rec.full_page={
      original_pixels:[origFullPng.width,origFullPng.height],
      clone_pixels:[clFullPng.width,clFullPng.height],
      meaningful_source_height:meaningfulRows,
      reference_quality:fullReferenceQuality,
      height_error_pct:+(100*Math.abs(origFullPng.height-clFullPng.height)/origFullPng.height).toFixed(3),
    };
    if(meaningfulRows>844){
      rec.scroll_verified_prefix=renderMetrics(
        topRows(origFullPng,meaningfulRows),clFullPng,c.id+"-scroll-prefix");
    }
    rec.status=rec.viewport.mismatch_pct>MAX_MISMATCH?"FAIL":
      fullReferenceQuality!=="FULL_PAGE_CONTENT_VALID"?"FIRST_VIEWPORT_PASS_SCROLL_UNVERIFIED":
      rec.scroll_verified_prefix?.mismatch_pct>MAX_MISMATCH?"FAIL":
      rec.full_page.height_error_pct>10?"FAIL":"PASS";
    console.log("SOURCE_WEB_PIXEL_RESULT",JSON.stringify(rec));
   }catch(err){
    rec.status="UNVERIFIED";rec.reason=String(err.stack||err);
    console.log("SOURCE_WEB_PIXEL_BLOCKED",JSON.stringify({id:c.id,error:rec.reason.slice(0,450)}));
   }finally{await page.close()}
   records.push(rec);
   if(rec.status!=="PASS")break;
  }
 }finally{await browser.close()}
 const report={source:"REAL_BROWSER_SCREENSHOTS_2026_11_09_HTTP200",
   current_original_access:"LIVE_BROWSER_ORIGIN_CAN_RETURN_429",
   clone:"GITHUB_PAGES_STATIC",
   first_viewport_threshold_percent:MAX_MISMATCH,
   full_height_threshold_percent:10,
   rgb_threshold:THRESHOLD,
   compare_order:"STRICT_SEQUENTIAL_STOP_ON_FIRST_NON_PASS",
   pages_planned:cases.length,pages_passed:records.filter(r=>r.status==="PASS").length,
   pages_failed:records.filter(r=>r.status==="FAIL").length,records};
 fs.writeFileSync(path.join(DEST,"pixel-report.json"),JSON.stringify(report,null,2));
 console.log("SOURCE_WEB_PIXEL_SUMMARY",JSON.stringify({passed:report.pages_passed,
  failed:report.pages_failed,records:records.map(x=>({id:x.id,status:x.status,
    mismatch_pct:x.viewport?.mismatch_pct,height_error_pct:x.full_page?.height_error_pct}))}));
 if(report.pages_passed!==cases.length)process.exitCode=2;
})().catch(e=>{console.error(e);process.exitCode=1});
