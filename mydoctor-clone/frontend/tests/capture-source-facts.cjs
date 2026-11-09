/**
 * Bounded collection of original public factual metadata for the 29 selected
 * UI templates. No HTML, personal records, article text, doctor review bodies
 * or authenticated content is stored. Merges with the versioned source
 * observations, and never invents clinic/provider/price data.
 *
 * Source: https://my-doctor.io/  via real 390x844 mobile Playwright browser.
 */
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const cases=require("../src/data/representative-29.json").cases;
const dest=path.resolve(__dirname,"../../backend/data/public_source_facts_20261109.json");
const origin="https://my-doctor.io";
const secure=x=>!/(patient|password|token|auth|session|email|cookie|payment|user_?id|private|order_?id)/i.test(x);
function merge(newData,old){
 if(!old)return newData;
 const map=new Map();
 for(const link of [...(old.links||[]),...(newData.links||[])]) {
  if(!link.path||!link.label||!secure(link.path))continue;
  map.set(link.path,link);
 }
 const oldRows=(old.tables||[]).reduce((n,t)=>n+(t.rows||[]).length,0);
 const newRows=(newData.tables||[]).reduce((n,t)=>n+(t.rows||[]).length,0);
 const merged={...old, ...newData,links:[...map.values()].slice(0,180),
   tables:newRows>=oldRows?newData.tables:old.tables,
   address:newData.address||old.address};
 const changed=merged.links.length>(old.links||[]).length||
  (merged.headings||[]).length>(old.headings||[]).length||
  Math.max(newRows,oldRows)>oldRows||
  (!!merged.headline&&!old.headline);
 if(!changed)return old;
 merged.quality="verified_public_facts_from_browser";
 return merged;
}
async function capture(){
 const rows=JSON.parse(fs.readFileSync(dest,"utf8"));
 const byPath=new Map(rows.map(x=>[x.path,x]));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 let examined=0,changed=0,blocked=0;
 try{
  for(const c of cases){
   const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
   try{
    const res=await page.goto(origin+c.path,{waitUntil:"domcontentloaded",timeout:14000});
    const status=res?.status();
    if(status===403||status===429){blocked++;console.log("SOURCE RATE LIMITED",c.id,status);break;}
    if(status!==200){console.log("SOURCE UNAVAILABLE",c.id,status);continue;}
    examined++;
    const model=await page.evaluate(()=>{
      const origin="https://my-doctor.io";
      const main=document.querySelector("main")||document.body;
      const text=n=>(n?.innerText||n?.textContent||"").replace(/\s+/g," ").trim();
      const htmlSections=[...main.querySelectorAll("h2,h3")].map(x=>text(x).slice(0,100)).filter(Boolean).slice(0,35);
      const links=[],seen=new Set();
      for(const a of main.querySelectorAll('a[href]')){
        if(a.closest("nav,header,footer"))continue;
        let u;try{u=new URL(a.href,origin)}catch{continue}
        if(u.origin!==origin||u.pathname.length>1500||/(token|auth|session|patient|email|password|private|cookie)/i.test(u.search))continue;
        const href=u.pathname+u.search,label=text(a).slice(0,85);
        if(!label||seen.has(href)||links.length>=180)continue;
        seen.add(href);links.push({path:href,label,evidence:"github_actions_live_public_page_link"});
      }
      let tables=[];
      const useTables=/^\/(hospital|medical-cost|medicine|pharmacy|map)/.test(location.pathname);
      if(useTables){
        tables=[...main.querySelectorAll("table")].slice(0,10).map(t=>({
          headers:[...t.querySelectorAll("thead th")].slice(0,10).map(c=>text(c).slice(0,90)),
          rows:[...t.querySelectorAll("tbody tr")].slice(0,60).map(row=>
            [...row.querySelectorAll("td,th")].slice(0,10).map(cell=>text(cell).slice(0,90))
          ).filter(r=>r.length>=2&&r.some(s=>/\d/.test(s)))
        })).filter(t=>t.rows.length>0);
      }
      let address="";
      if(location.pathname==="/hospital/detail"){
        const nodes=[...main.querySelectorAll("p,span")].slice(0,120);
        address=nodes.map(text).find(s=>s.length>10&&s.length<140&&/(시|군|구).*(로|길|동)/.test(s))||"";
      }
      return {
        title:document.title.slice(0,220),
        headline:text(main.querySelector("h1")).slice(0,220),
        headings:htmlSections,links,tables,address
      };
    });
    const old=byPath.get(c.path);
    const now={...old,...model,original_url:origin+c.path,path:c.path,
      source_evidence:"github-actions-live-origin-http-200-factual-metadata",
      observed_at:new Date().toISOString()};
    const result=merge(now,old);
    if(result!==old){changed++;byPath.set(c.path,result)}
    console.log("FACT CAPTURE",c.id,JSON.stringify({
      source_http:status,headings:model.headings.length,links:model.links.length,
      table_rows:model.tables.reduce((n,t)=>n+t.rows.length,0),
      changed:result!==old
    }));
   }catch(e){console.error("CAPTURE FAILED",c.id,String(e.message).slice(0,180))}
   finally{await page.close()}
  }
 }finally{await browser.close();}
 const ordered=rows.map(r=>byPath.get(r.path)||r);
 fs.writeFileSync(dest,JSON.stringify(ordered,null,2)+"\n","utf8");
 console.log("PUBLIC SOURCE FACT CAPTURE SUMMARY",JSON.stringify({
  original_http200_pages:examined,enhanced:changed,rate_limited:blocked,
  current_fact_records:ordered.length,content_rule:"public factual metadata only"
 }));
}
capture().catch(e=>{console.error(e);process.exitCode=1});
