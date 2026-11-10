/* Native 6.50.0 ANONYMOUS public JSON production probe.
 * Never sends credentials. Records observed HTTP results as evidence; never
 * invents a JSON schema or treats 401/403/404 as an API success.
 * Exactly one anonymous GET per catalog resource under study. No private or
 * reservation-mutation endpoints are included.
 */
const fs=require("fs");
const base=(process.env.MD_API_URL||"https://mydoctor-mobile-api-production.up.railway.app").replace(/\/$/,"");
const timeout=Number(process.env.MD_PROBE_TIMEOUT||16000);
(async()=>{
 const report={source:"XAPK Android 6.50.0",checkedAt:new Date().toISOString(),
   mode:"anonymous-GET",probe:"limited_catalog_paths",inventory:null,cache:null,
   resources:{},verifiedSource:false};
 async function query(path){
  const abort=new AbortController();
  const timer=setTimeout(()=>abort.abort(),timeout);
  try{
   const response=await fetch(base+path,{headers:{"accept":"application/json"},signal:abort.signal,
     redirect:"manual"});
   const body=await response.json().catch(()=>null);
   return {status:response.status,body};
  }catch(e){return {status:null,error:String(e.message)}}
  finally{clearTimeout(timer)}
 }
 const inv=await query("/native/catalog/inventory");
 report.inventory={http_status:inv.status,source:inv.body?.source,
   path_count:inv.body?.resources?.length,err:inv.error||null};
 const before=await query("/native/catalog/status");
 report.cache={http_status:before.status,
    observed_count:before.body?.observed_count,
    observed_resources:Object.keys(before.body?.observed_resources||{})};
 for(const resource of ["home-menu","home-banner","doctor-list","hospital-list","health-info",
 "app-faq","app-promotion","doctor-list-banner","doctor-sorting-filter","pharmacy-list"]){
   const response=await query("/native/catalog/"+resource);
   const body=response.body;
   const valid=response.status===200&&body?.ok===true&&body?.data
      &&(typeof body.data==="object");
   report.resources[resource]={
     http_status:response.status,source_http_status:body?.origin_http_status,
     cache:body?.cache||"MISS",data_source:body?.from||null,
     error:body?.error||response.error||null,
     json_type:valid?(Array.isArray(body.data)?"array":"object"):null,
     top_level_fields:valid&&!Array.isArray(body.data)?Object.keys(body.data).slice(0,45):[]
   };
 }
 report.verifiedSource=Boolean(report.resources["home-menu"]?.http_status===200);
 fs.mkdirSync("qa-artifacts",{recursive:true});
 fs.writeFileSync("qa-artifacts/native-api-live-probe.json",JSON.stringify(report,null,2));
 console.log("NATIVE ORIGINAL API RUNTIME EVIDENCE",JSON.stringify(report,null,2));
 for(const [name,item] of Object.entries(report.resources)){
  console.log(name,item.http_status===200?"NATIVE_JSON_OBSERVED":"NATIVE_SOURCE_UNVERIFIED_OR_BLOCKED",
    "gateway="+item.http_status,"origin="+(item.source_http_status||"not-reported"));
 }
 console.log("This is NOT screenshot or full app feature parity verification.");
})().catch(e=>{console.error("Native probe tooling error",e);process.exitCode=1});
