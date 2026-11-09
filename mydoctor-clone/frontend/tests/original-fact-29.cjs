/* Compare every fetched original factual route against what the clone really renders.
   All expectations were captured from the ORIGINAL public HTTP200 in GitHub Actions.
   This is not a visual test; no credit is given for title-only snapshots.
*/
const fs=require("fs"),{chromium}=require("playwright");
const expected=require("../../backend/data/public_source_facts_20261109.json");
const out="qa-artifacts",root=process.env.MD_URL||"http://127.0.0.1:5173";
const skip=new Set(["비대면진료","가격비교","병원찾기","약국찾기","의약품 정보","건강 정보","나만의닥터"]);
const normalize=x=>String(x||"").replace(/\s+/g,"").toLowerCase();
const urlkey=x=>{try{const u=new URL(x,"https://my-doctor.io");return decodeURIComponent(u.pathname+u.search)}catch{return null}};
const unique=a=>[...new Set(a)];
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const checks=[];
 try{
  for(const expectedPage of expected){
   const record={path:expectedPage.path,source_quality:expectedPage.quality,status:"NOT_VERIFIED"};
   const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
   try{
    const nav=await page.goto(root+expectedPage.path,{waitUntil:"domcontentloaded",timeout:16000});
    record.http=nav?.status()||0;
    await page.locator('h1,[role=alert]').first().waitFor({timeout:14000});
    if(record.http!==200||await page.locator('[role=alert]').count()){
      record.status="CLONE_DATA_UNAVAILABLE";continue;
    }
    const observed=await page.evaluate(()=>{
      const main=document.querySelector("main")||document.body;
      const text=x=>(x?.innerText||x?.textContent||"").replace(/\s+/g," ").trim();
      return{
        headline:text(main.querySelector("h1")),
        headings:[...main.querySelectorAll("h2,h3")].map(text).filter(Boolean),
        hrefs:[...main.querySelectorAll("a[href]")].map(a=>a.href),
        tables:[...main.querySelectorAll("table")].map(t=>
          [...t.querySelectorAll("tbody tr")].map(tr=>
            [...tr.querySelectorAll("td,th")].map(text)))
      };
    });
    record.headline_match=normalize(observed.headline)===normalize(expectedPage.headline||expectedPage.title);
    const sourceLinks=unique((expectedPage.links||[])
       .map(x=>urlkey(x.path)).filter(x=>x&&x!=="/"));
    const visibleLinks=new Set(observed.hrefs.map(urlkey).filter(Boolean));
    const matched=sourceLinks.filter(x=>visibleLinks.has(x)).length;
    record.original_internal_links=sourceLinks.length;
    record.rendered_matching_links=matched;
    record.link_coverage=sourceLinks.length?+(matched/sourceLinks.length).toFixed(3):1;
    const headings=(expectedPage.headings||[]).filter(x=>!skip.has(x));
    const matchHeadings=headings.filter(h=>observed.headings.some(v=>normalize(v)===normalize(h)));
    record.original_section_headings=headings.length;
    record.rendered_matching_headings=matchHeadings.length;
    record.heading_coverage=headings.length?+(matchHeadings.length/headings.length).toFixed(3):1;
    const sourceRows=(expectedPage.tables||[]).flatMap(t=>t.rows||[]);
    const outputRows=observed.tables.flat();
    const matchedRows=sourceRows.filter(r=>outputRows.some(row=>r.length===row.length&&r.every((cell,i)=>normalize(cell)===normalize(row[i]))));
    record.source_factual_table_rows=sourceRows.length;
    record.exact_matching_price_rows=matchedRows.length;
    record.table_coverage=sourceRows.length?+(matchedRows.length/sourceRows.length).toFixed(3):1;
    record.status=!record.headline_match?"TITLE_MISMATCH":
      record.table_coverage<1?"TABLE_ROW_MISSING":
      record.link_coverage<.9?"LINK_COVERAGE_GAP":
      record.heading_coverage<.75?"SECTION_HEADING_GAP":"FACTUAL_FIELDS_MATCH";
   }catch(e){record.status="ERROR";record.reason=String(e.message).slice(0,200)}
   finally{await page.close();checks.push(record);console.log("ORIGINAL FACT PARITY",JSON.stringify(record))}
  }
 }finally{await browser.close()}
 const totals=checks.reduce((o,c)=>(o[c.status]=(o[c.status]||0)+1,o),{});
 const factual=checks.filter(x=>x.status==="FACTUAL_FIELDS_MATCH").length;
 const obj={verified_factual_routes:factual,total:checks.length,summary:totals,cases:checks,
   notice:"Only source-backed headings, public links and table data. Does not prove complete original content or UI/booking parity."};
 fs.writeFileSync(out+"/factual-29.json",JSON.stringify(obj,null,2));
 console.log("ORIGINAL FACT PARITY SUMMARY",JSON.stringify({verified_factual_routes:factual,total:checks.length,summary:totals}));
 if(factual!==checks.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
