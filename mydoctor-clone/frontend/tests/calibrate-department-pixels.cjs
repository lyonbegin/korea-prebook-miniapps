/* Original public website 390×844 screenshot → actual built GitHub Pages
 * CSS parameter calibration. Never accept ungrounded original reference.
 * Source screenshot downloaded from run 42650015118, source-hospital-by-department.png
 */
const {chromium}=require("playwright");
const {PNG}=require("pngjs");
const fs=require("fs"),path=require("path");
const SRC=path.join(__dirname,"../qa-original/origin-hospital-by-department.png");
const SITE=process.env.PAGES_TEST_URL||"http://127.0.0.1:4173/korea-prebook-miniapps/";
const OUT=path.resolve(__dirname,"../department-pixel-calibration");
fs.mkdirSync(OUT,{recursive:true});
if(!fs.existsSync(SRC))throw Error("ORIGINAL_BROWSER_REFERENCE_MISSING");
const origin=PNG.sync.read(fs.readFileSync(SRC));
if(origin.width!==390||origin.height!==844)throw Error("Original screenshot is not 390x844");
let tests=0;
function compare(png){
 const p=PNG.sync.read(png);
 if(p.width!==origin.width||p.height!==origin.height)throw Error("Different viewport");
 let mismatch=0,sum=0;
 for(let i=0;i<p.data.length;i+=4){
  const a=Math.abs(origin.data[i]-p.data[i]);
  const b=Math.abs(origin.data[i+1]-p.data[i+1]);
  const c=Math.abs(origin.data[i+2]-p.data[i+2]);
  if(Math.max(a,b,c)>25)mismatch++;
  sum+=(a+b+c)/3;
 }
 return {pct:+(100*mismatch/(390*844)).toFixed(3),mae:+(sum/(390*844)).toFixed(3)};
}
const params={
  headerFont:24,heroFont:16.5,heroTracking:.25,
  regionTop:12,regionHeadingFont:20,regionHeadingMargin:12,
  regionTitlePad:5,regionOptionFont:14,regionOptionPad:2,
  regionOptionLine:22,regionGap:11,regionBlockBottom:8,
  regionTitleWeight:400,regionLinkTracking:0,
  heroWeight:350,
  heroFamily:"inherit",heroLineHeight:25,
  regionFamily:"inherit",regionOptionWeight:400,
  regionTitleFont:14,regionTitleTracking:0,
  nearFont:14,nearWeight:400,
  heroPaddingTop:22,
};
const choices={
  heroFont:[15,15.25,15.5,15.75,16,16.25,16.5,16.75,17],
  heroFamily:["inherit","Arial,sans-serif","system-ui,sans-serif","Noto Sans KR,sans-serif","Pretendard,sans-serif"],
  heroLineHeight:[23,24,25,26,27],
  heroPaddingTop:[19,20,21,22,23,24],
  heroTracking:[-.3,-.1,0,.1,.2,.25,.35,.45,.55,.65],
  heroWeight:[350,375,400,425,450],
  headerFont:[23.5,24,24.5,25],
  regionTop:[6,8,10,12,14,16,18],
  regionHeadingFont:[19,19.5,20,20.5,21],
  regionHeadingMargin:[5,8,10,12,14,16],
  regionTitlePad:[2,3,4,5,6,8],
  regionOptionFont:[12,12.25,12.5,12.75,13,13.25,13.5,13.75,14,14.25,14.5,14.75,15,15.5,16],
  regionFamily:["inherit","Arial,sans-serif","system-ui,sans-serif","Noto Sans KR,sans-serif","Pretendard,sans-serif"],
  regionOptionWeight:[300,350,375,400,425,450,475,500,550],
  regionTitleFont:[13,13.5,14,14.5,15,15.5],
  regionTitleTracking:[-.5,-.25,0,.2,.4],
  nearFont:[13,13.5,14,14.5,15],
  nearWeight:[350,400,450,500,600],
  regionOptionPad:[0,1,2,3,4,5],
  regionOptionLine:[18,19,20,21,22,23,24,25],
  regionGap:[6,8,10,11,13,15,17],
  regionBlockBottom:[3,5,7,8,10,12,14],
  regionTitleWeight:[400,450,500,550,600],
  regionLinkTracking:[-.4,-.25,-.1,0,.1,.25,.4,.6,.8],
};
function css(p){
 return [
  ".original-dept-hero h1{font-size:"+p.headerFont+"px!important}",
  ".original-dept-hero{padding-top:"+p.heroPaddingTop+"px!important}",
  ".original-dept-hero p{font-size:"+p.heroFont+"px!important;letter-spacing:"+p.heroTracking+"px!important;font-weight:"+p.heroWeight+"!important;line-height:"+p.heroLineHeight+"px!important;font-family:"+p.heroFamily+"!important}",
  ".original-dept-regional{padding-top:"+p.regionTop+"px!important}",
  ".original-dept-regional h2{font-size:"+p.regionHeadingFont+"px!important;margin-bottom:"+p.regionHeadingMargin+"px!important}",
  ".original-dept-main-region{padding-top:"+p.regionTitlePad+"px!important;padding-bottom:"+p.regionTitlePad+"px!important;font-weight:"+p.regionTitleWeight+"!important;font-size:"+p.regionTitleFont+"px!important;letter-spacing:"+p.regionTitleTracking+"px!important}",
  ".original-dept-region-options{column-gap:"+p.regionGap+"px!important}",
  ".original-dept-region-options button{font-size:"+p.regionOptionFont+"px!important;padding-top:"+p.regionOptionPad+"px!important;padding-bottom:"+p.regionOptionPad+"px!important;line-height:"+p.regionOptionLine+"px!important;letter-spacing:"+p.regionLinkTracking+"px!important;font-weight:"+p.regionOptionWeight+"!important;font-family:"+p.regionFamily+"!important}",
  ".original-dept-near button{font-size:"+p.nearFont+"px!important;font-weight:"+p.nearWeight+"!important}",
  ".original-dept-region{padding-bottom:"+p.regionBlockBottom+"px!important}"
 ].join("\n");
}
(async()=>{
 const b=await chromium.launch({headless:true});
 const page=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:"ko-KR",timezoneId:"Asia/Seoul",reducedMotion:"reduce"});
 const history=[];
 try{
  const res=await page.goto(SITE+"?screen=detail&target="+encodeURIComponent("/dept-hub/내과"),{waitUntil:"networkidle",timeout:30000});
  if(res?.status()!==200)throw Error("Clone HTTP "+res?.status());
  await page.locator("[data-testid='original-department-landing']").waitFor({timeout:12000});
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>{const style=document.createElement("style");style.id="dept-calibration";document.head.appendChild(style)});
  async function measure(p){
    await page.evaluate(code=>{document.getElementById("dept-calibration").textContent=code},css(p));
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    tests++;
    const png=await page.screenshot({fullPage:false});
    return {...compare(png),png};
  }
  let state={...params},initial=await measure(state),best=initial;
  fs.writeFileSync(path.join(OUT,"before.png"),initial.png);
  for(let pass=0;pass<2;pass++){
   for(const [name,options] of Object.entries(choices)){
    let optimum={value:state[name],result:best};
    for(const value of options){
     if(value===state[name])continue;
     const trial=await measure({...state,[name]:value});
     if(trial.pct<optimum.result.pct||
       (trial.pct===optimum.result.pct&&trial.mae<optimum.result.mae))
      optimum={value,result:trial};
    }
    if(optimum.value!==state[name]){
      state[name]=optimum.value;best=optimum.result;
      const step={pass,name,value:optimum.value,mismatch:best.pct,mae:best.mae};
      history.push(step);console.log("DEPARTMENT_PIXEL_IMPROVED",JSON.stringify(step));
    }
   }
  }
  const verified=await measure(state);
  fs.writeFileSync(path.join(OUT,"best.png"),verified.png);
  const result={reference:"2026-11-09 original public website HTTP200 capture in Actions run 42650015118",
   viewport:[390,844],initialMismatch:initial.pct,bestMismatch:verified.pct,
   initialMAE:initial.mae,bestMAE:verified.mae,tests,pass:verified.pct<=10,
   params:state,css:css(state),steps:history};
  fs.writeFileSync(path.join(OUT,"calibration.json"),JSON.stringify(result,null,2));
  console.log("DEPARTMENT_PIXEL_CALIBRATION_RESULT",JSON.stringify(result));
 }finally{await b.close()}
})().catch(e=>{console.error("DEPARTMENT_PIXEL_CALIBRATION_ERROR",e);process.exit(1)});
