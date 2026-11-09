/* Original-vs-clone mobile screenshot audit. Similarity is MEASURED, never presumed. */
const{chromium}=require("playwright");
const{PNG}=require("pngjs");
const fs=require("node:fs"),path=require("node:path");
const base=process.env.MD_URL||"http://127.0.0.1:5173";
const cases=[
 {name:"home",source:"/",clone:"/"},
 {name:"doctor-selection",source:"/telemedicine/all-department",clone:"/telemedicine/all-department"},
 {name:"hospital-search",source:"/hospital",clone:"/hospital"},
 {name:"medical-cost",source:"/medical-cost",clone:"/medical-cost"},
 {name:"hospital-detail",source:"/hospital/detail?hospital_id=323",clone:"/hospital/detail?hospital_id=323"}];
function diff(x,y){
 const a=PNG.sync.read(x),b=PNG.sync.read(y);
 if(a.width!==b.width||a.height!==b.height)throw Error("Different dimensions");
 let changed=0,total=0;
 const heatmap=new PNG({width:a.width,height:a.height});
 for(let i=0;i<a.data.length;i+=4){
  const dx=Math.max(Math.abs(a.data[i]-b.data[i]),Math.abs(a.data[i+1]-b.data[i+1]),Math.abs(a.data[i+2]-b.data[i+2]));
  total+=dx;if(dx>20)changed++;
  heatmap.data[i]=Math.min(255,dx*4);heatmap.data[i+1]=0;heatmap.data[i+2]=0;heatmap.data[i+3]=255;
 }
 return{changed_ratio_percent:+(changed/(a.width*a.height)*100).toFixed(2),mean_pixel_delta:+(total/(a.width*a.height)).toFixed(2),heatmap};
}
(async()=>{
 fs.mkdirSync("qa-artifacts",{recursive:true});
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const report=[];
 try{for(const c of cases){
  const source=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const clone=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  try{
   let x,sourceMode="live-original-20261109";
   try{
    const s=await source.goto("https://my-doctor.io"+c.source,{waitUntil:"domcontentloaded",timeout:20000});
    if(!s||s.status()>=400)throw Error("Original HTTP "+s?.status());
    await source.waitForTimeout(1100);
    x=await source.screenshot({path:path.join("qa-artifacts","source-"+c.name+".png")});
   }catch(originError){
    const pinned=path.join(process.env.MD_SOURCE_BASELINE_DIR||"qa-baseline","source-"+c.name+".png");
    if(!fs.existsSync(pinned))throw originError;
    x=fs.readFileSync(pinned);
    fs.writeFileSync(path.join("qa-artifacts","source-"+c.name+".png"),x);
    sourceMode="pinned-genuine-original-GitHub-run-42611400204";
   }
   await clone.goto(base+c.clone,{waitUntil:"domcontentloaded",timeout:20000});
   await clone.waitForTimeout(1100);
   if(await clone.locator('[role="alert"]').count())throw Error("Clone has source-data error");
   const y=await clone.screenshot({path:path.join("qa-artifacts","clone-"+c.name+".png")});
   const m=diff(x,y);
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
   const entry={name:c.name,source:"https://my-doctor.io"+c.source,clone:base+c.clone,status:m.changed_ratio_percent===0?"PARITY":"MISMATCH",changed_ratio_percent:m.changed_ratio_percent,mean_pixel_delta:m.mean_pixel_delta,source_mode:sourceMode};
   report.push(entry);console.log("VISUAL AUDIT",JSON.stringify(entry));
  }catch(e){const entry={name:c.name,status:"UNVERIFIED",reason:String(e.message||e)};report.push(entry);console.error("VISUAL AUDIT",JSON.stringify(entry))}
  finally{await source.close();await clone.close()}
 }}finally{await browser.close();fs.writeFileSync("qa-artifacts/source-parity.json",JSON.stringify({viewport:{width:390,height:844},pages:report,meaning:"Observed initial viewport only. A successful workflow is never proof of pixel or functional parity."},null,2))}
 // Different or inaccessible originals remain failing parity checks, not success.
 if(report.some(x=>x.status!=="PARITY"))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
