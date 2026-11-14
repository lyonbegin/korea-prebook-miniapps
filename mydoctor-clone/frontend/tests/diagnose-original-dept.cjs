const {chromium}=require("playwright");
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},locale:"ko-KR"});
 const url="https://my-doctor.io/dept-hub/"+encodeURIComponent("피부과")+"/"+encodeURIComponent("서울");
 const result={};
 page.on("response",r=>{if(r.url()===url)result.status=r.status()});
 try{
 await page.goto(url,{waitUntil:"domcontentloaded",timeout:40000});
 await page.waitForTimeout(1500);
 const info=await page.evaluate(()=>{
  const tables=Array.from(document.querySelectorAll("table")).map((t,i)=>({
   index:i,headers:Array.from(t.querySelectorAll("thead th")).map(h=>h.textContent.trim()),
   rowCount:t.querySelectorAll("tbody tr").length,
   first:Array.from(t.querySelectorAll("tbody tr")).slice(0,2).map(tr=>({
    cells:Array.from(tr.querySelectorAll("td")).map(c=>c.innerText.trim().slice(0,120)),
    links:Array.from(tr.querySelectorAll("a[href]")).map(a=>({text:a.innerText,href:a.getAttribute("href")})).slice(0,3)
   })),
  }));
  return {title:document.title,h1:document.querySelector("h1")?.innerText,
   tableCount:tables.length,tables:tables.slice(0,12),
   links: Array.from(document.querySelectorAll("a[href*='/hospital/']")).slice(0,12).map(a=>({text:a.innerText.slice(0,90),href:a.getAttribute("href")})),
   nextData:!!document.getElementById("__NEXT_DATA__")
  };
 });
 Object.assign(result,info);
 }catch(e){result.error=String(e)}finally{await browser.close()}
 console.log("ORIGINAL_DEPT_BROWSER_DIAGNOSTIC",JSON.stringify(result));
 if(!result.tables?.length)process.exitCode=2;
})().catch(e=>{console.error(e);process.exit(1)});
