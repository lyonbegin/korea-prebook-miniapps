/** Real deployed native API integration proof; no fabricated response data.
 * First native categories(vertical_key=mounjaro), then native regions(category_id)
 * extracted from the ORIGINAL response, then repeat for PostgreSQL cache HIT.
 * Original app 6.50.0 Hermes bytecode recovered URL and config keys.
 */
const fs=require("fs");
const base=(process.env.MD_API_URL||"https://mydoctor-mobile-api-production.up.railway.app").replace(/\/$/,"");
const report={source:"Android 6.50.0 Hermes reconstructed endpoints",checked_at:new Date().toISOString(),
 stages:[],result:"BLOCKED"};
async function read(path){
 const abort=new AbortController();
 const timer=setTimeout(()=>abort.abort(),18000);
 try{
   const res=await fetch(base+path,{headers:{Accept:"application/json"},signal:abort.signal});
   return {status:res.status,body:await res.json().catch(()=>null)};
 } finally {clearTimeout(timer)}
}
(async()=>{
 const categories=await read("/native/catalog/lowest-price-categories?vertical_key=mounjaro");
 const options=categories.body?.data?.data?.categories;
 const stage1={stage:"categories",status:categories.status,cache:categories.body?.cache,
  original_status:categories.body?.origin_http_status,
  item_count:Array.isArray(options)?options.length:0,error:categories.body?.error||null};
 report.stages.push(stage1);
 if(categories.status!==200||!Array.isArray(options)||!options.length)throw Error("Original native Mounjaro categories did not arrive");
 const observedId=options[0]?.id;
 if(!Number.isInteger(observedId)&&!/^\d+$/.test(String(observedId)))throw Error("Original category id absent");
 const url="/native/catalog/lowest-price?category_id="+encodeURIComponent(String(observedId));
 const price=await read(url);
 const priceData=price.body?.data?.data;
 const regions=priceData?.regions;
 report.stages.push({stage:"price-regions",status:price.status,cache:price.body?.cache,
  original_status:price.body?.origin_http_status,regions_count:Array.isArray(regions)?regions.length:0,
  has_national_lowest_price:typeof priceData?.national_lowest_price==="number",
  error:price.body?.error||null});
 if(price.status!==200||!Array.isArray(regions)||!regions.length)throw Error("Original regional price data unavailable");
 const repeat=await read(url);
 report.stages.push({stage:"repeat",status:repeat.status,cache:repeat.body?.cache,
  same_region_count:repeat.body?.data?.data?.regions?.length===regions.length});
 if(repeat.status!==200||repeat.body?.data?.data?.regions?.length!==regions.length)
  throw Error("Repeated original category result not present");
 report.result=repeat.body?.cache==="HIT"?"ORIGINAL_JSON_AND_DB_HIT":"ORIGINAL_JSON_OBSERVED_CACHE_UNVERIFIED";
})().catch(error=>{report.error=String(error.message||error);process.exitCode=1})
.finally(()=>{
 fs.mkdirSync("qa-artifacts",{recursive:true});
 fs.writeFileSync("qa-artifacts/native-price-api-parity.json",JSON.stringify(report,null,2));
 console.log("NATIVE PRICE RUNTIME CHECK",JSON.stringify(report,null,2));
});
