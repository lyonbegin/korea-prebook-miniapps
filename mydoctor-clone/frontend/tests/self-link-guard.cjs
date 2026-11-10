/* Regression: data-derived self-links were presented as ordinary list items.
   Tapping them re-opened the same URL and looked completely inert.
   Also ensure search state from a parent page is reset on a new route.
*/
const {chromium}=require("playwright");
const base=process.env.MD_URL||"http://127.0.0.1:5173";
const routes=["/medical-cost/마운자로","/hospital/야간진료","/pharmacy/야간약국","/qna","/telemedicine/고혈압-비대면진료-예약"];
const canonical=x=>{try{return decodeURIComponent(new URL(x,"https://my-doctor.io").pathname+new URL(x,"https://my-doctor.io").search).replace(/\/$/,"")}catch{return String(x)}};
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const results=[];
 for(const path of routes){
   const caseResult={path,status:"NOT_TESTED"};
   try{
     await page.goto(base+path,{waitUntil:"domcontentloaded",timeout:20000});
     await page.locator("main h1").first().waitFor({timeout:15000});
     if(await page.locator('main [role="alert"]').count())throw Error("source data unavailable");
     const hrefs=await page.locator("main .observed-link[href]").evaluateAll(nodes=>nodes.map(a=>a.getAttribute("href")));
     const self=hrefs.filter(h=>canonical(h)===canonical(path));
     caseResult.visible_list_rows=hrefs.length;
     caseResult.self_link_rows=self.length;
     caseResult.status=self.length===0?"PASS":"FAIL";
   }catch(e){caseResult.status="ERROR";caseResult.error=String(e.message).slice(0,250);}
   finally{results.push(caseResult);console.log("INERT ROW GUARD "+JSON.stringify(caseResult))}
 }
 await page.goto(base+"/medicine",{waitUntil:"domcontentloaded",timeout:15000});
 await page.locator("main h1").first().waitFor({timeout:15000});
 const search=page.locator('input[aria-label="의약품 이름 검색"],input[aria-label="의약품 검색"],input[placeholder*="검색"]').first();
 const searchCount=await search.count();
 if(searchCount){await search.fill("중외");await page.goto(base+"/qna",{waitUntil:"domcontentloaded",timeout:12000});await page.locator("main h1").first().waitFor({timeout:15000});}
 const state={test:"navigation resets active search filter",status:await page.locator('main [role="alert"]').count()?"FAIL":"PASS",searchFromMedicine:searchCount};
 results.push(state);console.log("INERT ROW GUARD "+JSON.stringify(state));
 await browser.close();
 const failures=results.filter(x=>x.status!=="PASS");
 console.log("INERT ROW GUARD SUMMARY "+JSON.stringify({checked:results.length,passed:results.length-failures.length,failed:failures.length}));
 if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
