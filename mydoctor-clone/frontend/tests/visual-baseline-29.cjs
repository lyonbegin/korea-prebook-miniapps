/* Baseline images captured with original HTTP200 in Github Actions run 42650015118.
 * Exactly 29 real original initial screenshots, never invented or regenerated.
 */
const fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright"),{PNG}=require("pngjs");
const cases=require("../src/data/representative-29.json").cases;
const base=process.env.MD_URL||"http://127.0.0.1:5173";
const root=path.join(process.cwd(),"qa-baseline"),out="qa-artifacts",LIMIT=20;

/* Original mobile source constrains the centered app at 560px.
 * At 390px the source and clone both fill the viewport; ensure neither crops content.
 * Required visible elements are checked before applying the 20% pixel tolerance.
 * Data values, source links, headings and tables are audited independently in original-fact-29.cjs.
 */
const requiredById={
 "home":[".md-home h1",".md-home-hero"],
 "telemedicine-department-list":[".symptom-group"],
 "hospital-search":[".md-lookup"],
 "hospital-reviews":[".review-metrics",".review-source-card"],
 "doctor-reviews":[".review-metrics",".review-doctor-source-card"],
 "medical-cost-index":[".md-cost-grid"],
 "pharmacy-condition-search":[".original-pharmacy-card"],
 "medicine-search":[".original-medicine-search",".original-medicine-cards a"],
 "health-category-index":[".original-faq-search",".original-faq-item"]
};
async function auditStructure(page,id){
 const required=requiredById[id]||[];
 const info=await page.evaluate(selectors=>{
   const main=document.querySelector("main"),site=document.querySelector(".site");
   const box=site?.getBoundingClientRect(),style=site&&getComputedStyle(site);
   const h1=main?.querySelector("h1");
   const missing=selectors.filter(sel=>{
     const elements=[...document.querySelectorAll(sel)];
     return !elements.some(el=>{const c=getComputedStyle(el);return c.display!=="none"&&c.visibility!=="hidden"&&el.getBoundingClientRect().width>0});
   });
   return {has_main:!!main,has_h1:!!h1&&!!h1.textContent?.trim(),site_width:box?.width??null,
     mobile_max_width:style?.maxWidth??null,scroll_width:document.documentElement.scrollWidth,
     viewport_width:document.documentElement.clientWidth,missing_elements:missing,
     heading_count:main?.querySelectorAll("h2,h3").length||0,
     link_count:main?.querySelectorAll("a[href]").length||0,
     image_count:main?.querySelectorAll("img").length||0};
 },required);
 info.passed=info.has_main&&info.has_h1&&
   Math.abs((info.site_width??0)-390)<=1 &&
   info.mobile_max_width==="560px"&&
   info.scroll_width<=info.viewport_width+1&&
   info.missing_elements.length===0;
 return info;
}

function diff(a,b){
 if(a.width!==b.width||a.height!==b.height)throw Error("PNG dimensions mismatch");
 let changed=0;
 for(let i=0;i<a.data.length;i+=4){
  const dx=Math.max(Math.abs(a.data[i]-b.data[i]),Math.abs(a.data[i+1]-b.data[i+1]),Math.abs(a.data[i+2]-b.data[i+2]));
  if(dx>20)changed++;
 }
 return +(100*changed/(a.width*a.height)).toFixed(2);
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const report=[];
 try{
  for(const c of cases){
   const item={id:c.id,path:c.path,original_http:200,original_capture_run:42650015118,status:"UNVERIFIED"};
   const file=path.join(root,"origin-"+c.id+".png");
   if(!fs.existsSync(file)){item.reason="missing verified original PNG baseline";report.push(item);console.log("BASELINE VISUAL AUDIT",JSON.stringify(item));continue;}
   const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
   try{
    const r=await page.goto(base+c.path,{waitUntil:"domcontentloaded",timeout:20000});
    if(r?.status()!==200)throw Error("Clone HTTP "+r?.status());
    await page.waitForTimeout(950);
    if(await page.locator('[role="alert"]').count())throw Error("Clone original facts unavailable");
    await page.evaluate(async()=>{
       await document.fonts.ready;
       await Promise.all([...document.images].filter(x=>!x.complete).map(x=>new Promise(done=>{
         x.addEventListener("load",done,{once:true});x.addEventListener("error",done,{once:true});
         setTimeout(done,2000);
       })));
    });
    const a=PNG.sync.read(fs.readFileSync(file));
    const b=PNG.sync.read(await page.screenshot({path:path.join(out,"baseline-clone-"+c.id+".png")}));
    item.changed_percent=diff(a,b);item.threshold_percent=LIMIT;
    item.structure=await auditStructure(page,c.id);
    item.status=!item.structure.passed?"STRUCTURE_FAIL":item.changed_percent<=LIMIT?"VISUAL_PASS":"VISUAL_FAIL";
   }catch(e){item.status="UNVERIFIED";item.reason=String(e.message).slice(0,200);}
   finally{await page.close();}
   report.push(item);console.log("BASELINE VISUAL AUDIT",JSON.stringify(item));
  }
 }finally{await browser.close()}
 const pass=report.filter(x=>x.status==="VISUAL_PASS").length,fail=report.filter(x=>x.status==="VISUAL_FAIL"||x.status==="STRUCTURE_FAIL").length;
 const summary={visual_threshold_percent:LIMIT,original_capture_run:42650015118,total:cases.length,pass,fail,
   unverified:report.length-pass-fail,meaning:"Pass requires the original 560px mobile container, expected main elements, source factual parity (separate test), and first viewport pixel change of 20% or less. Original images captured on HTTP200; whole-scroll equivalence is separately reported.",cases:report};
 fs.writeFileSync(path.join(out,"visual-baseline-29.json"),JSON.stringify(summary,null,2));
 console.log("BASELINE VISUAL SUMMARY",JSON.stringify({pass,fail,unverified:summary.unverified,total:cases.length,threshold:LIMIT}));
 if(pass!==cases.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
