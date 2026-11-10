/* 6.50.0 app-layout regression on a REAL 390x844 mobile viewport.
 * Geometry and user interaction only; does not claim pixel equivalence to
 * the native APK or access to authenticated proprietary API responses.
 */
const {chromium}=require("playwright");
const fs=require("fs");
const base=process.env.MD_URL||"http://127.0.0.1:5173";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const checks=[];
 async function check(name,fn){
  try{const detail=await fn();checks.push({name,status:"PASS",detail});console.log("NATIVE APP LAYOUT PASS",name,detail||"");}
  catch(e){checks.push({name,status:"FAIL",error:String(e.message).slice(0,350)});console.error("NATIVE APP LAYOUT FAIL",name,e.message);}
 }
 try{
  await check("app home is a first-class mobile screen, not old website hero",async()=>{
   await page.goto(base+"/",{waitUntil:"domcontentloaded",timeout:25000});
   await page.locator(".native-home").waitFor({timeout:28000});
   if(await page.locator("main [role=alert]").count())throw Error("origin source unavailable");
   if(await page.locator(".md-home-hero").count())throw Error("legacy website marketing hero remains");
   if(await page.locator(".native-home-banner").count()!==1)throw Error("native promo banner missing");
   if(await page.locator(".native-app-service-box").count()!==1)throw Error("native service card missing");
   if(await page.locator(".native-segment [role=tab]").count()!==2)throw Error("segmented app tab missing");
   return await page.locator(".native-home-banner strong").innerText();
  });
  await check("nine observed app telemedicine categories and functional booking tab",async()=>{
   if(await page.locator(".native-symptom-item").count()!==9)throw Error("Expected 9 mobile symptom categories");
   const tab=page.getByRole("tab",{name:"최저가 병원 예약"});
   await tab.tap();
   if(await tab.getAttribute("aria-selected")!=="true")throw Error("booking tab did not activate");
   if(await page.locator(".native-symptom-item").count()!==6)throw Error("booking tab did not change content");
   await page.getByRole("tab",{name:"비대면 진료"}).tap();
   if(await page.locator(".native-symptom-item").count()!==9)throw Error("telemedicine tab not restored");
   return "9 telemedicine + 6 booking shortcuts";
  });
  await check("mobile shell width and fixed bottom navigation",async()=>{
   const layout=await page.evaluate(()=>{
     const site=document.querySelector(".site-app-native"),bar=document.querySelector(".native-app-tabbar");
     const rect=site.getBoundingClientRect(),nav=bar.getBoundingClientRect();
     return {viewport:innerWidth,siteWidth:rect.width,scrollWidth:document.documentElement.scrollWidth,
       bottom:innerHeight-nav.bottom,barItems:bar.querySelectorAll("a,button").length};
   });
   if(layout.viewport!==390||Math.abs(layout.siteWidth-390)>1)throw Error("unexpected mobile content width "+JSON.stringify(layout));
   if(layout.scrollWidth>layout.viewport+1)throw Error("horizontal overflow "+JSON.stringify(layout));
   if(layout.barItems!==5||Math.abs(layout.bottom)>2)throw Error("bottom tab geometry "+JSON.stringify(layout));
   return layout;
  });
  await check("native item tap goes to LOCAL on-demand detail route",async()=>{
   const link=page.locator(".native-symptom-item").first();
   const href=await link.getAttribute("href");
   if(!href?.startsWith("/telemedicine/"))throw Error("wrong first native symptom link: "+href);
   await link.tap();
   await page.waitForURL(url=>decodeURIComponent(url.pathname)===decodeURIComponent(href),{timeout:9000});
   await page.locator("main h1,main [role=alert]").first().waitFor({timeout:30000});
   const error=await page.locator("main [role=alert]").first().textContent().catch(()=>"");
   if(error)throw Error("detail data unavailable (real failure): "+error.slice(0,180));
   if(!await page.locator("main h1").count())throw Error("no actual detail heading");
   return {path:href,heading:await page.locator("main h1").first().innerText()};
  });
  await check("bottom tab opens actual price compare page",async()=>{
   await page.locator(".native-app-tabbar a[href='/medical-cost']").tap();
   await page.waitForURL(url=>url.pathname==="/medical-cost",{timeout:9000});
   await page.locator("main h1,main [role=alert]").first().waitFor({timeout:30000});
   if(await page.locator("main [role=alert]").count())throw Error("price source data missing");
   return await page.locator("main h1").first().innerText();
  });
 }finally{
  fs.mkdirSync("qa-artifacts",{recursive:true});
  fs.writeFileSync("qa-artifacts/native-app-layout.json",JSON.stringify(checks,null,2));
  await browser.close();
 }
 console.log("NATIVE APP LAYOUT SUMMARY",JSON.stringify({total:checks.length,pass:checks.filter(x=>x.status==="PASS").length,fail:checks.filter(x=>x.status==="FAIL").length}));
 if(checks.some(x=>x.status!=="PASS"))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
