/* Screenshot the DEPLOYED clone with the same 390x844 viewport as normalized
 * original Android emulator reference. Not an original screenshot substitute. */
const {chromium}=require("../frontend/node_modules/playwright");
const fs=require("fs"),path=require("path");
const out=path.join(__dirname,"artifacts");
const BASE="https://mydoctor-mobile-web-production.up.railway.app";
const routes={
 home:"/", "medical-cost":"/medical-cost",
 telemedicine:"/telemedicine/all-department",hospital:"/hospital",
 mounjaro:"/medical-cost/%EB%A7%88%EC%9A%B4%EC%9E%90%EB%A1%9C",
 "dept-tuberculosis":"/dept-hub/%EA%B2%B0%ED%95%B5%EA%B3%BC"
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
    if(label==="dept-tuberculosis"){
      // Genuine deployed web DOM through the complete vertical extent.
      // Keep a panorama and reproducible 390x844 scroll-position frames.
      await page.screenshot({path:path.join(out,"web_"+label+"_full.png"),fullPage:true});
      const geometry=await page.evaluate(()=>({
        pageWidth:document.documentElement.scrollWidth,
        pageHeight:Math.max(document.body.scrollHeight,document.documentElement.scrollHeight),
        viewportHeight:innerHeight
      }));
      const locations=[];
      for(let y=0,i=0;i<40;i++,y+=680){
        const target=Math.min(y,Math.max(0,geometry.pageHeight-geometry.viewportHeight));
        await page.evaluate(v=>window.scrollTo({top:v,behavior:"instant"}),target);
        await page.waitForTimeout(220);
        const actual=await page.evaluate(()=>window.scrollY);
        const filename="web_"+label+"_scroll_"+String(i).padStart(2,"0")+".png";
        await page.screenshot({path:path.join(out,filename),fullPage:false});
        locations.push({index:i,requestedY:target,actualY:actual,filename});
        if(actual>=geometry.pageHeight-geometry.viewportHeight-2)break;
      }
      fs.writeFileSync(path.join(out,"web_dept_tuberculosis_scroll_manifest.json"),
        JSON.stringify({route,geometry,locations},null,2));
      console.log("VERIFIED_DEPLOYED_WEB_DEPT_SCROLL",JSON.stringify({height:geometry.pageHeight,frames:locations.length}));
    }
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
