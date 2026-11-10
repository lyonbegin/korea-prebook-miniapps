/* Mobile touch tests against actual PostgreSQL-backed original facts.
   Not visual parity assertions. A blank or invented item fails.
*/
const{chromium}=require("playwright");
const assert=require("node:assert/strict");
const fs=require("fs");
const base=process.env.MD_URL||"http://127.0.0.1:5173";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const results=[],errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 fs.mkdirSync("qa-artifacts",{recursive:true});
 async function load(url){
    const r=await page.goto(base+url,{waitUntil:"domcontentloaded",timeout:20000});
    await page.locator("[data-source-view],.error-panel,.clinic-head,.md-cost-list").first().waitFor({timeout:15000});
    assert.equal(await page.locator('[role="alert"]').count(),0,"Original data missing at "+url);
    return r;
 }
 async function test(name,run){
  try{const detail=await run();results.push({name,status:"PASS",detail});console.log("SOURCE FUNCTION PASS",name,JSON.stringify(detail));}
  catch(e){const detail=String(e.message||e);results.push({name,status:"FAIL",detail});console.log("SOURCE FUNCTION FAIL",name,detail.slice(0,500));}
 }
 try{
  await test("Medicine original linked rows and search",async()=>{
   await load("/medicine");
   assert.equal(await page.locator('[data-source-view="medicine-search"]').count(),1);
   const rows=page.locator(".observed-link");
   const total=await rows.count();
   assert.ok(total>=50,"Need original linked medicine categories");
   await page.getByRole("textbox",{name:"원본 자료 검색"}).fill("포도당");
   const filtered=await rows.count();
   assert.ok(filtered>0&&filtered<total,"Search should filter actual medicine data");
   for(const txt of await rows.allTextContents())assert.match(txt,/포도당/);
   await page.getByRole("button",{name:"검색어 지우기"}).tap();
   assert.equal(await rows.count(),total);
   return {total,filtered};
  });
  await test("Medicine ingredient detail five genuine source drugs",async()=>{
   await load("/medicine/ingredient/세마글루티드");
   const rows=page.locator(".observed-link");
   assert.equal(await rows.count(),5);
   assert.match((await rows.allTextContents()).join(" "),/위고비|오젬픽/);
   return {original_drug_links:await rows.count()};
  });
  await test("Hospital by department regional filter",async()=>{
   await load("/dept-hub/내과");
   const links=page.locator(".observed-link");
   const all=await links.count();
   assert.ok(all>=40);
   await page.getByRole("button",{name:"서울",exact:true}).tap();
   const filtered=await links.count();
   assert.ok(filtered>0&&filtered<all);
   assert.match((await links.allTextContents()).join(" "),/서울/);
   return {all,filtered};
  });
  await test("Night hospital list actual source URLs",async()=>{
   await load("/hospital/야간진료");
   const rows=page.locator(".original-hospital-night-card");
   assert.ok(await rows.count()>=15,"Original hospital list is missing");
   const dest=await rows.first().getAttribute("href");
   assert.match(dest,/^\/hospital\/detail\?hospital_id=\d+/);
   await rows.first().tap();
   assert.equal(new URL(page.url()).pathname,"/hospital/detail");
   // Detail is only counted if original public facts are fetched and displayed.
   await page.locator(".clinic-head,.error-panel").first().waitFor({timeout:14000});
   assert.equal(await page.locator(".error-panel").count(),0,"Detail click did not load actual original data");
   return {selected:dest,title:await page.locator("h1").first().innerText()};
  });
  await test("MyDoctor Mounjaro original fact price tables",async()=>{
   await load("/medical-cost/마운자로");
   assert.equal(await page.locator(".original-price-tablewrap").count(),2);
   const all=await page.locator(".original-price-tablewrap tbody tr").allTextContents();
   assert.ok(all.some(x=>x.includes("269,000원")));
   assert.ok(all.some(x=>x.includes("5,000원")));
   return {tables:2,factual_prices:all.length};
  });
  await test("Night pharmacy 50 real source cards and region routing",async()=>{
   await load("/pharmacy/야간약국");
   assert.equal(await page.locator('[data-source-view="pharmacy-list"]').count(),1);
   const cards=page.locator(".original-pharmacy-card");
   const count=await cards.count();
   assert.equal(count,50,"Original first page contains 50 observed pharmacy cards");
   assert.match(await cards.first().innerText(),/지곡백화점약국/);
   assert.match(await cards.first().innerText(),/충청남도 서산시/);
   assert.match(await cards.first().innerText(),/041-662-2808/);
   await page.getByRole("button",{name:/전국/}).first().tap();
   const region=page.locator('.original-pharmacy-options a').filter({hasText:"서울"}).first();
   assert.ok((await region.getAttribute("href")).includes("/pharmacy/"));
   return {cards:count,verified_source:"public original location, hours, phone",seoul_region_link:await region.getAttribute("href")};
  });
  await test("Original QnA visible link routing",async()=>{
   await load("/qna");
   assert.equal(await page.locator('[data-source-view="qna-index"]').count(),1);
   const rows=page.locator(".original-qna-item");
   const count=await rows.count();
   assert.ok(count>=15,"QnA sourced links are not displayed");
   const link=rows.first();
   assert.match(await link.getAttribute("href"),/^\/qna\//);
   return {public_qna_links:count};
  });
  await test("BMI calculation with mobile numeric inputs",async()=>{
   await load("/healthLab/calculator/bmi");
   await page.getByRole("spinbutton",{name:"키(cm)"}).fill("170");
   await page.getByRole("spinbutton",{name:"체중(kg)"}).fill("70");
   assert.match(await page.locator(".observed-bmi-result").innerText(),/24\.2/);
   return {bmi:"24.2"};
  });
  await test("Observed hospital review facets and visit stats",async()=>{
   await load("/hospital/10055/reviews");
   assert.equal(await page.locator('[data-source-view="reviews"]').count(),1);
   assert.match(await page.locator(".review-metrics").innerText(),/465건/);
   assert.match(await page.locator(".review-metrics").innerText(),/97%/);
   assert.equal(await page.locator(".review-facets button").count(),11);
   assert.equal(await page.locator(".review-source-card").count(),3,"First three public masked hospital reviews");
   assert.ok((await page.locator(".review-source-tags img").count())>=3,"Source feedback icon images retained");
   await page.getByRole("button",{name:"안구 질환 58건"}).tap();
   assert.match(await page.locator(".review-filter-label").innerText(),/58건/);
   return {original_aggregate_reviews:465,readmission_intent:"97%",facets:11};
  });
  await test("Observed doctor review facets and patient-independent totals",async()=>{
   await load("/telemedicine/doctor/탑연합의원-박광규-100/reviews");
   assert.match(await page.locator(".review-metrics").innerText(),/1,079건/);
   assert.match(await page.locator(".review-metrics").innerText(),/99%/);
   assert.equal(await page.locator(".review-facets button").count(),13);
   assert.equal(await page.locator(".review-doctor-source-card").count(),3,"Three real masked public doctor reviews");
   assert.match(await page.locator(".review-doctor-source-card").first().innerText(),/피부 질환 처방/);
   assert.equal(await page.locator(".review-doctor-feedback-row").count(),9);
   return {original_aggregate_reviews:1079,readmission_intent:"99%",facets:13,public_masked_cards:3};
  });
  await test("No page scripting errors",async()=>{
    assert.deepEqual(errors,[]);
    return {browser_errors:0};
  });
 }finally{
  fs.writeFileSync("qa-artifacts/original-fact-interactions.json",JSON.stringify(results,null,2));
  await browser.close();
 }
 if(results.some(r=>r.status==="FAIL"))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
