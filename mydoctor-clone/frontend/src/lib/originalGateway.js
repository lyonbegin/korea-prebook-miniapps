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
