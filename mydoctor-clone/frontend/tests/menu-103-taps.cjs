/* Physical 390px mobile tap audit of ALL 103 original menu destinations.
   A deterministic mocked 429 ensures it verifies click mechanics and error UX,
   not falsely counting missing cached medical data as real content.
   Source data coverage is measured separately by menu-source-coverage.cjs.
*/
const {chromium}=require("playwright");
const menu=require("../src/data/original-menu-20261109.json");
const root=process.env.MD_URL||"http://127.0.0.1:5173";
const norm=p=>{try{let u=new URL(p,"https://my-doctor.io");return decodeURIComponent(u.pathname+u.search)}catch{return p}};
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await page.goto(root+"/",{waitUntil:"domcontentloaded",timeout:20000});
 await page.locator("main h1").first().waitFor({timeout:15000});
 let requests=0;
 await page.route("**/catalog/page?*",async route=>{
   requests++;
   await route.fulfill({status:503,contentType:"application/json",
     body:JSON.stringify({ok:false,source_status:429,error:"ORIGINAL_PUBLIC_SOURCE_UNAVAILABLE"})});
 });
 const cases=[];const start=Date.now();
 for(const rootMenu of menu.roots){
   const targets=rootMenu.groups.flatMap(g=>g.links);
   for(const target of targets){
     const result={menu:rootMenu.label,label:target.label,target:target.href,status:"NOT_RUN"};
     try{
       await page.getByRole("button",{name:"전체 메뉴"}).tap({timeout:5000});
       const section=page.locator(".source-menu-section").filter({has:page.locator(".source-menu-root").filter({hasText:rootMenu.label})}).first();
       const rootButton=section.locator(".source-menu-root");
       if(await rootButton.getAttribute("aria-expanded")!=="true")await rootButton.tap({timeout:5000});
       const link=section.locator(".source-menu-links a[data-source-href]").filter({hasText:target.label}).filter({has:page.locator("svg")}).first();
       // Duplicate human labels can exist; select exact observed href.
       const all=section.locator(".source-menu-links a[data-source-href]");
       const count=await all.count();let index=-1;
       for(let i=0;i<count;i++)if(await all.nth(i).getAttribute("data-source-href")===target.href){index=i;break}
       if(index<0)throw Error("Original href absent from expanded menu");
       await all.nth(index).tap({timeout:6500});
       result.path_changed=norm(new URL(page.url()).pathname+new URL(page.url()).search)===norm(target.href);
       await page.locator('main .source-route-error[role="alert"]').waitFor({timeout:6500});
       const original=await page.locator("main .source-route-actions a").first().getAttribute("href");
       result.source_link=norm(original)===norm(target.href);
       result.menu_closed=await page.locator(".source-menu").count()===0;
       result.label_visible=(await page.locator("main .source-route-error h1").first().textContent()).includes(target.label);
       result.status=result.path_changed&&result.source_link&&result.menu_closed&&result.label_visible?"CLICK_RESPONSE_PASS":"FAIL";
     }catch(e){result.status="ERROR";result.reason=String(e.message).slice(0,180);}
     cases.push(result);
     if(result.status!=="CLICK_RESPONSE_PASS")console.log("MENU 103 CLICK FAILURE "+JSON.stringify(result));
   }
   console.log("MENU 103 GROUP "+JSON.stringify({menu:rootMenu.label,total:targets.length,passed:cases.filter(x=>x.menu===rootMenu.label&&x.status==="CLICK_RESPONSE_PASS").length}));
 }
 await browser.close();
 const summary={clicked:cases.length,pass:cases.filter(c=>c.status==="CLICK_RESPONSE_PASS").length,fail:cases.filter(c=>c.status!=="CLICK_RESPONSE_PASS").length,mocked_429_fetches:requests,elapsed_ms:Date.now()-start,
   caveat:"Verifies every menu tap and explicit 429 fallback ONLY, not detailed data availability."};
 console.log("MENU 103 CLICK SUMMARY "+JSON.stringify(summary));
 if(summary.clicked!==103||summary.fail>0)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
