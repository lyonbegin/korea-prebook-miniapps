const {chromium}=require("playwright"),{PNG}=require("pngjs"),fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,".."),original=PNG.sync.read(fs.readFileSync(path.join(root,"qa-original","origin-medical-cost-category.png")));
const rootURL=process.env.PAGES_TEST_URL||"http://127.0.0.1:4173/korea-prebook-miniapps/";
const dir=path.join(root,"mounjaro-calibration");fs.mkdirSync(dir,{recursive:true});
const params={titleFont:24.2,titleWeight:790,titleTracking:-.3,summaryFont:16.55,summaryWeight:760,summaryTracking:-.2,selectFont:16,selectWeight:750,categoryPad:56,resultsFont:19.5,heroTop:20,summaryLineHeight:26,lookupPad:19,resultsPad:32};
const choices={
 titleFont:[23,23.5,24,24.5,25,25.5],
 titleWeight:[650,700,740,760,780,800],
 titleTracking:[-.5,-.3,-.1,0,.15],
 summaryFont:[15.5,16,16.3,16.55,16.8,17],
 summaryWeight:[600,650,700,740,760,780],
 summaryTracking:[-.35,-.2,-.1,0,.15],
 selectFont:[14.5,15,15.5,16,16.5],
 selectWeight:[650,700,750,800],
 categoryPad:[34,40,46,50,56,62],
 resultsFont:[18,18.5,19,19.5,20],
 heroTop:[19,20,21],
 summaryLineHeight:[25,26,27],
 lookupPad:[18,19,20],
 resultsPad:[29,30,31,32,33]
};
function css(p){
const pairs=[
 [".ow-mounjaro-intro h1",{fontSize:p.titleFont+"px",fontWeight:p.titleWeight,letterSpacing:p.titleTracking+"px"}],
 [".ow-mounjaro-intro p",{fontSize:p.summaryFont+"px",fontWeight:p.summaryWeight,letterSpacing:p.summaryTracking+"px",lineHeight:p.summaryLineHeight+"px"}],
 [".ow-mounjaro-field select",{fontSize:p.selectFont+"px",fontWeight:p.selectWeight}],
 [".ow-mounjaro-two .ow-mounjaro-field select",{paddingRight:p.categoryPad+"px"}],
 [".ow-mounjaro-results h2",{fontSize:p.resultsFont+"px"}],
 [".ow-mounjaro-intro",{paddingTop:p.heroTop+"px"}],
 [".ow-mounjaro-lookup",{paddingTop:p.lookupPad+"px"}],
 [".ow-mounjaro-results",{paddingTop:p.resultsPad+"px"}]];
return pairs.map(([selector,styles])=>selector+"{"+Object.entries(styles).map(([key,val])=>key.replace(/[A-Z]/g,c=>"-"+c.toLowerCase())+":"+val+"!important").join(";")+"}").join("\n");
}
function metric(png){
const im=PNG.sync.read(png);let changed=0,mae=0;
for(let i=0;i<original.data.length;i+=4){
 const d0=Math.abs(original.data[i]-im.data[i]),d1=Math.abs(original.data[i+1]-im.data[i+1]),d2=Math.abs(original.data[i+2]-im.data[i+2]);
 if(Math.max(d0,d1,d2)>25)changed++;mae+=(d0+d1+d2)/3;
}return {pct:+(changed/(390*844)*100).toFixed(4),mae:+(mae/(390*844)).toFixed(4)};
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:"ko-KR",timezoneId:"Asia/Seoul",reducedMotion:"reduce"});
 let measured=0,history=[];
 try{
 await page.goto(rootURL+"?screen=detail&target="+encodeURIComponent("/medical-cost/마운자로"),{waitUntil:"networkidle",timeout:40000});
 await page.getByTestId("website-parity-medical-cost-category").waitFor({timeout:15000});
 await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(()=>{const s=document.createElement("style");s.id="opt-css";document.head.append(s)});
 async function check(p){
  await page.evaluate(t=>document.querySelector("#opt-css").textContent=t,css(p));
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  measured++;const screenshot=await page.screenshot({fullPage:false});return {...metric(screenshot),screenshot};
 }
 let current={...params},best=await check(current),initial={pct:best.pct,mae:best.mae};
 fs.writeFileSync(path.join(dir,"before.png"),best.screenshot);
 for(let pass=0;pass<2;pass++){
  for(const [key,options] of Object.entries(choices)){
   let optimum={value:current[key],result:best};
   for(const value of options){
    if(value===current[key])continue;
    const trial=await check({...current,[key]:value});
    if(trial.pct<optimum.result.pct||(trial.pct===optimum.result.pct&&trial.mae<optimum.result.mae))
      optimum={value,result:trial};
   }
   if(optimum.value!==current[key]){
    current[key]=optimum.value;best=optimum.result;
    history.push({pass,key,value:optimum.value,pct:best.pct,mae:best.mae});
    console.log("MOUNJARO_PIXEL_IMPROVED",JSON.stringify(history[history.length-1]));
   }
  }
 }
 const verified=await check(current);
 fs.writeFileSync(path.join(dir,"best.png"),verified.screenshot);
 const result={initial,best:{pct:verified.pct,mae:verified.mae},params:current,css:css(current),history,measured,
 source:"2026-11-09 HTTP200 original public website",viewport:[390,844],accepted:verified.pct<=10};
 fs.writeFileSync(path.join(dir,"calibration.json"),JSON.stringify(result,null,2));
 console.log("MOUNJARO_PIXEL_CALIBRATION_RESULT",JSON.stringify(result));
 }finally{await browser.close()}
})().catch(e=>{console.error("MOUNJARO_PIXEL_CALIBRATION_ERROR",e);process.exit(1)});
