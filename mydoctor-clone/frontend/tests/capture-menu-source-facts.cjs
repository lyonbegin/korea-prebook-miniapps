/** Persist source-backed menu destination facts after original HTTP 200.
 * Raw HTML, user information, medical article bodies, photos and review text are NOT retained.
 * This closes the gap where 103 actual menu destinations point to pages that lack DB facts.
 */
const fs=require("node:fs"),path=require("node:path"),{chromium}=require("playwright");
const menu=require("../src/data/original-menu-20261109.json");
const original="https://my-doctor.io";
const seed=path.resolve(__dirname,"../../backend/data/public_menu_facts_20261110.json");
const reference=path.resolve(__dirname,"../../backend/data/public_source_facts_20261109.json");
const banned=/(token|auth|session|patient|email|password|private|cookie|payment|order|user_?id)/i;
const decode=p=>{try{return decodeURIComponent(p.split("?")[0])}catch{return p}};
async function capture(){
 const known=JSON.parse(fs.readFileSync(reference,"utf8"));
 const previous=fs.existsSync(seed)?JSON.parse(fs.readFileSync(seed,"utf8")):[];
 const byPath=new Map(previous.map(v=>[decode(v.path),v]));
 const already=new Set(known.map(v=>decode(v.path)));
 const targets=[...new Set(menu.roots.flatMap(r=>r.groups.flatMap(g=>g.links.map(l=>l.href))))]
   .filter(p=>!already.has(decode(p))&&!byPath.has(decode(p))&&!banned.test(p));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 let checked=0,verified=0,blocked=0,unavailable=0;
 const save=()=>fs.writeFileSync(seed,JSON.stringify([...byPath.values()],null,2)+"\n","utf8");
 try{
  for(const href of targets){
   const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
   let status=0;
   try{
    const response=await page.goto(original+href,{waitUntil:"domcontentloaded",timeout:11500});
    status=response?.status()||0;checked++;
    if(status===403||status===429){blocked++;console.log("MENU SOURCE BLOCKED "+JSON.stringify({href,status,checked}));break;}
    if(status!==200){unavailable++;console.log("MENU SOURCE NOT200 "+JSON.stringify({href,status}));continue;}
    const d=await page.evaluate(()=>{
      const main=document.querySelector("main")||document.body;
      const origin="https://my-doctor.io";
      const txt=x=>(x?.innerText||x?.textContent||"").replace(/\s+/g," ").trim();
      const links=[],seen=new Set();
      for(const a of main.querySelectorAll("a[href]")){
       if(a.closest("nav,header,footer"))continue;
       let u;try{u=new URL(a.href,origin)}catch{continue}
       if(u.origin!==origin||u.pathname.length>1500||/(token|auth|session|patient|email|password|private|cookie)/i.test(u.search))continue;
       const target=u.pathname+u.search,label=txt(a).slice(0,85);
       if(!label||seen.has(target)||links.length>=180)continue;
       seen.add(target);links.push({path:target,label,evidence:"github_actions_live_public_page_link"});
      }
      const headings=[...main.querySelectorAll("h2,h3")].map(h=>txt(h).slice(0,100)).filter(Boolean).slice(0,35);
      const tables=/^\/(hospital|medical-cost|medicine|pharmacy|map)/.test(location.pathname)?
       [...main.querySelectorAll("table")].slice(0,10).map(t=>({
        headers:[...t.querySelectorAll("thead th")].slice(0,10).map(c=>txt(c).slice(0,90)),
        rows:[...t.querySelectorAll("tbody tr")].slice(0,60).map(tr=>
          [...tr.querySelectorAll("td,th")].slice(0,10).map(td=>txt(td).slice(0,90))
        ).filter(r=>r.length>=2&&r.some(v=>/\d/.test(v)))
       })).filter(t=>t.rows.length>0):[];
      const title=document.title.slice(0,220),headline=txt(main.querySelector("h1")).slice(0,220);
      return {title,headline,headings,links,tables};
    });
    if(!d.title||!d.headline){unavailable++;console.log("MENU SOURCE NO MAIN H1 "+href);continue;}
    const route=decode(href);
    const result={original_url:original+route,path:route,...d,quality:"verified_public_facts_from_browser",
      source_evidence:"github-actions-live-origin-http-200-factual-metadata",observed_at:new Date().toISOString()};
    byPath.set(route,result);verified++;save();
    console.log("MENU SOURCE SAVED "+JSON.stringify({href,status,title:d.headline,links:d.links.length,tables:d.tables.length}));
   }catch(e){unavailable++;console.log("MENU SOURCE READ FAILED "+JSON.stringify({href,status,reason:String(e.message).slice(0,120)}));}
   finally{await page.close()}
  }
 }finally{await browser.close();save()}
 console.log("MENU SOURCE FACT SUMMARY "+JSON.stringify({menu_links:103,seed_existing_29:known.length,previous_menu_records:previous.length,missing_targets:targets.length,checked,verified,blocked,unavailable,total_menu_records:byPath.size}));
}
capture().catch(e=>{console.error(e);process.exitCode=1});