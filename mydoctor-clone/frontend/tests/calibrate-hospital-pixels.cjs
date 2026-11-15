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
 font:'"Pretendard Variable",Pretendard,"Noto Sans KR","Apple SD Gothic Neo",Arial,sans-serif',h1Size:25,h1Weight:700,h1Track:-.8,
 pSize:16.5,pTrack:.5,pLine:25,pWeight:400,pFont:'inherit',
 rowSize:15,rowTrack:0,rowGap:15,rowHeight:35,rowMargin:0,rowWeight:400,rowFont:'inherit',
 headingSize:20,formFont:14,crumbFont:11,formTrack:0
};
const candidates={
 font:['"Pretendard Variable",Pretendard,"Noto Sans KR","Apple SD Gothic Neo",Arial,sans-serif','Arial, sans-serif','Noto Sans KR, sans-serif','Apple SD Gothic Neo, sans-serif','Pretendard, sans-serif'],
 h1Track:[-1,-.8,-.6,-.4,-.2,0],
 headingSize:[19,19.5,20,20.5,21],
 formFont:[14,14.5,15,15.5,16],
 crumbFont:[11,11.5,12,12.5,13],
 h1Size:[24,24.5,25,25.5,26],
 h1Weight:[700,750,780,800],
 pSize:[16.25,16.35,16.45,16.5,16.55,16.65,16.75],
 pTrack:[.3,.4,.45,.5,.55,.6,.65,.7],
 pLine:[24,25,26],
 pWeight:[400,450,500],
 rowSize:[14.75,14.85,14.95,15,15.05,15.15,15.25],
 rowTrack:[-.2,-.15,-.1,-.05,0,.05,.1,.15,.2],
 rowGap:[14,14.25,14.5,14.75,15,15.25,15.5,15.75,16],
 rowHeight:[34,35,36,37],
 rowMargin:[-3,0,2,3,4,5,7],
 rowWeight:[350,375,400,425,450,475,500],
 rowFont:['inherit','Arial, sans-serif','Noto Sans KR, sans-serif','Pretendard, sans-serif'],
 pFont:['inherit','Arial, sans-serif','Noto Sans KR, sans-serif','Pretendard, sans-serif'],
 formTrack:[-.3,-.2,-.1,0,.1,.2,.3]
};
function css(x){
 return ".ow-hospital-page{font-family:"+x.font+"!important}"+
 ".ow-hospital-intro h1{font-size:"+x.h1Size+"px!important;font-weight:"+x.h1Weight+"!important;letter-spacing:"+x.h1Track+"px!important}"+
 ".ow-hospital-departments h2{font-size:"+x.headingSize+"px!important}"+
 ".ow-hospital-select select{font-size:"+x.formFont+"px!important;letter-spacing:"+x.formTrack+"px!important}"+
 ".ow-hospital-breadcrumb,.ow-hospital-breadcrumb button,.ow-hospital-breadcrumb strong{font-size:"+x.crumbFont+"px!important}"+
 ".ow-hospital-intro p{font-size:"+x.pSize+"px!important;letter-spacing:"+x.pTrack+"px!important;line-height:"+x.pLine+"px!important;font-weight:"+x.pWeight+"!important;word-break:normal!important;font-family:"+x.pFont+"!important}"+
 ".ow-hospital-link-row button{font-size:"+x.rowSize+"px!important;letter-spacing:"+x.rowTrack+"px!important;font-weight:"+x.rowWeight+"!important;font-family:"+x.rowFont+"!important}"+
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
  for(let iteration=0;iteration<3;iteration++){
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
