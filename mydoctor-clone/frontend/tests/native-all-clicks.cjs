/* Actual 390x844 mobile-tap audit of all 20 native homepage menus and
 * every displayed price tile in the deployed clone.
 * Success means meaningful destination content after physical tap,
 * not only a URL change. A raw source loading/error/placeholder is failure.
 * No user authentication, fake backend or private datasets.
 */
const {chromium}=require("playwright"),fs=require("fs");
const base=(process.env.MD_URL||"https://mydoctor-mobile-web-production.up.railway.app").replace(/\/$/,"");
const screenshotDir="qa-artifacts";
const report={origin:base,date:new Date().toISOString(),viewport:"390x844",
  homeMenus:[],priceTiles:[],errors:[],summary:null};
const trim=x=>String(x||"").trim();
function segment(path){return decodeURIComponent(path.split("?")[0])}
async function observe(page,kind,label,href,index){
 const max=kind==="home"?4500:3500;
 await page.waitForTimeout(260);
 if(kind==="home"){
   await Promise.race([
    page.locator(".native-link-facts").first().waitFor({timeout:max}).catch(()=>{}),
    page.locator(".native-link-error").first().waitFor({timeout:max}).catch(()=>{})
   ]);
   const facts=await page.locator(".native-link-facts>div").count();
   const err=await page.locator(".native-link-error").count();
   const sheet=await page.locator(".native-data-dialog").count();
   return {index,label,href,url:new URL(page.url()).pathname,
    status:facts>0?"PASS_SOURCE_MYD":err?"FAIL_API_ERROR":sheet?"FAIL_INFO_ONLY":"FAIL_NO_DESTINATION",
    fields:facts,preview:trim(await page.locator("main").innerText()).slice(0,220)};
 }
 if(kind==="price"){
   // The legacy publicly verified fact gateway may need real time to return;
   // an immediate loading placeholder is NOT a meaningful test result.
   await page.locator(".source-route-loading")
      .waitFor({state:"hidden",timeout:10000}).catch(()=>{});
   await Promise.race([
      page.locator(".native-region-price-row,.observed-page,.source-route-error,.native-price-source-status[role=alert]")
       .first().waitFor({timeout:4500}).catch(()=>{}),
      page.waitForTimeout(4500)
   ]);
   const regions=await page.locator(".native-region-price-row").count();
   const error=await page.locator('.source-route-error,.native-price-source-status[role="alert"]').count();
   const facts=await page.locator(".observed-table,main table").count();
   const links=await page.locator('.observed-page .observed-link').count();
   const loading=await page.locator(".source-route-loading").count();
   const entry={index,label,href,url:new URL(page.url()).pathname,
     status:regions?"PASS_NATIVE_REGIONS":error?"FAIL_SOURCE_ERROR":
       loading?"FAIL_STILL_LOADING":
       facts?"PASS_SOURCE_TABLE":links?"PASS_SOURCE_LINKS":"FAIL_NO_DETAIL_DATA",
     regionRows:regions,sourceTables:facts,sourceLinks:links,
     preview:trim(await page.locator("main").innerText()).slice(0,220)};
   if(links&&!regions){
     const detail=page.locator('.observed-page .observed-link').first();
     const detailHref=await detail.getAttribute("href");
     entry.firstResultHref=detailHref;
     try{
       await detail.tap({timeout:3500});
       await page.waitForTimeout(150);
       const current=segment(new URL(page.url()).pathname);
       const expected=segment(new URL(detailHref,base).pathname);
       entry.clickedResultRoute=current;
       if(current!==expected){entry.status="FAIL_RESULT_LINK_NO_NAV";return entry}
       await page.locator(".source-route-loading")
          .waitFor({state:"hidden",timeout:7500}).catch(()=>{});
       const e=await page.locator('.source-route-error,main [role="alert"]').count();
       const loaded=await page.locator('.observed-page,main .clinic-head,main .original-price-detail').count();
       const faq=await page.locator('.native-faq-page .native-faq-item').count();
       entry.resultPageLoaded=Boolean((loaded||faq)&&!e);
       entry.faqRows=faq;
       if(e)entry.status="FAIL_RESULT_DETAIL_API_ERROR";
       else if(!loaded&&!faq)entry.status="FAIL_RESULT_DETAIL_UNAVAILABLE";
       else entry.status=facts?"PASS_SOURCE_TABLE_AND_RESULT":"PASS_SOURCE_LINKS_AND_RESULT";
     }catch(error){
       entry.status="FAIL_RESULT_LINK_TAP";
       entry.resultError=trim(error.message).slice(0,190);
     }
   }
   return entry;
 }
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 page.setDefaultTimeout(4500);page.setDefaultNavigationTimeout(12000);
 page.on("pageerror",e=>report.errors.push(e.message.slice(0,250)));
 async function goto(path){await page.goto(base+path,{waitUntil:"domcontentloaded",timeout:12000});}
 async function runOne(kind,href,label,index,isButton){
  try{
   await goto(kind==="home"?"/":"/medical-cost");
   const locator=kind==="home"?page.locator(".native-symptom-item").nth(index):
     page.locator(".md-cost-grid .cost-tile").nth(index);
   await locator.waitFor({timeout:6500});
   await locator.tap({timeout:3500});
   const entry=await observe(page,kind,label,href,index);
   if(segment(entry.url)===segment(new URL(href||"/",base).pathname)&&!isButton){
     entry.isCorrectRoute=true;
   }else if(!isButton){
     entry.status="FAIL_WRONG_NAVIGATION";
   }
   return entry;
  }catch(error){
   return {index,label,href,status:"FAIL_TAP_OR_NAVIGATION",error:trim(error.message).slice(0,350)};
  }
 }
 try{
  await goto("/");
  await page.locator('[data-native-menu-count="20"]').waitFor({timeout:14000});
  const menus=await page.locator(".native-symptom-item").evaluateAll(els=>
    els.map((e,i)=>({index:i,label:(e.innerText||"").trim(),
       href:e.getAttribute("href"),isButton:e.tagName==="BUTTON"})));
  for(const item of menus){
   const result=await runOne("home",item.href,item.label,item.index,item.isButton);
   report.homeMenus.push(result);
   console.log("HOME_TAP",JSON.stringify(result));
  }
  await goto("/medical-cost");
  const tiles=await page.locator(".md-cost-grid .cost-tile").evaluateAll(els=>
    els.map((e,i)=>({index:i,label:(e.innerText||"").trim(),
      href:e.getAttribute("href"),isButton:e.tagName==="BUTTON"})));
  for(const item of tiles){
   const result=await runOne("price",item.href,item.label,item.index,item.isButton);
   report.priceTiles.push(result);
   console.log("PRICE_TAP",JSON.stringify(result));
  }
 }finally{
  report.summary={
    homeCount:report.homeMenus.length,homePass:report.homeMenus.filter(x=>x.status.startsWith("PASS")).length,
    priceCount:report.priceTiles.length,pricePass:report.priceTiles.filter(x=>x.status.startsWith("PASS")).length,
    jsErrors:report.errors.slice(-15)
  };
  fs.mkdirSync(screenshotDir,{recursive:true});
  fs.writeFileSync(screenshotDir+"/native-all-clicks.json",JSON.stringify(report,null,2));
  console.log("ALL_NATIVE_CLICK_AUDIT",JSON.stringify(report.summary));
  await browser.close();
 }
 if(report.summary.homePass!==report.summary.homeCount||report.summary.pricePass!==report.summary.priceCount)process.exitCode=1;
})().catch(e=>{console.error("Audit setup failure",e);process.exitCode=1});
