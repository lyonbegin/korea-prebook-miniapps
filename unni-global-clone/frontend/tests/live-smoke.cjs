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
   const sourceHome=await page.locator("body").innerText();
   assert.match(sourceHome,/deals up to|exclusive savings|treatment deals/i);
   assert.ok(!sourceHome.includes("Discover the beauty in you."),"fabricated home hero returned");
   assert.ok(await page.locator(".offer-card").count()>0,"original home should expose real offers");
   const totalCards=await page.locator(".offer-card").count();
   const actualImages=await page.locator(".offer-card .offer-media img").count();
   assert.ok(actualImages>=Math.ceil(totalCards*0.6),`Expected source-linked card photos: ${actualImages} of ${totalCards}`);
   console.log("HOME_MEDIA_COVERAGE",actualImages+"/"+totalCards);
   // Inspect source DOM structure to diagnose homepage image/card association.
   // GET-only. Synthetic substitutions are prohibited.
   const sourceDiagnostic=await page.evaluate(async()=>{
      const html=await (await fetch("/gateway/public-web/us",{headers:{Accept:"text/html"}})).text();
      const doc=new DOMParser().parseFromString(html,"text/html");
      const all=[...doc.querySelectorAll('a[href*="/us/events/"]')];
      return all.slice(0,8).map(a=>{
        const result={href:a.getAttribute("href"),text:(a.textContent||"").trim().slice(0,90),ancestors:[]};
        let el=a;
        for(let depth=0;el&&depth<6;depth++,el=el.parentElement){
          const imgs=[...el.querySelectorAll("img")];
          const events=[...el.querySelectorAll('a[href*="/us/events/"]')];
          const backgrounds=[...el.querySelectorAll('[style*="background"]')].slice(0,2);
          result.ancestors.push({tag:el.tagName,cls:String(el.className).slice(0,90),imgCount:imgs.length,eventLinks:events.length,
            images:imgs.slice(0,2).map(img=>({src:img.getAttribute("src")?.slice(0,170),srcset:img.getAttribute("srcset")?.slice(0,100)})),
            styles:backgrounds.map(b=>b.getAttribute("style")?.slice(0,110))});
        }
        return result;
      });
   });
   fs.writeFileSync("qa-artifacts/home-source-dom-audit.json",JSON.stringify(sourceDiagnostic,null,2));
   console.log("HOME_SOURCE_DOM_AUDIT",JSON.stringify(sourceDiagnostic).slice(0,9000));

   assert.match(sourceHome,/Your eye treatment cheatsheet/i);
   assert.match(sourceHome,/Your nose lift cheat sheet/i);
   assert.match(sourceHome,/Your fat dissolve cheat sheet/i);
   await page.screenshot({path:"qa-artifacts/00-home.png",fullPage:true});
   return await page.locator(".offer-card").count()+" visible offer cards";
  });
  await check("Homepage restores six genuine source promotional images and source category icons",async()=>{
    await visit("/");
    const cards=page.locator(".source-promo-card img");
    assert.equal(await cards.count(),1);
    assert.match(await cards.first().getAttribute("src"),/originalImageWidth=1080/);
    assert.equal(await page.locator(".source-promo-peek img").count(),2,"Adjacent real promotional previews remain visible");
    assert.match(await page.locator(".source-promo-position").innerText(),/2\s*\/\s*6/);
   assert.match(await page.locator(".source-promo-overlay-bottom h3").innerText(),/Free On-Site Interpreter Support/);
   assert.match(await page.locator(".source-promo-overlay-bottom p").innerText(),/Unni users/);
   assert.match(await page.locator(".source-promo-badge").innerText(),/Benefits/);
    await page.getByRole("button",{name:"Next promotion"}).click();
    assert.match(await page.locator(".source-promo-position").innerText(),/3\s*\/\s*6/);
    assert.ok(await page.locator(".source-category-strip img").count()>=10,"Original category art icons must be linked");
    assert.ok(await page.locator(".source-column-section .article-card").count()>=3,"Column cards must appear at original first-section position");
    return "six original promo assets, source category icons, first-position column cards";
  });
  await check("Homepage shows original breach notice and functional original bottom navigation",async()=>{
    await visit("/");
    assert.match(await page.locator(".source-breach-summary").innerText(),/Notice of Partial Personal Data Breach/);
    const button=page.getByRole("button",{name:/View more details/});
    await button.click();
    assert.match(await page.locator(".source-breach-detail").innerText(),/September 4, 2026/);
    await page.getByRole("button",{name:"Hide details"}).click();
    assert.equal(await page.locator(".source-global-bottom button").count(),5);
    await page.locator(".source-global-bottom button").filter({hasText:"Clinics"}).click();
    assert.match(page.url(),/\/hospitals$/);
    return "source notice expansion and 5 real navigation destinations";
  });
  await check("Event 70809 options and original option 5 price",async()=>{
   await visit("/events/70809?optionId=d195122c-ee11-4090-94c1-29a439508bdd");
   const pageText=await page.locator("body").innerText();
   assert.match(pageText,/Fat Dissolving Injection/);
   assert.match(pageText,/14 options/);
   assert.match(pageText,/Shoulder Slimming Botox/);
   assert.match(pageText,/\$\d{1,4}\.\d{2}/);
   assert.match(pageText,/20%/);
   assert.match(pageText,/U Line Clinic/);
   assert.match(await page.locator(".d2-top .d2-ratings").innerText(),/4,\d{3}/,"Public source event review count must appear next to its 9.9 rating");
   await page.screenshot({path:"qa-artifacts/01-event.png",fullPage:true});
   return "source event 70809 and 14 source options with live converted price";
  });
  await check("Full public promotional image list is retained",async()=>{
   const images=await page.locator(".d2-detail img").evaluateAll(nodes=>nodes.map(n=>n.currentSrc||n.src));
   const direct=[...new Set(images.filter(u=>u.includes("/images/direct/")))];
   // Source 70809 currently exposes 20 direct photos plus one map image.
   // Never silently label the map as a direct promotional asset.
   assert.equal(direct.length,20,JSON.stringify(direct.slice(0,3)));
   const maps=images.filter(u=>u.includes("get-generated-signed-map-url"));
   assert.equal(maps.length,1,"source clinic map must be rendered");
   return direct.length+" direct images + "+maps.length+" source map";
  });
  await check("Recommended to 5 items",async()=>{
   const sec=page.locator("#d2-recommended");
   await sec.waitFor({state:"visible",timeout:10000});
   assert.equal(await sec.locator("li").count(),5);
   assert.match(await sec.innerText(),/exercising/);
   return "5 original public recommendations";
  });
  await check("Inspect public source option UUID exposure without writing data",async()=>{
    const info=await page.evaluate(async()=>{
      const path="/gateway/public-web/us/events/70809?optionId=d195122c-ee11-4090-94c1-29a439508bdd";
      const response=await fetch(path,{credentials:"omit",headers:{Accept:"text/html"}});
      const html=await response.text();
      const pattern=/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
      const found=[...html.matchAll(pattern)];
      const ids=[...new Set(found.map(m=>m[0].toLowerCase()))];
      const contexts=found.slice(0,45).map(m=>({
         id:m[0],near:html.slice(Math.max(0,m.index-65),m.index+85)
           .replace(/[<>]/g," ").slice(0,150)
      }));
      return {status:response.status,bytes:html.length,uuidCount:ids.length,uuidSamples:ids.slice(0,20),contexts};
    });
    fs.writeFileSync("qa-artifacts/source-option-uuid-diagnostic.json",JSON.stringify(info,null,2));
    console.log("PUBLIC_OPTION_UUID_DIAG",JSON.stringify(info).slice(0,9000));
    assert.equal(info.status,200);
    return info.uuidCount+" observed public HTML UUID values (not all are option IDs)";
  });
  await check("All 14 source options have distinct list positions",async()=>{
   await page.locator(".d2-show-more").click();
   const cards=page.locator("#d2-options .d2-option");
   assert.equal(await cards.count(),14);
   const labels=await cards.locator("small").allTextContents();
   assert.ok(labels.some(x=>x.includes("Option 14")));
   return "14 original options, no samples substituted";
  });
  await check("Original top View all opens full source option list",async()=>{
   const collapse=page.locator(".d2-show-more");
   if(await collapse.count()&&/Show fewer/.test(await collapse.innerText()))await collapse.click();
   const top=page.locator(".d2-featured-public .d2-featured-head button");
   await top.click();
   assert.equal(await page.locator("#d2-options .d2-option").count(),14);
   return "top source-style View all reveals all 14 real priced options";
  });
  await check("Option selection survives browser back and forward navigation",async()=>{
    await visit("/events/70809?optionId=d195122c-ee11-4090-94c1-29a439508bdd");
    const cards=page.locator("#d2-options .d2-option");
    await cards.nth(0).click();
    const first=page.url();
    assert.match(first,/optionId=65ec0474-c599-11ee-982f-0a5164a62f36/);
    await cards.nth(4).click();
    const fifth=page.url();
    assert.match(fifth,/optionId=d195122c-ee11-4090-94c1-29a439508bdd/);
    await page.goBack({waitUntil:"domcontentloaded"});
    await page.waitForFunction(()=>document.querySelector(".d2-featured-public")?.textContent?.includes("Option 1"),null,{timeout:14000});
    assert.equal(page.url(),first);
    await page.goForward({waitUntil:"domcontentloaded"});
    await page.waitForFunction(()=>document.querySelector(".d2-featured-public")?.textContent?.includes("Option 5"),null,{timeout:14000});
    assert.equal(page.url(),fifth);
    return "original option UUID URL and visible selection restored in history back/forward";
  });
  await check("All 14 source option IDs map to unique actual deep links",async()=>{
   const cards=page.locator("#d2-options .d2-option");
   assert.equal(await cards.count(),14);
   const ids=new Set();
   for(let i=0;i<14;i++){
     await cards.nth(i).click();
     const url=new URL(page.url());
     const id=url.searchParams.get("optionId");
     assert.match(id||"",/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i,"Missing genuine source optionId at position "+(i+1));
     assert.ok(!ids.has(id),"Duplicated source option UUID at position "+(i+1));
     ids.add(id);
   }
   await cards.nth(4).click();
   assert.equal(ids.size,14);
   return "14/14 distinct source-provided UUIDs preserved in click-and-share URLs";
  });
  await check("Option 1 updates price and deep link",async()=>{
   const list=page.locator("#d2-options .d2-option");
   assert.ok(await list.count()>=8);
   await list.nth(0).click();
   await page.waitForTimeout(100);
   const selection=await page.locator(".d2-selected").innerText();
   const expected=await list.nth(0).locator(".d2-price strong").innerText();
   assert.ok(expected.startsWith("$"),expected);
   assert.ok(selection.includes(expected),"selected price must equal live option 1 card price");
   assert.match(page.url(),/optionId=65ec0474-c599-11ee-982f-0a5164a62f36/,"Original option 1 UUID from public SSR");
   return selection.slice(0,90);
  });
  await check("Option 5 restores source id and $163.68",async()=>{
   await page.locator("#d2-options .d2-option").nth(4).click();
   const selection=await page.locator(".d2-selected").innerText();
   const expected=await page.locator("#d2-options .d2-option").nth(4).locator(".d2-price strong").innerText();
   assert.ok(expected.startsWith("$"),expected);
   assert.ok(selection.includes(expected),"selected price must equal live option 5 card price");
   assert.match(page.url(),/optionId=d195122c/);
   return selection.slice(0,90);
  });

  await check("Saving after option change stores the chosen deep link",async()=>{
   const options=page.locator("#d2-options .d2-option");
   const save=page.locator(".d2-actionbar button").first();
   await options.nth(0).click();
   await save.click();
   const rows=await page.evaluate(()=>JSON.parse(localStorage.getItem("unni_clone_saved_pages_v2")||"[]"));
   assert.ok(rows.some(x=>x.includes("optionId=65ec0474-c599-11ee-982f-0a5164a62f36")),JSON.stringify(rows));
   assert.equal(await save.innerText(),"Saved");
   await options.nth(4).click();
   assert.equal(await save.innerText(),"Save");
   assert.match(page.url(),/optionId=d195122c/);
   return "option 1 saved by selected URL; option 5 remains unsaved";
  });
  await check("Visited option UUID stored in catalog is reused on next selection",async()=>{
   const cachedId="11111111-2222-4333-8444-555555555555";
   await page.route("**/catalog/events/70809",async route=>{
     await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
       original_event_id:"70809",options:[{display_order:1,public_name:"V Cut Injection Facial Fat Dissolving Injection",original_option_id:cachedId}]
     })});
   });
   try{
     await visit("/events/70809?optionIndex=1");
     await page.waitForTimeout(400);
     await page.locator("#d2-options .d2-option").nth(0).click();
     assert.match(page.url(),/optionId=65ec0474-c599-11ee-982f-0a5164a62f36/,"Source-observed UUID outranks conflicting synthetic cache");
     return "Original SSR UUID wins over conflicting synthetic DB fixture";
   }finally{
     await page.unroute("**/catalog/events/70809");
     // The synthetic cache fixture only knows option 1. Restore the original
     // option 5 source deep link rather than inventing a UUID for its selection.
     await visit("/events/70809?optionId=d195122c-ee11-4090-94c1-29a439508bdd");
   }
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
  await check("Independent visitor thread refreshes incoming messages",async()=>{
   const id="00000000-0000-4000-8000-000000000001";
   let reads=0;
   await page.route("**/inquiries/"+id,async route=>{
     if(route.request().method()!=="GET")return route.continue();
     reads++;
     await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
       inquiry:{status:"pending_assignment",event_name:"Fat Dissolving Injection",option_name:"Shoulder Slimming Botox"},
       messages:reads>=2?[{id:"message-1",role:"staff",content:"Synthetic test reply, not an actual clinic message."}]:[]
     })});
   });
   try{
     await visit("/inquiries");
     await page.locator(".iq-list-item").first().click();
     await page.locator(".iq-refresh").click();
     await page.getByText("Synthetic test reply, not an actual clinic message.").waitFor({timeout:5000});
     return "Incoming message becomes visible after refresh; mocked, no production DB writes";
   }finally{await page.unroute("**/inquiries/"+id)}
  });
  await check("Case: clinic 826 highlights hours reviews",async()=>{
   await visit("/hospitals/826");
   const text=await page.locator("body").innerText();
   for(const needle of ["U Line Clinic","Clinic Highlights","Clinic Hours","9.7","Gangnam-gu"])assert.ok(text.includes(needle),needle);
   assert.match(text,/10,\d{3}\s+Reviews/,"Live source clinic reviews must be shown");
   await page.screenshot({path:"qa-artifacts/02-hospital.png",fullPage:true});
   return "clinic 826 live review count + 7-day hours/address";
  });

  await check("Source clinic tabs and public highlight disclaimer",async()=>{
    await visit("/hospitals/826");
    const names=await page.locator(".d2-clinic-tabs button").allTextContents();
    assert.deepEqual(names,["Clinic Info","Procedures","Reviews"]);
    await page.getByRole("button",{name:"Procedures",exact:true}).last().click();
    assert.ok(await page.locator("#d2-clinic-events .offer-card").count()>=4);
    const content=await page.locator("#d2-highlights").innerText();
    assert.ok(content.indexOf("clinic-provided")<content.indexOf("Camera-monitored operating rooms"));
    return "3 public clinic sections, source badge caveat before badges";
  });
  await check("Clinic gallery cycles all ten photos",async()=>{
   const count=page.locator(".d2-photo-count");
   assert.match(await count.innerText(),/1\s*\/\s*10/);
   assert.match(await page.locator(".d2-hero-photo img").getAttribute("alt"),/_0_image$/,"First image must use original slide index 0, not preloaded last-slide duplicate");
   const photos=new Set();
   for(let i=0;i<10;i++){
     photos.add(await page.locator(".d2-hero-photo img").getAttribute("src"));
     await page.locator(".d2-right").click();
   }
   assert.equal(photos.size,10,"unique clinic gallery images");
   assert.match(await count.innerText(),/1\s*\/\s*10/);
   return "10 unique clinic photos and wrap-around";
  });
  await check("Clinic address excludes source copy-control text",async()=>{
   const address=await page.locator("#d2-address p").first().innerText();
   assert.ok(address.includes("Gangnam-gu"));
   assert.ok(!/BuildingCopy/.test(address),address);
   return address.slice(0,110);
  });
  await check("Clinic maps preserve source provider and exact marker coordinates",async()=>{
   await visit("/hospitals/826");
   const href=await page.locator("#d2-address .d2-map a").first().getAttribute("href");
   assert.match(href,/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
   assert.match(decodeURIComponent(href),/37\.5263383311071,127\.040916968767/);
   return "published original Google map coordinates preserved";
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
   assert.match(text,/\bReviews\s+\d{1,3},\d{3}\b/,"Original physician card publishes Reviews then count");
   assert.ok(!text.includes("Original data unavailable"));
   assert.match(await page.locator(".d2-doctor-detail").innerText(),/Seungmin Yoo/);
   await page.screenshot({path:"qa-artifacts/03-doctor.png",fullPage:true});
   return "doctor Seungmin Yoo / live public review count";
  });
  await check("Doctor original public review illustration and official login link",async()=>{
    await visit("/doctors/1502");
    const img=page.locator("#d2-doctor-reviews img.d2-source-review-illustration");
    await img.waitFor({timeout:12000});
    assert.equal(await img.getAttribute("src"),"https://unni.app/images/review-login/us.webp");
    assert.equal(await page.locator(".d2-source-review-login").getAttribute("href"),"https://unni.app/us/doctors/1502");
    assert.match(await page.locator("#d2-doctor-reviews").innerText(),/Sign in in 3 seconds/);
    return "public review-login illustration and official sign-in location, no copied private reviews";
  });
  await check("Doctor public specialties and experience",async()=>{
   const body=await page.locator("body").innerText();
   assert.match(body,/Filler, Lifting, Body, Skin, Botox/,"Original doctor profile lists specialty labels without a separate Specialties heading");
   assert.match(body,/Society conferences and papers|Korean Obesity Research/i);
   return "Public physician specialties and experience";
  });
  await check("Case: alternate event discounts",async()=>{
   await visit("/events/140615?optionId=4dcff287-79f2-45b3-b4e3-42ffc59eaddf");
   const text=await page.locator("body").innerText();
   assert.match(text,/InMode FX/);assert.match(text,/46%/);
   await page.screenshot({path:"qa-artifacts/04-alt-event.png",fullPage:true});
   return "46% discount";
  });
  await check("Clinic doctor card navigates to actual doctor detail",async()=>{
   await visit("/hospitals/826");
   await page.waitForFunction(()=>{
     const cards=[...document.querySelectorAll("#d2-doctors .clinic-card")];
     return cards.length===1&&cards[0].textContent.includes("Seungmin Yoo");
   },null,{timeout:15000});
   const cards=page.locator("#d2-doctors .clinic-card");
   assert.equal(await cards.count(),1,"one verified public physician; no phantom clinic card");
   const card=cards.first();
   assert.match(await card.innerText(),/Seungmin Yoo/);
   await card.click();
   assert.match(page.url(),/\/doctors\/1502/);
   await page.locator(".d2-doctor-id-content h1").waitFor({timeout:9000});
   assert.match(await page.locator(".d2-doctor-id-content h1").innerText(),/Seungmin Yoo/);
   return "clinic doctor 1502, name from verified public profile, opens independent doctor detail";
  });
  await check("Clinic procedure card navigates to original event identifier",async()=>{
   await visit("/hospitals/826");
   const card=page.locator("#d2-clinic-events .offer-card").first();
   await card.waitFor({timeout:10000});
   const title=await card.locator(".offer-title").innerText();
   await card.click();
   assert.match(page.url(),/\/events\/\d+/);
   await page.locator(".d2-top h1").waitFor({timeout:10000});
   assert.ok((await page.locator(".d2-top h1").innerText()).length>12);
   return "clinic public offer "+title.slice(0,45)+" enters event detail";
  });
  await check("Public beauty columns load article cards",async()=>{
   await visit("/contents");
   const cards=page.locator(".article-card");
   const count=await cards.count();
   assert.ok(count>=8,"Public content listing should not silently lose its articles");
   assert.ok((await cards.first().locator("b").innerText()).length>28);
   return count+" visible public article cards";
  });
  await check("Public article card opens article detail",async()=>{
   await page.locator(".article-card").first().click();
   assert.match(page.url(),/\/contents\/[a-f0-9-]{24,}/i);
   await page.locator(".d2-top h1").waitFor({timeout:15000});
   const title=await page.locator(".d2-top h1").innerText();
   assert.ok(title.length>20);
   const body=await page.locator(".d2-detail").innerText();
   assert.ok(body.length>title.length+100);
   return "public article title and body displayed: "+title.slice(0,55);
  });
  await check("Listing numeric price filter and ascending sort",async()=>{
   await visit("/events?q=Lifting&categoryId=419");
   await page.locator(".listing-heading button").click();
   await page.getByRole("button",{name:"Lowest Price",exact:true}).click();
   await page.getByRole("button",{name:"Apply filters",exact:true}).click();
   await page.locator(".loading-screen").waitFor({state:"hidden",timeout:30000}).catch(()=>{});
   await page.locator(".offer-card").first().waitFor({state:"visible",timeout:15000});
   const values=await page.locator(".offer-price-line b").allTextContents();
   const nums=values.map(x=>Number(x.replace(/[^0-9.]/g,""))).filter(x=>Number.isFinite(x)&&x>0);
   console.log("SORT_DEBUG",JSON.stringify({url:page.url(),cards:await page.locator(".listing-grid .offer-card").count(),
     values:values.slice(0,10),text:(await page.locator(".listing-page").innerText()).slice(0,250)}));
   assert.ok(nums.length>=5,"Enough source prices to sort");
   assert.ok(nums.every((v,i)=>i===0||v>=nums[i-1]),"Local loaded prices should be ascending");
   return nums.length+" source-linked cards sorted ascending";
  });
  await check("Original category search route renders its live public results",async()=>{
   await visit("/search?category=Lifting");
   const title=await page.locator(".search-results h1").innerText();
   assert.match(title,/Results for 'Lifting'/);
   const cards=page.locator(".search-results .offer-card");
   assert.ok(await cards.count()>=4,"Original category search must expose public treatment results");
   const title0=await cards.first().locator(".offer-title").innerText();
   assert.match(title0,/Lifting/i);
   await cards.first().click();
   assert.match(page.url(),/\/events\/\d+/);
   return "original search category route with live public event links";
  });
  await check("Original location selector loads source-backed city and area labels",async()=>{
   await visit("/district-filter?returnToHome=true");
   const cities=page.locator(".district-region-list button");
   assert.equal(await cities.count(),16,"Public source lists 16 regions");
   await page.getByRole("button",{name:"Busan",exact:true}).click();
   assert.match(await page.locator(".district-areas").innerText(),/Haeundae|Seomyeon/);
   const first=page.locator(".district-areas button").first();
   await first.click();
   assert.match(await page.locator(".district-complete").innerText(),/\(1\)/);
   await page.getByRole("button",{name:"Reset",exact:true}).click();
   assert.doesNotMatch(await page.locator(".district-complete").innerText(),/\(1\)/);
   const ssr=await page.evaluate(async()=>{
      const response=await fetch("/gateway/public-web/us/district-filter?returnToHome=true",{credentials:"omit",headers:{Accept:"text/html"}});
      const html=await response.text();
      const search=["Cheongdam","Seomyeon","N1102","Gangnam Sta","districtId"];
      const contexts=Object.fromEntries(search.map(term=>{
        const idx=html.indexOf(term);
        return [term,idx<0?null:html.slice(Math.max(0,idx-200),idx+420)];
      }));
      const shortCodes=[...new Set((html.match(/["']N\d{3,5}["']/g)||[]))].slice(0,30);
      return {status:response.status,length:html.length,contexts,shortCodes};
    });
   fs.writeFileSync("qa-artifacts/district-public-source-diagnostic.json",JSON.stringify(ssr,null,2));
   console.log("PUBLIC_DISTRICT_DIAG",JSON.stringify(ssr).slice(0,7200));
   // This ID comes from public __NEXT_DATA__ cityList, not a hardcoded invented name.
   await page.getByRole("button",{name:"Seoul",exact:true}).click();
   const seoul=page.locator(".district-areas button").filter({hasText:/Cheongdam\/Apgujeong\/Sinsa/}).first();
   assert.ok(await seoul.count()===1,"Original Cheongdam district found");
   await seoul.click();
   await page.getByRole("button",{name:/^Complete/}).click();
   assert.match(page.url(),/\/events\?district=N1102/,"Source-listed neighborhood code N1102 in URL");
   await page.locator(".listing-grid .offer-card").first().waitFor({timeout:16000});
   assert.ok(await page.locator(".listing-grid .offer-card").count()>=4);
   return "16 cities, source district N1102 and live original filtered listing";
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
