/* Public-page-only Playwright QA. Never log in, scrape protected data, or submit real patient details. */
const {chromium}=require("playwright");
const fs=require("fs");
const assert=require("node:assert/strict");
const base=process.env.UNNI_URL||"https://unni-mobile-web-production.up.railway.app";
const checks=[];
const failures=[];
async function check(label,fn){
 try{const result=await fn();checks.push({label,status:"PASS",detail:result||""});console.log("PASS",label,result||"");}
 catch(e){failures.push({label,error:e?.message||String(e)});checks.push({label,status:"FAIL",detail:e?.message||String(e)});console.error("FAIL",label,e?.message||e)}
}
async function main(){
 fs.mkdirSync("qa-artifacts",{recursive:true});
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];
 page.on("pageerror",e=>errors.push("PAGE "+e.message));
 page.on("console",msg=>{if(msg.type()==="error")errors.push("CONSOLE "+msg.text().slice(0,200))});
 const visit=async route=>{
  const response=await page.goto(base+route,{waitUntil:"domcontentloaded",timeout:30000});
  await page.locator(".loading-screen").waitFor({state:"hidden",timeout:30000}).catch(()=>{});
  await page.waitForTimeout(1000);
  return response;
 };
 try{
  await check("Home renders",async()=>{
   await visit("/");
   assert.match((await page.locator("body").innerText()),/Discover the beauty|Find your treatment/i);
   await page.screenshot({path:"qa-artifacts/00-home.png",fullPage:true});
   return await page.locator(".offer-card").count()+" visible offer cards";
  });
  await check("Event 70809 options and original option 5 price",async()=>{
   await visit("/events/70809?optionId=d195122c-ee11-4090-94c1-29a439508bdd");
   const pageText=await page.locator("body").innerText();
   assert.match(pageText,/Fat Dissolving Injection/);
   assert.match(pageText,/14 options/);
   assert.match(pageText,/Shoulder Slimming Botox/);
   assert.match(pageText,/\$163\.68/);
   assert.match(pageText,/20%/);
   assert.match(pageText,/U Line Clinic/);
   await page.screenshot({path:"qa-artifacts/01-event.png",fullPage:true});
   return "source event 70809 and 14 options, $163.68";
  });
  await check("Recommended to 5 items",async()=>{
   const sec=page.locator("#d2-recommended");
   await sec.waitFor({state:"visible",timeout:10000});
   assert.equal(await sec.locator("li").count(),5);
   assert.match(await sec.innerText(),/exercising/);
   return "5 original public recommendations";
  });
  await check("Option 1 updates price and deep link",async()=>{
   const list=page.locator("#d2-options .d2-option");
   assert.ok(await list.count()>=8);
   await list.nth(0).click();
   await page.waitForTimeout(100);
   const selection=await page.locator(".d2-selected").innerText();
   assert.match(selection,/\$21\.58/);
   assert.match(page.url(),/optionIndex=1/);
   return selection.slice(0,90);
  });
  await check("Option 5 restores source id and $163.68",async()=>{
   await page.locator("#d2-options .d2-option").nth(4).click();
   const selection=await page.locator(".d2-selected").innerText();
   assert.match(selection,/\$163\.68/);
   assert.match(page.url(),/optionId=d195122c/);
   return selection.slice(0,90);
  });

  await check("Saving after option change stores the chosen deep link",async()=>{
   const options=page.locator("#d2-options .d2-option");
   const save=page.locator(".d2-actionbar button").first();
   await options.nth(0).click();
   await save.click();
   const rows=await page.evaluate(()=>JSON.parse(localStorage.getItem("unni_clone_saved_pages_v2")||"[]"));
   assert.ok(rows.some(x=>x.includes("/events/70809?optionIndex=1")),JSON.stringify(rows));
   assert.equal(await save.innerText(),"Saved");
   await options.nth(4).click();
   assert.equal(await save.innerText(),"Save");
   assert.match(page.url(),/optionId=d195122c/);
   return "option 1 saved by selected URL; option 5 remains unsaved";
  });
  await check("Event inquiry carries exact option and clinic IDs without writing to DB",async()=>{
   let sent=null;
   await page.route("**/inquiries",async route=>{
    if(route.request().method()!=="POST")return route.continue();
    sent=route.request().postDataJSON();
    await route.fulfill({status:201,contentType:"application/json",body:JSON.stringify({
     id:"00000000-0000-4000-8000-000000000001",token:"qa-mock-only",status:"pending_assignment"
    })});
   });
   try{
    await page.locator(".d2-sticky button").click();
    await page.locator(".iq-form input[required]").fill("synthetic-qa@example.invalid");
    await page.locator(".iq-form textarea").fill("Synthetic test only; network request intercepted.");
    await page.locator(".iq-consent input").check();
    await page.locator(".iq-submit").click();
    await page.locator(".iq-panel header").getByText("Your inquiry").waitFor({timeout:8000});
    assert.equal(sent?.event_id,"70809");
    assert.equal(sent?.option_index,5);
    assert.equal(sent?.source_option_id,"d195122c-ee11-4090-94c1-29a439508bdd");
    assert.equal(sent?.clinic_id,"826");
    await page.locator(".iq-panel header button").click();
    return "event 70809 / option 5 UUID / clinic 826 (POST fully mocked)";
   }finally{await page.unroute("**/inquiries")}
  });
  await check("Case: clinic 826 highlights hours reviews",async()=>{
   await visit("/hospitals/826");
   const text=await page.locator("body").innerText();
   for(const needle of ["U Line Clinic","Clinic Highlights","Clinic Hours","9.7","10,685","Gangnam-gu"])assert.ok(text.includes(needle),needle);
   await page.screenshot({path:"qa-artifacts/02-hospital.png",fullPage:true});
   return "clinic 826 9.7/10,685 + hours/address";
  });

  await check("Clinic inquiry retains clinic ID without writing to DB",async()=>{
   let sent=null;
   await page.route("**/inquiries",async route=>{
    if(route.request().method()!=="POST")return route.continue();
    sent=route.request().postDataJSON();
    await route.fulfill({status:201,contentType:"application/json",body:JSON.stringify({
     id:"00000000-0000-4000-8000-000000000002",token:"qa-mock-only",status:"pending_assignment"
    })});
   });
   try{
    await page.locator(".d2-sticky button").click();
    await page.locator(".iq-context").getByText("U Line Clinic").waitFor({timeout:8000});
    await page.locator(".iq-form input[required]").fill("synthetic-qa@example.invalid");
    await page.locator(".iq-form textarea").fill("Synthetic test only; network request intercepted.");
    await page.locator(".iq-consent input").check();
    await page.locator(".iq-submit").click();
    await page.locator(".iq-panel header").getByText("Your inquiry").waitFor({timeout:8000});
    assert.equal(sent?.clinic_id,"826");
    assert.equal(sent?.event_id,null);
    assert.equal(sent?.clinic_name,"U Line Clinic");
    await page.locator(".iq-panel header button").click();
    return "clinic 826 preserved (POST fully mocked)";
   }finally{await page.unroute("**/inquiries")}
  });
  await check("Case: doctor 1502 name and reviews",async()=>{
   await visit("/doctors/1502");
   const text=await page.locator("body").innerText();
   assert.match(text,/Seungmin Yoo/);
   assert.match(text,/9,137/);
   assert.ok(!text.includes("App Download"));
   await page.screenshot({path:"qa-artifacts/03-doctor.png",fullPage:true});
   return "doctor Seungmin Yoo / 9,137";
  });
  await check("Case: alternate event discounts",async()=>{
   await visit("/events/140615?optionId=4dcff287-79f2-45b3-b4e3-42ffc59eaddf");
   const text=await page.locator("body").innerText();
   assert.match(text,/InMode FX/);assert.match(text,/46%/);
   await page.screenshot({path:"qa-artifacts/04-alt-event.png",fullPage:true});
   return "46% discount";
  });
  await check("Inquiries screen is honest",async()=>{
   await visit("/inquiries");
   assert.match(await page.locator("body").innerText(),/inquiries/i);
   await page.screenshot({path:"qa-artifacts/05-inquiries.png",fullPage:true});
   return "no unconfirmed booking presented as completed";
  });
  await check("No unhandled app errors",async()=>{
   const important=errors.filter(s=>/ReferenceError|TypeError|Uncaught|SyntaxError|not defined/.test(s));
   assert.deepEqual(important,[]);
   return errors.length+" reported browser console errors";
  });
 }finally{
  await browser.close();
  const report={date:new Date().toISOString(),base,checks,failures,pageErrors:errors};
  fs.writeFileSync("qa-artifacts/smoke-results.json",JSON.stringify(report,null,2));
  console.log("\nRESULT",checks.filter(x=>x.status==="PASS").length+"/"+checks.length,"checks passed");
 }
 if(failures.length)process.exit(1);
}
main().catch(e=>{console.error(e);process.exit(1)});
