/** Read-only, public website gateway. No user credentials or patient data. */
const API=(import.meta.env.VITE_GATEWAY_BASE||"").replace(/\/$/,"");
export function originalUrl(route="/") {
  if(typeof route!=="string"||!route.startsWith("/")||route.startsWith("//"))throw Error("Invalid public route");
  return API+"/gateway/public-web"+route;
}
export async function fetchSource(route,signal){
  const response=await fetch(originalUrl(route),{headers:{Accept:"text/html","Accept-Language":"ko-KR,ko;q=0.9"},credentials:"omit",signal});
  if(!response.ok)throw Error("원본 공개 페이지 응답 "+response.status);
  return response.text();
}

/** Public-factual DB-first read. One original page fetch on cache MISS, thereafter PostgreSQL.
    No private/no-store original HTML is replicated into our DB. */
export async function fetchPublicFacts(route,signal){
 const url=API+"/catalog/page?path="+encodeURIComponent(route);
 const response=await fetch(url,{method:"GET",credentials:"omit",headers:{Accept:"application/json"},signal});
 const body=await response.json().catch(()=>null);
 if(!response.ok||!body?.ok){
    const status=body?.source_status||response.status;
    throw new Error("원본 데이터 조회 실패 ("+status+"). 저장된 공개 사실 데이터가 아직 없습니다.");
 }
 return body;
}

/** App 6.50.0 observed endpoint catalog, not legacy website HTML.
 * Native requests go through our allowlisted, DB-first Railway API.
 * This never forwards application credentials, cookies or patient data.
 */
const NATIVE_RESOURCES=new Set(["home-menu","myd-link","home-banner","app-faq","app-promotion",
 "doctor-list-banner","doctor-sorting-filter","pharmacy-list","app-config","doctor-list",
 "hospital-list","hospital-sortings","pharmacy-nearby","lowest-price-categories","lowest-price","health-info"]);
export async function fetchNativeCatalog(resource,parameters={},signal){
 if(!NATIVE_RESOURCES.has(resource))throw Error("원본 앱 자원 목록에 없습니다: "+resource);
 const query=new URLSearchParams();
 for(const [key,value] of Object.entries(parameters)){
   if(value!==undefined&&value!==null&&value!=="")query.append(key,String(value));
 }
 const url=API+"/native/catalog/"+resource+(query.size?"?"+query.toString():"");
 const response=await fetch(url,{method:"GET",credentials:"omit",headers:{Accept:"application/json"},signal});
 const body=await response.json().catch(()=>null);
 if(!response.ok||!body?.ok){
   const error=body?.error||"NATIVE_CATALOG_UNAVAILABLE";
   const e=new Error("원본 앱 API: "+error+" ("+(body?.origin_http_status||response.status)+")");
   e.details=body;e.status=response.status;throw e;
 }
 return body;
}
