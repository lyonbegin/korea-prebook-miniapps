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
/* Test-only font parameter sweep. The experiment never changes the cloned
 * source code or scores a modified page as a pass. All generated CSS is
 * removed before the browser proceeds to the next screen. */
function fontVariants(id){
 const out=[];
 if(id==="qna-index"){
  for(const sz of [14,14.5,15])
   for(const w of [400,500,600])
    out.push({name:"chips-"+sz+"-"+w,css:
     ".ow-legacy-page .original-qna-chips a{font-size:"+sz+"px;font-weight:"+w+";}"});
  for(const w of [450,500,550])
   out.push({name:"chips-weight-"+w+"-compact",css:
    ".ow-legacy-page .original-qna-chips a{font-weight:"+w+";letter-spacing:-.2px;}"});
  for(const t of [13.2,13.5,14])
   out.push({name:"item-body-"+t,css:".ow-legacy-page .original-qna-item p{font-size:"+t+"px;}"});
  for(const gap of [5,6,7,8])
   out.push({name:"chip-rowgap-"+gap,css:".ow-legacy-page .original-qna-chips{row-gap:"+gap+"px;}"});
 }
 if(id==="qna-index"){
  // Compare cumulative chip row pitch and leading Q&A card offsets in one run.
  for(const gap of [6,7,8,9])
   for(const margin of [22,25,28])
    out.push({name:"qna-layout-gap-"+gap+"-heading-"+margin,css:
     ".ow-legacy-page .original-qna-chips{row-gap:"+gap+"px;}"+
     ".ow-legacy-page .original-qna-index>header{margin-bottom:"+margin+"px;}"});
  for(const preview of [7,10,12])
   for(const font of [13.2,13.7,14])
    out.push({name:"preview-margin-"+preview+"-font-"+font,css:
     ".ow-legacy-page .original-qna-item p{margin-top:"+preview+"px;font-size:"+font+"px;}"});
 }
 if(id==="qna-index"){
  // Source DOM audit: title 24/700, chips 16/400, question title 15/600,
  // preview 15/400 with -0.15px tracking. Test these exact values against
  // the archived screenshot, plus the previously best 15/500.
  for(const chip of [{size:15,weight:500},{size:16,weight:400},{size:16,weight:500}]){
   for(const headingWeight of [700,750]){
    for(const questionWeight of [600,700]){
     for(const preview of [{size:14,line:19},{size:15,line:19},{size:15,line:22}]){
      out.push({name:"source-qna-chip-"+chip.size+"-"+chip.weight+"-head-"+headingWeight+
       "-title-"+questionWeight+"-preview-"+preview.size+"-"+preview.line,css:
       ".ow-legacy-page .original-qna-index h1{font-weight:"+headingWeight+";}"+
       ".ow-legacy-page .original-qna-chips a{font-size:"+chip.size+"px;font-weight:"+chip.weight+";}"+
       ".ow-legacy-page .original-qna-item strong{font-weight:"+questionWeight+";}"+
       ".ow-legacy-page .original-qna-item p{font-size:"+preview.size+"px;line-height:"+preview.line+
       "px;letter-spacing:-.15px;}"});
     }
    }
   }
  }
 }

 if(id==="qna-index"){
  // Compare archived Nov-09 typography with current live-source DOM metrics.
  for(const h1Line of [26,32]){
   for(const chip of [
    {name:"archive-15-500",size:15,weight:500,line:"17px",height:"auto",padding:"8px 12px"},
    {name:"live-16-400",size:16,weight:400,line:"normal",height:"34px",padding:"0 12px"}
   ]){
    for(const question of [{weight:700,line:21},{weight:600,line:22}]){
     for(const previewLine of [19,22]){
      for(const metaSize of [12,13]){
       out.push({name:"qna-type-"+h1Line+"-"+chip.name+"-q"+question.weight+"-"+question.line+"-p"+previewLine+"-m"+metaSize,
        css:".ow-legacy-page .original-qna-index h1{line-height:"+h1Line+"px;}"+
         ".ow-legacy-page .original-qna-chips a{font-size:"+chip.size+"px;font-weight:"+chip.weight+
         ";line-height:"+chip.line+";height:"+chip.height+";padding:"+chip.padding+";}"+
         ".ow-legacy-page .original-qna-item strong{font-size:15px;font-weight:"+question.weight+
         ";line-height:"+question.line+"px;letter-spacing:-.15px;}"+
         ".ow-legacy-page .original-qna-item p{font-size:15px;font-weight:400;line-height:"+
         previewLine+"px;letter-spacing:-.15px;}"+
         ".ow-legacy-page .original-qna-card-meta{font-size:"+metaSize+"px;line-height:18px;}"});
      }
     }
    }
   }
  }
 }
 if(id==="qna-answer"){
  // Content section height must stay anchored while text lines move.
  for(const questionMargin of [18,21,24])
   for(const answerMargin of [10,12,15])
    out.push({name:"answer-layout-q-"+questionMargin+"-a-"+answerMargin,css:
     ".ow-qd-page .ow-qd-author{margin-bottom:"+questionMargin+"px;}"+
     ".ow-qd-page .ow-qd-answer-head{margin-bottom:"+answerMargin+"px;}"});
 }
 if(id==="qna-answer"){
  // The archived Nov-09 baseline has narrower question text wrapping than
  // the current live source redesign. Sweep smaller historical sizes as well
  // as current source 17px, keeping question and answer text independent.
  for(const h1Weight of [700,750,790]){
   for(const q of [14,14.5,15,15.5,16,16.5,17]){
    for(const a of [14,15,15.5,16,16.5,17]){
     for(const tracking of [-.17,0]){
      out.push({name:"source-answer-h1-"+h1Weight+"-q-"+q+"-a-"+a+"-ls-"+tracking,css:
       ".ow-qd-page .ow-qd-question h1{font-weight:"+h1Weight+";}"+
       ".ow-qd-page .ow-qd-question-text{font-size:"+q+"px;letter-spacing:"+tracking+"px;}"+
       ".ow-qd-page .ow-qd-answer>p{font-size:"+a+"px;letter-spacing:"+tracking+"px;}"});
     }
    }
   }
  }
 }
 if(id==="qna-answer"){
  // Archived title tracking was not included in the first 281-case sweep.
  for(const h1Tracking of [-.25,0,.1]){
   for(const h1Weight of [700,750]){
    out.push({name:"answer-h1-tracking-"+h1Tracking+"-weight-"+h1Weight,css:
     ".ow-qd-page .ow-qd-question h1{letter-spacing:"+h1Tracking+"px;font-weight:"+h1Weight+";}"});
   }
  }
  for(const h1Tracking of [-.25,0]){
   for(const q of [16,17]){
    for(const a of [16,17]){
     out.push({name:"answer-h1-"+h1Tracking+"-question-"+q+"-answer-"+a,css:
      ".ow-qd-page .ow-qd-question h1{letter-spacing:"+h1Tracking+"px;}"+
      ".ow-qd-page .ow-qd-question-text{font-size:"+q+"px;}"+
      ".ow-qd-page .ow-qd-answer>p{font-size:"+a+"px;}"});
    }
   }
  }
 }
 if(id==="qna-answer"){
  for(const q of [15.5,16,16.5,17])
   for(const a of [15.5,16,16.5])
    out.push({name:"body-"+q+"-answer-"+a,css:
     ".ow-qd-page .ow-qd-question-text{font-size:"+q+"px;letter-spacing:0;}"+
     ".ow-qd-page .ow-qd-answer>p{font-size:"+a+"px;}"});
  for(const w of [450,500,550])
   out.push({name:"weight-"+w,css:
    ".ow-qd-page .ow-qd-question-text,.ow-qd-page .ow-qd-answer>p{font-weight:"+w+";}"});
 }
 if(id==="health-article-or-test"){
  for(const t of [15,15.5,16,16.5,17])
   for(const ls of [0,.2,.4])
    out.push({name:"article-"+t+"-ls-"+ls,css:
     ".ow-legacy-page .original-health-article>p{font-size:"+t+"px;letter-spacing:"+ls+"px;}"});
 }
 if(id==="medicine-detail"){
  for(const t of [13,13.5,14,14.5,15])
   for(const b of [15,16,17])
    out.push({name:"intro-"+t+"-body-"+b,css:
     ".ow-legacy-page .original-drug-intro p{font-size:"+t+"px;}"+
     ".ow-legacy-page .original-drug-symptoms p{font-size:"+b+"px;}"});
 }
 /* Test whether the original screenshots resemble an entirely different
  * family. These variants are temporary and never alter production CSS. */
 if(["qna-index","qna-answer","medicine-detail","health-article-or-test"].includes(id)){
  for(const family of ["Pretendard Variable","Noto Sans CJK KR","Nanum Gothic","Arial","system-ui"]){
   const fam='"'+family+'"';
   out.push({name:"font-family-"+family,css:
    ".ow-legacy-page,.ow-qd-page{font-family:"+fam+",sans-serif!important;}"});
  }
 }
 return out;
}
async function measureFontVariants(page,source,id){
 const candidates=fontVariants(id);
 if(!candidates.length)return null;
 const result=[];
 for(const item of candidates){
  let sheet;
  try{
   sheet=await page.addStyleTag({content:item.css});
   const shot=PNG.sync.read(await page.screenshot({fullPage:false,animations:"disabled"}));
   result.push({name:item.name,pct:measure(source,shot).mismatch_pct,css:item.css});
  }finally{
   if(sheet)await sheet.evaluate(el=>el.remove()).catch(()=>{});
  }
 }
 result.sort((a,b)=>a.pct-b.pct);
 const ret={tested:result.length,best:result.slice(0,12)};
 console.log("MYDOCTOR_FONT_SWEEP "+JSON.stringify({id,baseline:"normal",...ret}));
 return ret;
}

async function auditLiveOriginalFonts(context){
 const out={url:"https://my-doctor.io/qna",capture_kind:"LIVE_SOURCE_DOM_NOT_ARCHIVED_PIXEL_BASELINE"};
 let page;
 try{
  page=await context.newPage();
  const response=await page.goto(out.url,{waitUntil:"domcontentloaded",timeout:30000});
  out.http_status=response?.status()??null;
  await page.waitForLoadState("networkidle",{timeout:15000}).catch(()=>{});
  await page.evaluate(async()=>{await document.fonts.ready});
  out.index=await page.evaluate(async()=>{
   const describe=el=>{
    if(!el)return null;
    const s=getComputedStyle(el),r=el.getBoundingClientRect();
    return {tag:el.tagName,classes:typeof el.className==="string"?el.className:"",text:(el.innerText||el.textContent||"").trim().slice(0,100),
     fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight,
     letterSpacing:s.letterSpacing,width:+r.width.toFixed(2),height:+r.height.toFixed(2),
     href:el.href||null,html:el.outerHTML.slice(0,320)};
   };
   const h1=[...document.querySelectorAll("h1")].find(x=>(x.innerText||"").includes("의료진 Q&A"));
   const root=h1?.closest("main")||document.body;
   const links=[...root.querySelectorAll("a")];
   const chips=links.filter(a=>["정형외과","내과","피부과"].includes((a.innerText||"").trim())&&a.href.includes("/qna"));
   const items=links.filter(a=>/^\s*Q\s/.test(a.innerText||""));
   const faces=[...document.fonts].map(f=>({family:f.family,status:f.status,weight:f.weight,style:f.style}));
   const fontResources=performance.getEntriesByType("resource")
    .filter(x=>/\.(woff2?|ttf|otf)(\?|$)|font|pretendard|noto/i.test(x.name))
    .map(x=>({url:x.name,ms:Math.round(x.duration),bytes:x.transferSize||x.decodedBodySize||0}));
   const sheets=[...document.styleSheets].map(s=>s.href).filter(Boolean);
   const faceRules=[];
   for(const sheet of document.styleSheets){try{for(const rule of sheet.cssRules||[])if(rule.type===CSSRule.FONT_FACE_RULE)faceRules.push(rule.cssText)}catch{}}
   const fetchedFontRules=await Promise.all(sheets.map(async href=>{
    try{const css=await fetch(href).then(r=>r.text());return {href,fontFaces:[...(css.matchAll(/@font-face\s*\{[^}]*\}/g))].map(x=>x[0]).filter(x=>/Pretendard|woff2/i.test(x)).slice(0,100)}}
    catch(e){return {href,error:String(e).slice(0,180)}}
   }));
   const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");
   const sample="한 달 전부터 아침에 일어나 첫걸음을 뗄 때 발뒤꿈치가";
   const widths={};
   for(const family of ["Pretendard Variable","Pretendard","Noto Sans KR","Apple SD Gothic Neo","Arial","sans-serif"]){
    ctx.font='16px "'+family+'"';widths[family]=+ctx.measureText(sample).width.toFixed(2);
   }
   return {title:document.title,url:location.href,heading:describe(h1),chips:chips.slice(0,4).map(describe),
    firstQuestions:items.slice(0,3).map(el=>({root:describe(el),children:[...el.querySelectorAll("span,p,strong,small")].slice(0,8).map(describe)})),firstQuestionHref:items[0]?.href||null,
    fontFaces:faces,fontResources,styleSheets:sheets,fontFaceRules:faceRules.slice(0,12),fetchedFontRules,
    fontChecks:{pretendardVariable:document.fonts.check('16px "Pretendard Variable"'),
     pretendard:document.fonts.check('16px Pretendard'),notoSansKr:document.fonts.check('16px "Noto Sans KR"')},
    sampleTextWidths:widths};
  });
  if(out.index?.firstQuestionHref){
   await page.goto(out.index.firstQuestionHref,{waitUntil:"domcontentloaded",timeout:25000});
   await page.waitForLoadState("networkidle",{timeout:12000}).catch(()=>{});
   await page.evaluate(async()=>{await document.fonts.ready});
   out.detail=await page.evaluate(()=>{
    const describe=el=>{if(!el)return null;const s=getComputedStyle(el),r=el.getBoundingClientRect();
     return {tag:el.tagName,classes:typeof el.className==="string"?el.className:"",text:(el.innerText||"").trim().slice(0,130),
      fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight,
      letterSpacing:s.letterSpacing,width:+r.width.toFixed(2),height:+r.height.toFixed(2)}};
    const title=[...document.querySelectorAll("h1,h2")].find(e=>(e.innerText||"").trim().length>12);
    const paras=[...document.querySelectorAll("p")].filter(e=>(e.innerText||"").trim().length>25).slice(0,6);
    return {url:location.href,title:document.title,heading:describe(title),paragraphs:paras.map(describe),
     fontFaces:[...document.fonts].map(f=>({family:f.family,status:f.status,weight:f.weight,style:f.style})),
     fontResources:performance.getEntriesByType("resource").filter(x=>/\.(woff2?|ttf|otf)(\?|$)|font|pretendard|noto/i.test(x.name)).map(x=>x.name)};
   });
  }
 }catch(e){out.error=String(e.stack||e).slice(0,1500)}
 finally{if(page)await page.close().catch(()=>{})}
 console.log("MYDOCTOR_LIVE_SOURCE_FONT_AUDIT "+JSON.stringify(out));
 return out;
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
   // Set the archived browser screenshot's Tuesday 01:00 KST clock before
   // navigation. addInitScript avoids page.clock controller incompatibility.
   await page.addInitScript(({iso})=>{
    const RealDate=window.Date;
    class SnapshotDate extends RealDate{
     constructor(...args){super(...(args.length?args:[iso]));}
     static now(){return new RealDate(iso).getTime();}
    }
    window.Date=SnapshotDate;
   },{iso:"2026-11-09T16:00:00.000Z"});
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
  if(["qna-index","qna-answer","hospital-detail","health-article-or-test"].includes(c.id)){
   rec.typography=await page.evaluate(()=>{
    const selectors=[
     ".original-qna-index h1",".original-qna-chips a",
     ".original-qna-item strong",".original-qna-item p",
     ".ow-qd-question h1",".ow-qd-question-text",
     ".ow-qd-answer>p",".ow-hd-info h2",".original-health-article>p"];
    const styles=Object.fromEntries(selectors.map(sel=>{
     const el=document.querySelector(sel);
     if(!el)return [sel,null];
     const s=getComputedStyle(el),r=el.getBoundingClientRect();
     return [sel,{font:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,
       lineHeight:s.lineHeight,letterSpacing:s.letterSpacing,boxWidth:+r.width.toFixed(2),
       boxHeight:+r.height.toFixed(2),preview:el.textContent?.slice(0,55)}];
    }).filter(([,v])=>v));
    const allFonts=[...document.fonts];
    const fonts=allFonts.map(f=>({family:f.family,status:f.status,weight:f.weight,style:f.style})).slice(0,24);
    const loadedPretendardFaces=allFonts.filter(f=>f.family.replaceAll('"',"")==="Pretendard Variable"&&f.status==="loaded").length;
    const fontNetwork=performance.getEntriesByType("resource")
      .filter(x=>/woff|ttf|pretendard|font|jsdelivr/i.test(x.name))
      .map(x=>({name:x.name,ms:Math.round(x.duration),bytes:x.transferSize})).slice(0,40);
    const probe=document.querySelector(".ow-qd-question-text")||
      document.querySelector(".original-qna-item strong")||
      document.querySelector(".original-health-article>p")||
      document.querySelector(".original-drug-intro h1");
    const probeStyle=probe?getComputedStyle(probe):null;
    const probeText=(probe?.textContent||"").trim().slice(0,120);
    const probeFont=probeStyle?probeStyle.fontWeight+" "+probeStyle.fontSize+' "Pretendard Variable"':'400 16px "Pretendard Variable"';
    const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");
    ctx.font=probeFont;
    const sampleWidth=+ctx.measureText(probeText).width.toFixed(2);
    return {styles,fonts,loadedPretendardFaces,
      actualTextPretendardCheck:document.fonts.check(probeFont,probeText),
      probeFont,probeText,sampleWidth,fontNetwork};
   });
   console.log("MYDOCTOR_SOURCE_FONT_AUDIT "+JSON.stringify({id:c.id,typography:rec.typography}));
   if(["qna-index","qna-answer"].includes(c.id)&&
      (rec.typography.loadedPretendardFaces<1||!rec.typography.actualTextPretendardCheck))
    throw Error("Pretendard Variable did not load for visible Korean text on "+c.id);
  }
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
  if((process.env.PIXEL_FONT_SWEEP==="1"||c.id==="qna-index")&&fontVariants(c.id).length)rec.font_sweep=await measureFontVariants(page,src,c.id);
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
 await auditLiveOriginalFonts(context);
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
