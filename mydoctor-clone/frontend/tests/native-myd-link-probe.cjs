/* Android 6.50.0 Hermes 31795 MyD link test.
 * Public source key embedded literally in the supplied APK. No auth/cookies.
 * Logs only HTTP status and field names, never original response values.
 */
const fs=require("fs");
const origin=(process.env.MD_API_URL||"https://mydoctor-mobile-api-production.up.railway.app").replace(/\/$/,"");
const key="symptom-acneOralMedication";
(async()=>{
 const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),16000);
 let result={key_kind:"APK_static",function_id:31795,source_path:"patient-api/app/myd-link/{mydLinkKey}",
  method:"GET",gateway_status:null,source_status:null,fields:[],status:"UNVERIFIED"};
 try{
  const response=await fetch(origin+"/native/catalog/myd-link?myd_link_key="+encodeURIComponent(key),
    {headers:{Accept:"application/json"},signal:ctrl.signal});
  const json=await response.json().catch(()=>null);
  result.gateway_status=response.status;
  result.source_status=json?.origin_http_status||null;
  result.status=response.ok&&json?.ok?"ANONYMOUS_JSON_CONFIRMED":"NOT_PUBLICLY_VERIFIED";
  const envelope=json?.data?.data??json?.data;
  if(envelope&&typeof envelope==="object"&&!Array.isArray(envelope)){
    result.fields=Object.keys(envelope).slice(0,40);
    if(envelope.myd_link&&typeof envelope.myd_link==="object")
      result.nested_link_fields=Object.keys(envelope.myd_link).slice(0,30);
    result.link_type=typeof envelope.link_type==="string"?envelope.link_type:null;
    const filters=envelope.doctor_list_filter_rule?.search_filters;
    result.search_filter_count=Array.isArray(filters)?filters.length:null;
    result.search_filter_options=Array.isArray(filters)?filters.slice(0,8).map(x=>({
      field_names:x&&typeof x==="object"?Object.keys(x).slice(0,16):[],
      key:typeof x?.key==="string"?x.key:null,
      filter_key:typeof x?.filter_key==="string"?x.filter_key:null,
      name:typeof x?.name==="string"?x.name:null
    })):[];
    const sorts=envelope.doctor_list_sort_rule;
    result.sort_filter_count=Array.isArray(sorts?.sort_filters)?sorts.sort_filters.length:null;
    result.sort_default_filter_key=typeof sorts?.default_filter_key==="string"?sorts.default_filter_key:null;
  }
  result.error=json?.error||null;
 }catch(error){result.error=error.name||"ProbeError"}
 finally{clearTimeout(timer)}
 fs.mkdirSync("qa-artifacts",{recursive:true});
 fs.writeFileSync("qa-artifacts/native-myd-link-probe.json",JSON.stringify(result,null,2));
 console.log("ORIGINAL_MYD_LINK_CONTRACT",JSON.stringify(result));
})();
