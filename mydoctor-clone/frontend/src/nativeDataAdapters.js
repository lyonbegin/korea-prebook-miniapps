/** 6.50.0 response shapes actually observed in Railway native API runtime logs.
 *   home-menu:    {status, data: [20 entries]}
 *   home-banner:  {status, data: {results: [8 entries]}}
 *   doctor-list:  {status, data: {results: [10 entries],count,next}}
 *
 * Extract values from real JSON; never fabricate provider names, prices, links.
 */
const WEB_HOST="https://my-doctor.io";

const text=(x)=>typeof x==="string"?x.trim():"";
const image=(x)=>typeof x==="string"&&/^https:\/\//.test(x)?x:null;
export function observedWebPath(value){
 const candidate=typeof value==="string"?value:
   value&&typeof value==="object"?(value.url||value.web_url||value.deeplink_url||""):null;
 if(!candidate||typeof candidate!=="string")return null;
 try{
  const u=new URL(candidate,WEB_HOST);
  const validPath=/^\/(?:telemedicine|medical-cost|hospital|pharmacy|dept-hub|medicine|healthLab|qna)(?:\/|$)/;
  if(u.origin===WEB_HOST&&validPath.test(u.pathname))return u.pathname+u.search;
 }catch{}
 return null;
}
function sourceEnvelope(data){
 return data?.status!==undefined&&data?.data!==undefined?data.data:data;
}
export function nativeHomeMenuItems(data){
 const body=sourceEnvelope(data);
 if(!Array.isArray(body))return [];
 return body.filter(x=>x&&typeof x==="object"&&text(x.name)).map(x=>({
  id:x.id,
  label:text(x.name),
  subtitle:text(x.description),
  image:image(x.icon_image_url)||image(x.image_url),
  icon_name:text(x.icon_name),
  path:observedWebPath(x.myd_link?.deeplink_url),
  nativeLink:x.myd_link||null,
  raw:x
 }));
}
export function nativeHomeBanners(data){
 const body=sourceEnvelope(data);
 const rows=Array.isArray(body?.results)?body.results:Array.isArray(body)?body:[];
 return rows.filter(x=>x&&typeof x==="object"&&image(x.image_url)).map(x=>({
  id:x.id,
  image:image(x.image_url),
  path:observedWebPath(x.link),
  color:typeof x.background_color==="string"&&/^#[0-9a-f]{3,8}$/i.test(x.background_color)?x.background_color:null,
  raw:x
 }));
}
const nameOf=(p)=>text(p?.name)||text(p?.doctor_name)||text(p?.doctorName)||
 text(p?.display_name)||text(p?.fullName)||text(p?.nickname);
export function nativeDoctorItems(data){
 const body=sourceEnvelope(data);
 const rows=Array.isArray(body?.results)?body.results:Array.isArray(body)?body:[];
 return rows.filter(x=>x&&typeof x==="object").map(x=>{
  const profile=x.profile&&typeof x.profile==="object"?x.profile:{};
  const hospital=x.hospital&&typeof x.hospital==="object"?x.hospital:{};
  const name=nameOf(profile)||nameOf(x);
  const hospitalName=nameOf(hospital);
  const images=Array.isArray(x.doctor_images)?x.doctor_images:[];
  const profileImage=image(profile.profile_image_url)||image(profile.image_url)||
   image(x.profile_image_url)||image(images[0]?.image_url)||
   image(images[0]?.url);
  return {
   id:x.id??x.doctor_id,
   label:name||((x.id??x.doctor_id)!==undefined?"의사 ID "+String(x.id??x.doctor_id):"의료진"),
   subtitle:hospitalName,
   image:profileImage,
   review_count:typeof x.total_review_count==="number"?x.total_review_count:null,
   can_reserve:x.can_reserve===true,
   path:observedWebPath(x.web_url)||observedWebPath(x.url),
   raw:x,
  };
 });
}
