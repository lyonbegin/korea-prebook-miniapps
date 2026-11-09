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
