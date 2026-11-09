/* Original-vs-clone mobile screenshot audit. Similarity is MEASURED, never presumed. */
const{chromium}=require("playwright");
const{PNG}=require("pngjs");
const fs=require("node:fs"),path=require("node:path");
const base=process.env.MD_URL||"http://127.0.0.1:5173";
// The user's accepted visual threshold includes all visible layout, text and images.
const VISUAL_MAX_DIFF_PERCENT=10;
const isVisualPass=percent=>Number.isFinite(percent)&&percent<=VISUAL_MAX_DIFF_PERCENT;
const cases=[
 {name:"home",source:"/",clone:"/"},
 {name:"doctor-selection",source:"/telemedicine/all-department",clone:"/telemedicine/all-department"},
 {name:"hospital-search",source:"/hospital",clone:"/hospital"},
 {name:"medical-cost",source:"/medical-cost",clone:"/medical-cost"},
 {name:"hospital-detail",source:"/hospital/detail?hospital_id=323",clone:"/hospital/detail?hospital_id=323"}];
function diff(x,y){
 const a=PNG.sync.read(x),b=PNG.sync.read(y);
 if(a.width!==b.width)throw Error("Different screenshot widths");
 let changed=0,total=0;
 const width=a.width,height=Math.max(a.height,b.height);
 const heatmap=new PNG({width,height});
 for(let row=0;row<height;row++)for(let col=0;col<width;col++){
  const dest=(row*width+col)*4;
  let dx=255;
  if(row<a.height&&row<b.height){
    const p=dest;dx=Math.max(Math.abs(a.data[p]-b.data[p]),Math.abs(a.data[p+1]-b.data[p+1]),Math.abs(a.data[p+2]-b.data[p+2]));
  }
  total+=dx;if(dx>20)changed++;
  heatmap.data[dest]=Math.min(255,dx*4);heatmap.data[dest+1]=0;heatmap.data[dest+2]=0;heatmap.data[dest+3]=255;
 }
 return{changed_ratio_percent:+(changed/(width*height)*100).toFixed(2),mean_pixel_delta:+(total/(width*height)).toFixed(2),heatmap};
}
(async()=>{
 fs.mkdirSync("qa-artifacts",{recursive:true});
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const report=[];
 try{for(const c of cases){
  const source=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const clone=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  try{
   let x,originalFull,sourceMode="live-original-20261109";
   try{
    const s=await source.goto("https://my-doctor.io"+c.source,{waitUntil:"domcontentloaded",timeout:20000});
    if(!s||s.status()>=400)throw Error("Original HTTP "+s?.status());
    await source.waitForTimeout(1100);
    x=await source.screenshot({path:path.join("qa-artifacts","source-"+c.name+".png")});
    // Scan the original page to load lazy images before capturing below-the-fold layout.
    await source.evaluate(async()=>{
      const height=Math.min(20000,document.documentElement.scrollHeight);
      for(let y=0;y<height;y+=800){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,65));}
      window.scrollTo(0,0);await document.fonts.ready;
    });
    originalFull=await source.screenshot({path:path.join("qa-artifacts","source-full-"+c.name+".png"),fullPage:true});
   }catch(originError){
    const pinned=path.join(process.env.MD_SOURCE_BASELINE_DIR||"qa-baseline","source-"+c.name+".png");
    if(!fs.existsSync(pinned))throw originError;
    x=fs.readFileSync(pinned);
    fs.writeFileSync(path.join("qa-artifacts","source-"+c.name+".png"),x);
    const pinnedFull=path.join(process.env.MD_SOURCE_BASELINE_DIR||"qa-baseline","source-full-"+c.name+".png");
    if(fs.existsSync(pinnedFull))originalFull=fs.readFileSync(pinnedFull);
    sourceMode="pinned-genuine-original-GitHub-run-42611400204";
   }
   await clone.goto(base+c.clone,{waitUntil:"domcontentloaded",timeout:20000});
   await clone.waitForTimeout(1100);
   if(await clone.locator('[role="alert"]').count())throw Error("Clone has source-data error");
   const y=await clone.screenshot({path:path.join("qa-artifacts","clone-"+c.name+".png")});
   const m=diff(x,y);
   await clone.evaluate(async()=>{
     const height=Math.min(20000,document.documentElement.scrollHeight);
     for(let y=0;y<height;y+=800){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,65));}
     window.scrollTo(0,0);await document.fonts.ready;
   });
   const cloneFull=await clone.screenshot({path:path.join("qa-artifacts","clone-full-"+c.name+".png"),fullPage:true});
   const full=originalFull?diff(originalFull,cloneFull):null;
   if(full)fs.writeFileSync(path.join("qa-artifacts","heatmap-full-"+c.name+".png"),PNG.sync.write(full.heatmap));
   const sourceMetrics=sourceMode.startsWith("live-")?await source.evaluate(()=>{
     const el=document.querySelector("h1")||document.querySelector("h2");
     if(!el)return null;
     const s=getComputedStyle(el),r=el.getBoundingClientRect();
     return {fontFamily:s.fontFamily,fontWeight:s.fontWeight,fontSize:s.fontSize,lineHeight:s.lineHeight,
       letterSpacing:s.letterSpacing,fontLoaded:document.fonts.check('700 24px "Pretendard Variable"'),rect:{x:r.x,y:r.y,width:r.width,height:r.height}};
   }):null;
   const cloneMetrics=await clone.evaluate(()=>{
     const el=document.querySelector("h1")||document.querySelector("h2");
     if(!el)return null;
     const s=getComputedStyle(el),r=el.getBoundingClientRect();
     return {fontFamily:s.fontFamily,fontWeight:s.fontWeight,fontSize:s.fontSize,lineHeight:s.lineHeight,
       letterSpacing:s.letterSpacing,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};
   });
   console.log("TYPOGRAPHY AUDIT",c.name,JSON.stringify({sourceMetrics,cloneMetrics}));
   const probes=await Promise.all([source,clone].map(async(p)=>{
     if(p===source&&!sourceMode.startsWith("live-"))return null;
     return p.evaluate(()=>{
       const selectors=["header","header img","h1","h2",".breadcrumb",".md-intro",".md-intro p",".md-tabs",".md-tabs button",
         ".symptom-group",".md-symptoms",".md-lookup",".md-lookup label",".md-blue-button",".md-dept-list",
         ".md-cost-intro",".md-cost-intro p",".md-cost-list",".md-cost-grid",".cost-tile",
         ".clinic-head",".clinic-location",".clinic-actions",".md-clinic-tabs",".clinic-prices",".price-chips",
         ".md-home h1",".md-awards",".md-stats",".md-stat-notes",".md-home-hero"];
       return Object.fromEntries(selectors.map(sel=>{
         const el=document.querySelector(sel);if(!el)return[sel,null];
         const q=el.getBoundingClientRect(),c=getComputedStyle(el);
         return [sel,{x:Math.round(q.x),y:Math.round(q.y),w:Math.round(q.width),h:Math.round(q.height),
           font:c.fontSize,weight:c.fontWeight,line:c.lineHeight,bg:c.backgroundColor}];
       }));
     });
   }));
   console.log("LAYOUT AUDIT",c.name,JSON.stringify({source:probes[0],clone:probes[1]}));
   fs.writeFileSync(path.join("qa-artifacts","heatmap-"+c.name+".png"),PNG.sync.write(m.heatmap));
   const entry={name:c.name,source:"https://my-doctor.io"+c.source,clone:base+c.clone,status:!full?"FULL_PAGE_UNVERIFIED":isVisualPass(m.changed_ratio_percent)&&isVisualPass(full.changed_ratio_percent)?"VISUAL_PASS":"VISUAL_FAIL",visual_threshold_percent:VISUAL_MAX_DIFF_PERCENT,changed_ratio_percent:m.changed_ratio_percent,full_page_changed_percent:full?.changed_ratio_percent??null,mean_pixel_delta:m.mean_pixel_delta,source_mode:sourceMode};
   report.push(entry);console.log("VISUAL AUDIT",JSON.stringify(entry));
  }catch(e){const entry={name:c.name,status:"UNVERIFIED",reason:String(e.message||e)};report.push(entry);console.error("VISUAL AUDIT",JSON.stringify(entry))}
  finally{await source.close();await clone.close()}
 }}finally{await browser.close();fs.writeFileSync("qa-artifacts/source-parity.json",JSON.stringify({viewport:{width:390,height:844},pages:report,visual_threshold_percent:VISUAL_MAX_DIFF_PERCENT,visual_passed:report.filter(x=>x.status==="VISUAL_PASS").length,visual_failed:report.filter(x=>x.status==="VISUAL_FAIL").length,unverified:report.filter(x=>x.status==="UNVERIFIED"||x.status==="FULL_PAGE_UNVERIFIED").length,meaning:"Both 390x844 viewport and entire scrollable screenshot include layout/images; each must have 10% or less changed pixels. Original full-page baseline missing => UNVERIFIED. Data/feature parity is separate."},null,2))}
 // Different or inaccessible originals remain failing parity checks, not success.
 if(report.some(x=>x.status!=="VISUAL_PASS"))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
