import React,{useEffect,useState} from "react";
import {ChevronDown,ChevronRight,Stethoscope} from "lucide-react";
import {fetchNativeCatalog} from "./lib/originalGateway.js";
import NativeApiCatalog from "./NativeApiCatalog.jsx";
import {observedWebPath} from "./nativeDataAdapters.js";

function arrayFromResponse(result){
 const body=result?.data?.data??result?.data??{};
 return Array.isArray(body?.results)?body.results:Array.isArray(body)?body:[];
}
/**
 * Android 6.50.0: GET doctor/sorting-filter returns 5 original sort filters,
 * GET app/doctor-list-banner returns 1 original doctor banner.
 * Sorting selections use Hermes-confirmed doctor-list sort_filter_key property.
 * Never populate fake medical provider rows or silently ignore a click.
 */
export default function NativeDoctorDirectory({go}){
 const [filters,setFilters]=useState([]);
 const [banners,setBanners]=useState([]);
 const [selected,setSelected]=useState("");
 const [notice,setNotice]=useState("");
 const [bannerDetail,setBannerDetail]=useState(null);
 useEffect(()=>{
   const ctrl=new AbortController();
   fetchNativeCatalog("doctor-sorting-filter",{},ctrl.signal)
    .then(res=>setFilters(arrayFromResponse(res).filter(v=>
      typeof v?.key==="string"&&typeof v?.title==="string")))
    .catch(e=>{if(!ctrl.signal.aborted)setNotice("원본 정렬 조건 조회 실패: "+e.message)});
   fetchNativeCatalog("doctor-list-banner",{},ctrl.signal)
    .then(res=>setBanners(arrayFromResponse(res).filter(v=>v&&typeof v==="object")))
    .catch(()=>{});
   return ()=>ctrl.abort();
 },[]);
 function applyFilter(filter){
   if(filter.required_auth===true){
     setNotice("이 정렬은 원본 앱에서 로그인이 필요한 항목입니다.");return;
   }
   if(filter.required_location===true){
     setNotice("이 정렬은 원본 앱에서 위치 정보가 필요한 항목입니다.");return;
   }
   setNotice("");
   setSelected(old=>old===filter.key?"":filter.key);
 }
 return <section className="native-doctor-directory" aria-label="원본 앱 의사 목록 데이터">
  {!!banners.length&&<div className="native-doctor-banner-list">
    {banners.map((banner,i)=>{
     const url=banner.title_image_url;
     const src=typeof url==="string"&&url.startsWith("https://")?url:null;
     const external=observedWebPath(banner.link);
     const body=<>{src&&<img src={src} alt={typeof banner.title==="string"?banner.title:"원본 앱 의료진 배너"}/>}
      {typeof banner.title==="string"&&<strong>{banner.title}</strong>}</>;
     return external?<a key={banner.id??i} href={external} onClick={e=>{
       e.preventDefault();go(external,{label:banner.title})}}>{body}</a>:
      <button key={banner.id??i} type="button"
       onClick={()=>setBannerDetail(banner)}>{body}</button>;
    })}
  </div>}
  {!!filters.length&&<div className="native-doctor-sort" role="group" aria-label="원본 앱 의사 정렬">
   {filters.map((filter,i)=><button key={filter.key+"-"+i} type="button"
      aria-pressed={selected===filter.key}
      className={selected===filter.key?"active":""} onClick={()=>applyFilter(filter)}>
      {filter.title}<ChevronDown size={15}/>
    </button>)}
  </div>}
  {!!notice&&<p className="native-price-source-status" role="status">{notice}</p>}
  <NativeApiCatalog resource="doctor-list" title="원본 앱 의료진 목록"
    parameters={selected?{sort_filter_key:selected}:{}} go={go}/>
  {bannerDetail&&<div className="native-data-overlay"
    onMouseDown={e=>{if(e.target===e.currentTarget)setBannerDetail(null)}}>
    <section className="native-data-dialog" role="dialog" aria-modal="true" aria-label="의료진 배너 정보">
     <div className="native-data-dialog-head">
       <h2>{bannerDetail.title||"원본 의료진 배너"}</h2>
       <button type="button" onClick={()=>setBannerDetail(null)}>닫기</button>
     </div>
     {typeof bannerDetail.title_image_url==="string"&&
      bannerDetail.title_image_url.startsWith("https://")&&<img className="native-data-detail-image"
       src={bannerDetail.title_image_url} alt=""/>}
     <p className="native-data-note">원본 배너의 연결 주소가 확인되지 않아 임의의 페이지로 이동시키지 않았습니다.</p>
    </section>
   </div>}
 </section>;
}
