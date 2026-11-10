/* Native 6.50.0 ANONYMOUS public JSON production probe.
 * Never sends credentials. Records observed HTTP results as evidence; never
 * invents a JSON schema or treats 401/403/404 as an API success.
 * The probe is limited to the home-menu endpoint to avoid speculative
 * traffic to third-party service routes.
 */
const fs=require("fs");
const base=(process.env.MD_API_URL||"https://mydoctor-mobile-api-production.up.railway.app").replace(/\/$/,"");
const timeout=Number(process.env.MD_PROBE_TIMEOUT||16000);
(async()=>{
 const report={source:"XAPK Android 6.50.0",checkedAt:new Date().toISOString(),
   mode:"anonymous-GET",probe:"home-menu",inventory:null,cache:null,homeMenu:null,
   verifiedSource:false};
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
 const response=await query("/native/catalog/home-menu");
 const body=response.body;
 const valid=response.status===200&&body?.ok===true&&body?.data
    &&(typeof body.data==="object");
 report.homeMenu={http_status:response.status,source_http_status:body?.origin_http_status,
  cache:body?.cache||"MISS",data_source:body?.from||null,
  error:body?.error||response.error||null,
  json_type:valid?(Array.isArray(body.data)?"array":"object"):null,
  top_level_fields:valid&&!Array.isArray(body.data)?Object.keys(body.data).slice(0,45):[]};
 report.verifiedSource=Boolean(valid);
 fs.mkdirSync("qa-artifacts",{recursive:true});
 fs.writeFileSync("qa-artifacts/native-api-live-probe.json",JSON.stringify(report,null,2));
 console.log("NATIVE ORIGINAL API RUNTIME EVIDENCE",JSON.stringify(report,null,2));
 if(!valid)console.log("NATIVE_SOURCE_BLOCKED: original GET 200 JSON NOT verified. Do not claim full API integration or data parity.");
 else console.log("NATIVE_SOURCE_JSON_OBSERVED: status 200 and parseable JSON observed. Individual card schemas and screen parity still unverified.");
})().catch(e=>{console.error("Native probe tooling error",e);process.exitCode=1});
