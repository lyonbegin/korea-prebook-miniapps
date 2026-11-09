/* Compare actual same source link clicked in the original and DB-first clone.
   This validates specific navigation/data pairs, never claims overall UI parity.
 */
const{chromium}=require("playwright");
const fs=require("fs");
const assert=require("node:assert/strict");
const original="https://my-doctor.io",clone=process.env.MD_URL||"http://127.0.0.1:5173";
const factFile=require("../../backend/data/public_source_facts_20261109.json");
const pairs=[
 {from:"/medical-cost",match:x=>decodeURIComponent(x.path).includes("/medical-cost/마운자로"),name:"medical price to Mounjaro"},
 {from:"/hospital/야간진료",match:x=>x.path.includes("/hospital/detail?hospital_id="),name:"night hospital to actual clinic"},
 {from:"/medicine/ingredient/세마글루티드",match:x=>decodeURIComponent(x.path).includes("/medicine/오젬픽"),name:"ingredient to genuine drug"},
 {from:"/dept-hub/내과",match:x=>decodeURIComponent(x.path).includes("/dept-hub/내과/서울"),name:"internal medicine to Seoul region"},
 {from:"/healthLab",match:x=>x.path==="/healthLab/calculator/bmi",name:"health lab to BMI"}
];
function canonical(url){const u=new URL(url,"https://my-doctor.io");return decodeURIComponent(u.pathname)+decodeURIComponent(u.search)}
async function goto(page,root,route){
 const r=await page.goto(root+route,{waitUntil:"domcontentloaded",timeout:18000});
 if(r?.status()===429||r?.status()===403)throw Error("Original rate limit "+r.status());
 await page.locator("body").waitFor({timeout:13000});
 if((await page.locator("body").innerText()).trim().length<20)
   throw Error("Original or clone loaded a blank page");
 await page.waitForTimeout(450);
}
async function clickTarget(page,route){
 const all=page.locator("a[href]");
 const idx=await all.evaluateAll((els,p)=>{
   const matches=els.map((a,i)=>({a,i})).filter(({a})=>{
      try{const u=new URL(a.getAttribute("href"),location.origin);
          return decodeURIComponent(u.pathname+u.search)===decodeURIComponent(p)}
      catch{return false}
   });
   const visible=matches.find(({a})=>a.getClientRects().length>0&&
        getComputedStyle(a).visibility!=="hidden"&&getComputedStyle(a).display!=="none");
   return visible?visible.i:-1;
 },route);
 if(idx<0)throw Error("Missing matching original href "+route);
 await all.nth(idx).tap({timeout:10000});
 await page.waitForURL(url=>canonical(url.toString())===canonical(route),{timeout:14000});
 await page.waitForTimeout(450);
}
(async()=>{
 fs.mkdirSync("qa-artifacts",{recursive:true});
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const results=[];
 try{
  for(const p of pairs){
   const sourceFacts=factFile.find(x=>x.path===p.from);
   const target=sourceFacts?.links?.find(p.match)?.path;
   const entry={name:p.name,start:p.from,target,status:"UNVERIFIED"};
   if(!target){entry.status="NO_OBSERVED_ORIGINAL_LINK";results.push(entry);continue}
   const s=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
   const c=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
   try{
     await goto(s,original,p.from);await goto(c,clone,p.from);
     assert.equal(await c.locator("[role=alert]").count(),0,"Missing local starting page facts");
     await clickTarget(s,target);
     const sourceTitle=(await s.locator("h1").first().innerText({timeout:10000})).replace(/\s+/g," ").trim();
     await clickTarget(c,target);
     await c.locator("[role=alert],h1").first().waitFor({timeout:13000});
     assert.equal(await c.locator("[role=alert]").count(),0,"DB/origin data missing after clicked route");
     const cloneTitle=(await c.locator("h1").first().innerText({timeout:10000})).replace(/\s+/g," ").trim();
     assert.equal(cloneTitle,sourceTitle,"Original and clone detail headings differ");
     entry.status="SAME_CLICK_AND_HEADING";entry.headline=sourceTitle;
   }catch(e){entry.status="FAIL";entry.error=String(e.message).slice(0,380)}
   finally{await s.close();await c.close();results.push(entry);console.log("ORIGINAL CLICK PAIR",JSON.stringify(entry))}
  }
 }finally{await browser.close()}
 const passed=results.filter(x=>x.status==="SAME_CLICK_AND_HEADING").length;
 fs.writeFileSync("qa-artifacts/original-click-pairs.json",JSON.stringify({passed,total:results.length,pairs:results},null,2));
 console.log("ORIGINAL CLICK PAIR SUMMARY",JSON.stringify({passed,total:results.length,failures:results.filter(x=>x.status!=="SAME_CLICK_AND_HEADING").map(x=>x.name)}));
 if(passed!==pairs.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
