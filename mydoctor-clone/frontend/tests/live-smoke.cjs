const{chromium}=require("playwright");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const base=process.env.MD_URL||"http://127.0.0.1:5173";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const checks=[],errors=[];
 fs.mkdirSync("qa-artifacts",{recursive:true});
 page.on("pageerror",e=>errors.push(e.message));
 async function test(name,fn){try{const detail=await fn();checks.push({name,status:"PASS",detail});console.log("PASS",name,detail||"");}catch(e){checks.push({name,status:"FAIL",detail:String(e.message)});console.error("FAIL",name,e.message)}}
 async function goto(route){await page.goto(base+route,{waitUntil:"domcontentloaded",timeout:25000});await page.waitForTimeout(1500);}
 try{
  await test("home public source content available (live or dated snapshot)",async()=>{await goto("/");await page.getByRole("heading",{level:1}).waitFor({timeout:25000});assert.equal(await page.locator('[role="alert"]').count(),0);return await page.locator("h1").first().innerText()});
  await test("navigate to real doctor search by touch",async()=>{const target=page.locator(".bottomnav button").nth(1);await target.tap();await page.waitForTimeout(1200);assert.match(page.url(),/telemedicine\/all-department/);assert.equal(await page.locator('[role="alert"]').count(),0);return page.url()});
  await test("real medical cost route",async()=>{await goto("/medical-cost");const h=await page.locator("h1").first().innerText();assert.match(h,/가격|의료비|진료/);await page.screenshot({path:"qa-artifacts/medical-cost.png"});return h});
  await test("real hospital detail and prices",async()=>{await goto("/hospital/detail?hospital_id=323");await page.locator("h1").first().waitFor({timeout:15000});assert.equal(await page.locator('[role="alert"]').count(),0);assert.ok(await page.locator("table tbody tr").count()>0,"Actual published hospital price rows not rendered");await page.screenshot({path:"qa-artifacts/hospital-323.png"});return await page.locator("h1").first().innerText()});
  await test("no fake clinic booking completion",async()=>{assert.equal(await page.getByText("예약 완료",{exact:true}).count(),0);return"no invented booking"});
  await test("no unhandled browser errors",async()=>{assert.equal(errors.length,0,errors.slice(0,8).join(" | "));return"console page errors 0"});
 }finally{fs.mkdirSync("qa-artifacts",{recursive:true});fs.writeFileSync("qa-artifacts/smoke.json",JSON.stringify(checks,null,2));await browser.close();}
 if(checks.some(x=>x.status==="FAIL"))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
