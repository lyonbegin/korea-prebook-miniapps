/* Screenshot the DEPLOYED clone with the same 390x844 viewport as normalized
 * original Android emulator reference. Not an original screenshot substitute. */
const {chromium}=require("../frontend/node_modules/playwright");
const fs=require("fs"),path=require("path");
const out=path.join(__dirname,"artifacts");
const BASE="https://mydoctor-mobile-web-production.up.railway.app";
const routes={
 home:"/", "medical-cost":"/medical-cost",
 telemedicine:"/telemedicine/all-department",hospital:"/hospital",
 mounjaro:"/medical-cost/%EB%A7%88%EC%9A%B4%EC%9E%90%EB%A1%9C"
};
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const context=await browser.newContext({
  viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,
  hasTouch:true,locale:"ko-KR",timezoneId:"Asia/Seoul",
  reducedMotion:"reduce"
 });
 const result={browser:"Playwright Chromium",emulatedViewport:"390x844",
  origin:BASE,records:[]};
 for(const [label,route] of Object.entries(routes)){
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",e=>errors.push(String(e.message).slice(0,300)));
  try{
    const response=await page.goto(BASE+route,{waitUntil:"domcontentloaded",timeout:23000});
    await page.waitForTimeout(1800);
    const el=label==="home"?".native-home":
      label==="medical-cost"||label==="mounjaro"?".native-price-regions":
      label==="hospital"?"main":".native-doctor-directory";
    await page.locator(el).first().waitFor({timeout:10000}).catch(()=>{});
    await page.screenshot({path:path.join(out,"web_"+label+".png"),fullPage:false});
    const visible=await page.locator("main").innerText().catch(()=>"");
    result.records.push({label,route,http:response?.status()||null,
      title:await page.title(),mainText:visible.slice(0,450),
      jsErrors:errors,
      screenshot:"web_"+label+".png"});
    console.log("WEB_CAPTURE",label,result.records.at(-1).http,
      visible.slice(0,80).replace(/\s+/g," "));
  }catch(error){
    result.records.push({label,route,error:String(error.message).slice(0,400),jsErrors:errors});
    console.log("WEB_CAPTURE_FAILED",label,error.message);
  }finally{await page.close()}
 }
 fs.writeFileSync(path.join(out,"web_capture.json"),JSON.stringify(result,null,2));
 await browser.close();
 if(!fs.existsSync(path.join(out,"web_home.png")))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
