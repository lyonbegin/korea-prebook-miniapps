/* Source-image-based 390x844 pixel calibration; never invent reference screenshots. */
const {chromium}=require("playwright");
const {PNG}=require("pngjs");
const fs=require("fs"),path=require("path");
const origin=PNG.sync.read(fs.readFileSync(path.join(__dirname,"../qa-original/source-hospital-search.png")));
if(origin.width!==390||origin.height!==844)throw Error("Original image must be 390x844");
const SITE=process.env.PAGES_TEST_URL||"http://127.0.0.1:4173/korea-prebook-miniapps/";
const DIR=path.join(__dirname,"../website-pixel-calibration");
fs.mkdirSync(DIR,{recursive:true});
const configs={
 h1Size:25,h1Weight:780,
 pSize:16,pTrack:.35,pLine:25,pWeight:400,
 rowSize:15,rowTrack:0,rowGap:15,rowHeight:36,rowMargin:3,rowWeight:500
};
const candidates={
 h1Size:[24,24.5,25,25.5,26],
 h1Weight:[700,750,780,800],
 pSize:[15.5,15.75,16,16.25,16.5],
 pTrack:[0,.1,.2,.3,.35,.4,.5],
 pLine:[24,25,26],
 pWeight:[400,450,500],
 rowSize:[14,14.5,14.75,15,15.25,15.5],
 rowTrack:[-.4,-.2,0,.2,.4],
 rowGap:[12,13,14,15,16,17],
 rowHeight:[34,35,36,37],
 rowMargin:[-3,0,2,3,4,5,7],
 rowWeight:[400,500,600]
};
function css(x){
 return ".ow-hospital-intro h1{font-size:"+x.h1Size+"px!important;font-weight:"+x.h1Weight+"!important}"+
 ".ow-hospital-intro p{font-size:"+x.pSize+"px!important;letter-spacing:"+x.pTrack+"px!important;line-height:"+x.pLine+"px!important;font-weight:"+x.pWeight+"!important;word-break:normal!important}"+
 ".ow-hospital-link-row button{font-size:"+x.rowSize+"px!important;letter-spacing:"+x.rowTrack+"px!important;font-weight:"+x.rowWeight+"!important}"+
 ".ow-hospital-link-row{gap:"+x.rowGap+"px!important;height:"+x.rowHeight+"px!important}"+
 ".ow-hospital-departments h2{margin-bottom:"+x.rowMargin+"px!important}";
}
function metric(pngbytes){
 const p=PNG.sync.read(pngbytes);
 let count=0,mae=0;
 for(let i=0;i<origin.data.length;i+=4){
  const d0=Math.abs(origin.data[i]-p.data[i]);
  const d1=Math.abs(origin.data[i+1]-p.data[i+1]);
  const d2=Math.abs(origin.data[i+2]-p.data[i+2]);
  if(Math.max(d0,d1,d2)>25)count++;
  mae+=(d0+d1+d2)/3;
 }
 return {pct:+(count/(390*844)*100).toFixed(3),mae:+(mae/(390*844)).toFixed(3)};
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:"ko-KR",timezoneId:"Asia/Seoul",reducedMotion:"reduce"});
 const steps=[];
 try{
  const http=await page.goto(SITE+"?screen=hospital-list",{waitUntil:"networkidle",timeout:35000});
  if(http?.status()!==200)throw Error("Clone not HTTP 200");
  await page.getByTestId("website-parity-hospital").waitFor();
  await page.evaluate(async()=>await document.fonts.ready);
  await page.evaluate(()=>{
   const e=document.createElement("style");
   e.id="pixel-calibration-style";document.head.appendChild(e);
  });
  async function test(x){
   await page.evaluate(value=>{document.getElementById("pixel-calibration-style").textContent=value},css(x));
   await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
   const png=await page.screenshot({fullPage:false});
   return {...metric(png),png};
  }
  let state={...configs},best=await test(state);
  fs.writeFileSync(path.join(DIR,"starting.png"),best.png);
  for(let iteration=0;iteration<2;iteration++){
   for(const [name,values] of Object.entries(candidates)){
    let winning={value:state[name],result:best};
    for(const value of values){
     if(value===state[name])continue;
     const result=await test({...state,[name]:value});
     if(result.pct<winning.result.pct ||
       (result.pct===winning.result.pct&&result.mae<winning.result.mae)){
       winning={value,result};
     }
    }
    if(winning.value!==state[name]){
      state[name]=winning.value;best=winning.result;
      steps.push({iteration,name,value:winning.value,pct:best.pct});
      console.log("PIXEL_CALIBRATION_IMPROVED",JSON.stringify(steps[steps.length-1]));
    }
   }
  }
  best=await test(state);
  fs.writeFileSync(path.join(DIR,"best.png"),best.png);
  const report={reference:"Original browser HTTP200 captured 2026-11-09, Actions run 42650015118",
   dimensions:[390,844],rgbThreshold:25,thresholdPct:10,
   mismatchPct:best.pct,mae:best.mae,parameters:state,steps,pass:best.pct<=10};
  fs.writeFileSync(path.join(DIR,"calibration-report.json"),JSON.stringify(report,null,2));
  console.log("PIXEL_CALIBRATION_RESULT",JSON.stringify(report));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
