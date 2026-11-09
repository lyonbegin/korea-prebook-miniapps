/** Exact top-level menu and link inventory audit. Does not assert content parity. */
const {chromium}=require("playwright");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const menu=require("../src/data/original-menu-20261109.json");
const base=process.env.MD_URL||"http://127.0.0.1:5173";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const tested=[],failures=[],notTested=[];
 try{
  await page.goto(base+"/",{waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:"전체 메뉴"}).tap();
  const roots=page.locator(".source-menu-root");
  assert.equal(await roots.count(),menu.roots.length,"Root menu count");
  for(let i=0;i<menu.roots.length;i++){
    const root=menu.roots[i];await roots.nth(i).tap();
    const visible=await page.locator(".source-menu-group h3").allTextContents();
    assert.deepEqual(visible,root.groups.map(g=>g.title),"Group label mismatch "+root.label);
    const actual=await page.locator(".source-menu a[data-source-href]").evaluateAll(a=>a.map(x=>({
      label:(x.textContent||"").trim(),href:x.getAttribute("href")
    })));
    const expected=root.groups.flatMap(g=>g.links);
    for(const item of expected){
      const matches=actual.filter(x=>x.href===item.href&&x.label===item.label);
      if(matches.length!==1)failures.push({menu:root.label,label:item.label,href:item.href,problem:"missing/duplicate link"});
      else tested.push({menu:root.label,label:item.label,href:item.href,menu_link:"MATCH",leaf_data:"UNVERIFIED"});
    }
    await roots.nth(i).tap();
  }
  const total=menu.roots.reduce((n,r)=>n+r.groups.reduce((m,g)=>m+g.links.length,0),0);
  assert.equal(tested.length,total,"Source menu link parity");
 }catch(e){failures.push({problem:String(e.stack||e)});}
 finally{
   fs.mkdirSync("qa-artifacts",{recursive:true});
   const unique=[...new Set(tested.map(x=>x.href))];
   const report={original_observed_at:menu.observed_at,root_menus:menu.roots.length,
      submenu_groups:menu.roots.flatMap(x=>x.groups).filter(x=>x.title!=="주요 항목").length,
      total_menu_links:menu.total_links,unique_source_routes:menu.unique_routes,
      matched_labels_and_hrefs:tested.length,unique_link_targets:unique.length,
      live_data_routes_verified:0,leaf_click_paths_verified:0,
      meaning:"Menu links only. Original data, nested navigation, and actual source UI are unverified.",
      failures,tested};
   fs.writeFileSync("qa-artifacts/menu-route-inventory.json",JSON.stringify(report,null,2));
   console.log("MENU INVENTORY",JSON.stringify({root_menus:report.root_menus,submenu_groups:report.submenu_groups,total:report.total_menu_links,matched:tested.length,unique:unique.length,leaf_data_verified:0,failures:failures.length}));
   await browser.close();
 }
 if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});