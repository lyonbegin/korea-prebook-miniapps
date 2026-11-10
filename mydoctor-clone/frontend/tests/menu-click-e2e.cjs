/* User-journey regression: navigation is not a screenshot.
   Actually tap a menu section, then a public linked item; assert route
   renders a destination with source data, rather than just a changed URL.
   Results are captured even when a target fails (503, original 429, etc).
*/
const fs=require("node:fs"),{chromium}=require("playwright");
const menu=require("../src/data/original-menu-20261109.json");
const base=process.env.MD_URL||"http://127.0.0.1:5173";
const targets=[
 ["비대면진료","탈모"],
 ["가격비교","위고비"],
 ["병원찾기","야간 진료 병원"],
 ["약국찾기","약국찾기 전체 보기"],
 ["의약품 정보","의약품 정보 홈 · 약 검색"],
 ["건강 정보","의료진 Q&A"]
];
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const out=[],issues=[];
 page.on("pageerror",x=>issues.push(x.message));
 for(const [root,word] of targets){
   const rec={menu:root,item:word,status:"NOT_ATTEMPTED"};
   try{
     await page.goto(base+"/",{waitUntil:"domcontentloaded",timeout:20000});
     await page.locator('main h1').waitFor({timeout:14000});
     await page.getByRole("button",{name:"전체 메뉴"}).tap();
     const section=page.locator(".source-menu-section").filter({has:page.locator(".source-menu-root").filter({hasText:root})}).first();
     await section.locator("button.source-menu-root").tap();
     const item=section.locator(".source-menu-links a").filter({hasText:word}).first();
     await item.waitFor({state:"visible",timeout:5000});
     rec.href=await item.getAttribute("href");
     await item.tap();
     rec.url=new URL(page.url()).pathname;
     rec.url_changed=rec.url!=="/";
     rec.menu_closed=await page.locator(".source-menu").count()===0;
     try{await page.locator("main h1,main [role=alert]").first().waitFor({timeout:13000});}
     catch(e){rec.wait_reason=String(e.message).slice(0,100);}
     rec.alert=await page.locator('main [role=alert]').first().textContent().catch(()=>"");
     rec.title=await page.locator("main h1").first().textContent().catch(()=>"");
     rec.loading=await page.locator('main .loading').count()>0;
     rec.status=rec.url_changed&&rec.menu_closed&&rec.title&&!rec.alert?"PASS":"FAIL";
     if(rec.status==="PASS"){
       const links=page.locator('main a[href^="/"]');
       rec.detail_links=await links.count();
       if(rec.detail_links>0){
         const next=links.first(),destination=await next.getAttribute("href");
         if(destination&&destination!==new URL(page.url()).pathname){
           await next.tap();
           rec.clicked_child=destination;
           rec.child_url=new URL(page.url()).pathname;
           rec.child_url_changed=rec.child_url!==rec.url;
           try{await page.locator("main h1,main [role=alert]").first().waitFor({timeout:11000});}catch{}
           rec.child_title=await page.locator("main h1").first().textContent().catch(()=>"");
           rec.child_alert=await page.locator('main [role=alert]').first().textContent().catch(()=>"");
           if(!rec.child_url_changed||!rec.child_title||rec.child_alert)rec.status="CHILD_FAIL";
         }
       }
     }
   }catch(e){rec.status="ERROR";rec.reason=String(e.message).slice(0,250);}
   finally{out.push(rec);console.log("REAL MENU CLICK "+JSON.stringify(rec))}
 }
 await browser.close();
 fs.mkdirSync("qa-artifacts",{recursive:true});
 fs.writeFileSync("qa-artifacts/real-menu-clicks.json",JSON.stringify({cases:out,browser_errors:issues},null,2));
 console.log("REAL MENU CLICK SUMMARY "+JSON.stringify(out.reduce((s,x)=>(s[x.status]=(s[x.status]||0)+1,s),{})));
 if(out.some(r=>r.status!=="PASS")||issues.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});