/* Real original Android 6.50.0 API-backed mobile user-gesture QA at 390x844.
 * No old nine-shortcut mock acceptance, no fake backend results, no pixel-parity claims.
 */
const {chromium}=require("playwright");
const fs=require("fs");
const base=process.env.MD_URL||"http://127.0.0.1:5173";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 page.setDefaultTimeout(7000);
 page.setDefaultNavigationTimeout(14000);
 const browserErrors=[];
 page.on("pageerror",e=>browserErrors.push("pageerror "+e.message.slice(0,500)));
 page.on("console",msg=>{if(msg.type()==="error")browserErrors.push("console "+msg.text().slice(0,500))});
 const checks=[];
 async function check(name,fn){
  try{
   const detail=await fn();
   checks.push({name,status:"PASS",detail});
   console.log("NATIVE 650 PASS",name,detail??"");
  }catch(error){
   const detail=String(error.message).slice(0,950);
   const path="qa-artifacts/native-fail-"+checks.length+".png";
   try{
     fs.mkdirSync("qa-artifacts",{recursive:true});
     await page.screenshot({path,fullPage:true,timeout:5000});
   }catch(_){}
   const snapshot=await page.evaluate(()=>({
      location:location.pathname,
      pageWidth:document.documentElement.scrollWidth,
      bodyText:document.querySelector("main")?.innerText?.slice(0,700)||"",
      topElementTag:document.elementFromPoint(innerWidth/2,innerHeight/2)?.outerHTML?.slice(0,450)||""
     })).catch(()=>({location:"script failed"}));
   checks.push({name,status:"FAIL",error:detail,screenshot:path,snapshot,
      browserErrors:browserErrors.slice(-7)});
   console.error("NATIVE 650 FAIL",name,detail,JSON.stringify(snapshot),
     "JS_ERRORS",JSON.stringify(browserErrors.slice(-7)));
  }
 }
 try{
  await check("home shows observed 20 source menus and original app banners",async()=>{
   await page.goto(base+"/",{waitUntil:"domcontentloaded",timeout:25000});
   await page.locator(".native-home").waitFor({timeout:12000});
   await page.locator('[data-native-menu-count="20"]').waitFor({timeout:18000});
   await page.locator(".native-image-banner img").first().waitFor({timeout:18000});
   const menu=await page.locator(".native-symptom-item").count();
   const banners=await page.locator(".native-image-banner").count();
   if(menu!==20)throw Error("Original app source menu count wrong: "+menu);
   if(banners!==8)throw Error("Original native banner count wrong: "+banners);
   return {menus:menu,banners};
  });
  await check("original Hermes HomeNavigationConfig renders three source cards and live touch",async()=>{
   await page.locator('[data-original-nav-count="3"]').waitFor({timeout:20000});
   const cards=page.locator(".hermes-home-navigation .hermes-home-nav-card");
   if(await cards.count()!==3)throw Error("actual home config must have fixed hospital + 2 source entries");
   const labels=await cards.allTextContents();
   if(!labels[1].includes("다이어트")||!labels[2].includes("수액"))
     throw Error("native config title mismatch "+JSON.stringify(labels));
   const imgs=page.locator(".hermes-config-nav-card img");
   if(await imgs.count()!==2)throw Error("source navigation must render 2 original source images");
   await cards.nth(1).tap();
   await page.locator(".native-data-dialog").waitFor({timeout:4000});
   const link=page.locator('.hermes-native-open-link[href^="merakiyourdoctor://navigate?screen=WegovyRecordBridgeScreen"]');
   if(await link.count()!==1)throw Error("original source deep link unavailable");
   await page.getByRole("button",{name:"닫기"}).tap();
   return {sourceCards:3,sourceImages:2,labels:labels.map(x=>x.trim())};
  });
  await check("mobile tap toggles native app telemedicine and booking",async()=>{
   const booking=page.getByRole("tab",{name:"최저가 병원 예약"});
   await booking.tap();
   if(await booking.getAttribute("aria-selected")!=="true")throw Error("booking tab not selected");
   if(await page.locator(".native-symptom-item").count()!==6)throw Error("expected 6 observed booking shortcuts");
   await page.getByRole("tab",{name:"비대면 진료"}).tap();
   await page.locator('[data-native-menu-count="20"]').waitFor({timeout:9000});
   return "real 20 native menu items restored";
  });
  await check("390x844 layout and fixed bottom bar are valid",async()=>{
   const layout=await page.evaluate(()=>{
     const site=document.querySelector(".site-app-native");
     const bar=document.querySelector(".native-app-tabbar").getBoundingClientRect();
     return {width:innerWidth,content:site.getBoundingClientRect().width,
       overflow:document.documentElement.scrollWidth-innerWidth,
       bottom:innerHeight-bar.bottom,navItems:document.querySelectorAll(".native-app-tabbar a,.native-app-tabbar button").length};
   });
   if(layout.width!==390||Math.abs(layout.content-390)>1||layout.overflow>1||
      Math.abs(layout.bottom)>3||layout.navItems!==5)
      throw Error("phone geometry mismatch: "+JSON.stringify(layout));
   return layout;
  });
  await check("real source MyD link on home responds to physical tap",async()=>{
   const link=page.locator('.native-symptom-item[href^="/native/myd-link/"]').first();
   await link.waitFor({timeout:10000});
   const href=await link.getAttribute("href");
   await link.tap();
   await page.waitForURL(url=>decodeURIComponent(url.pathname)===decodeURIComponent(href),{timeout:12000});
   await page.locator(".native-link-screen").waitFor({timeout:10000});
   await page.locator(".native-link-facts,.native-link-error").first().waitFor({timeout:16000});
   if(await page.locator(".native-link-error").count())
     throw Error("original MyD link returned error after tap");
   return {link:href,fields:await page.locator(".native-link-facts>div").count()};
  });
  await check("APK-proven acne MyD link opens live doctor-list touch action",async()=>{
   await page.goto(base+"/native/myd-link/symptom-acneOralMedication",{waitUntil:"domcontentloaded"});
   await page.locator(".native-link-facts").waitFor({timeout:16000});
   const action=page.getByRole("button",{name:/원본 의사 목록 보기|의료진 목록 닫기/});
   await action.waitFor({timeout:10000});
   if(await action.getAttribute("aria-expanded")!=="true")await action.tap();
   await page.locator('[data-native-resource="doctor-list"]').waitFor({timeout:10000});
   await page.locator('[data-native-resource="doctor-list"][data-native-state="loaded"],[data-native-resource="doctor-list"][data-native-state="unavailable"]')
      .first().waitFor({timeout:16000});
   if(await page.locator('[data-native-resource="doctor-list"][data-native-state="unavailable"]').count())
    throw Error("original doctor list API not available on MyD linked screen");
   const buttons=await page.locator('[data-native-resource="doctor-list"] .native-api-row').count();
   if(!buttons)throw Error("source doctor rows not displayed");
   return {doctorRows:buttons};
  });
  await check("original medical cost categories return actual 16 regions",async()=>{
   await page.locator('.native-app-tabbar a[href="/medical-cost"]').tap();
   await page.waitForURL(u=>u.pathname==="/medical-cost",{timeout:9000});
   await page.locator('.native-price-regions [data-real-region-count="16"]').waitFor({timeout:18000});
   const categories=await page.locator('.native-price-categories button').count();
   if(categories!==4)throw Error("source price category count: "+categories);
   const row=page.locator(".native-region-price-row").first();
   await row.tap();
   await page.locator('.native-data-dialog').waitFor({timeout:5000});
   await page.getByRole("button",{name:"닫기"}).tap();
   return {categories,regionRows:await page.locator('.native-region-price-row').count()};
  });
  await check("pharmacy screen is a separate native mobile page",async()=>{
   await page.goto(base+"/pharmacy",{waitUntil:"domcontentloaded"});
   await page.locator(".native-pharmacy-page").waitFor({timeout:10000});
   await page.locator('[data-native-resource="pharmacy-list"]').waitFor({timeout:10000});
   return "Original pharmacist list is requested from a distinct screen; source success evaluated separately";
  });
  await check("native FAQ accordion screen opens on its route",async()=>{
   await page.goto(base+"/healthLab/FAQ",{waitUntil:"domcontentloaded"});
   await page.locator(".native-faq-page").waitFor({timeout:10000});
   await page.locator(".native-faq-item").first().waitFor({timeout:16000});
   const n=await page.locator(".native-faq-item").count();
   if(n<1)throw Error("FAQ source API 200 but no real FAQ rows displayed");
   await page.locator(".native-faq-item button").first().tap();
   if(await page.locator('.native-faq-item button[aria-expanded="true"]').count()!==1)
    throw Error("FAQ accordion did not respond to actual tap");
   return {actualFaqRows:n,sourceIsPublic:true};
  });
 }finally{
  fs.mkdirSync("qa-artifacts",{recursive:true});
  fs.writeFileSync("qa-artifacts/native-app-layout.json",JSON.stringify({
    viewport:{width:390,height:844},checks,globalJsErrors:browserErrors
  },null,2));
  await browser.close();
 }
 const pass=checks.filter(x=>x.status==="PASS").length;
 console.log("NATIVE 650 GESTURE QA",JSON.stringify({total:checks.length,pass,fail:checks.length-pass}));
 if(pass!==checks.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
