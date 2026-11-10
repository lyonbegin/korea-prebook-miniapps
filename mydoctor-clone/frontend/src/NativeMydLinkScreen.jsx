import React,{useEffect,useMemo,useState} from "react";
import {ArrowLeft,ChevronRight,Search,Stethoscope} from "lucide-react";
import {fetchNativeCatalog} from "./lib/originalGateway.js";
import NativeApiCatalog from "./NativeApiCatalog.jsx";

/** Hermes v96 fn 31795: getMydLink(mydLinkKey) -> GET patient-api/app/myd-link/{mydLinkKey}.
 * Navigation is based on a REAL key from home-menu API, not on a guessed web URL.
 * Linked doctor search only claims to be filtered when the original filtering
 * contract has actually been recovered and used. */
const dataOf=response=>response?.data?.data??response?.data??null;
const string=value=>typeof value==="string"?value:"";
function payloadFields(payload){
 if(!payload||typeof payload!=="object")return [];
 return Object.entries(payload).filter(([k,v])=>
  !/(?:token|auth|patient|user|email|phone|session|password)/i.test(k)&&
  ["string","number","boolean"].includes(typeof v)
 ).slice(0,18);
}
function routeKey(path){
 try{
   const input=decodeURIComponent(path.split("?")[0].split("/").pop()||"");
   return /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(input)?input:null;
 }catch{return null}
}
export default function NativeMydLinkScreen({route,title,go}){
 const key=useMemo(()=>routeKey(route),[route]);
 const [result,setResult]=useState(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [showDoctors,setShowDoctors]=useState(false);
 const [activeFilters,setActiveFilters]=useState([]);
 useEffect(()=>{
   setResult(null);setError("");setLoading(true);setShowDoctors(false);setActiveFilters([]);
   if(!key){setLoading(false);setError("유효한 원본 메뉴 키가 없습니다.");return}
   const controller=new AbortController();
   fetchNativeCatalog("myd-link",{myd_link_key:key},controller.signal)
    .then(data=>{if(!controller.signal.aborted)setResult(data)})
    .catch(err=>{if(!controller.signal.aborted)setError(err.message)})
    .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
   return ()=>controller.abort();
 },[key]);
 const payload=dataOf(result);
 const link=payload?.myd_link&&typeof payload.myd_link==="object"?payload.myd_link:payload;
 const heading=string(title)&&title!=="myd link"?title:
    string(payload?.name)||string(payload?.title)||string(link?.name)||"원본 메뉴";
 const typed=string(link?.link_type)||string(payload?.link_type);
 const doctorList=typed.toLowerCase().includes("doctor")||
   !!(link?.doctor_list_filter_rule||payload?.doctor_list_filter_rule);
 const rawFilters=link?.doctor_list_filter_rule?.search_filters||
    payload?.doctor_list_filter_rule?.search_filters;
 // 6.50.0 useDoctorFilter reads search_filters + default_filters. Only expose
 // valid identifiers from the original response. Never guess filter values.
 const searchFilters=(Array.isArray(rawFilters)?rawFilters:[]).map(item=>{
   const key=item?.key??item?.filter_key??item?.filterKey;
   return {key:typeof key==="string"?key:null,
      label:string(item?.name)||string(item?.label)||string(item?.title)||string(key)};
 }).filter(f=>f.key&&/^[A-Za-z0-9_-]{1,55}$/.test(f.key));
 const params=activeFilters.length?{search_filter_keys:activeFilters.join(",")}:{};
 return <div className="native-link-screen" data-native-link-key={key||""}>
  <div className="native-link-header">
   <span>나만의닥터 앱 메뉴</span>
   <h1>{heading}</h1>
   <p>원본 앱의 메뉴 키로 요청한 데이터를 표시합니다.</p>
  </div>
  {loading&&<p className="native-price-source-status" role="status">원본 메뉴의 연결 화면을 확인하고 있습니다.</p>}
  {error&&<div className="native-link-error" role="alert">
    <strong>원본 앱 링크 조회 실패</strong><p>{error}</p>
    <button type="button" onClick={()=>go("/")}>홈으로</button>
  </div>}
  {payload&&<>
    {typeof payload==="object"&&<div className="native-link-facts">
     {payloadFields(link).map(([name,value])=><div key={name}>
        <span>{name}</span><strong>{String(value)}</strong></div>)}
    </div>}
    {doctorList&&<section className="native-link-doctor">
      <div><Stethoscope size={19}/><h2>의료진 찾기</h2></div>
      <p>원본 앱의 의사 검색 조건과 정렬 기준을 읽었습니다. 아래 필터는 실제 응답에 포함된 값만 사용합니다.</p>
      {!!searchFilters.length&&<div className="native-link-filter-list" role="group" aria-label="원본 앱 의사 필터">
       {searchFilters.map(f=><button key={f.key} type="button"
        aria-pressed={activeFilters.includes(f.key)}
        className={activeFilters.includes(f.key)?"active":""}
        onClick={()=>setActiveFilters(old=>old.includes(f.key)?
          old.filter(x=>x!==f.key):[...old,f.key])}>{f.label}</button>)}
      </div>}
      <button type="button" onClick={()=>setShowDoctors(x=>!x)}
       aria-expanded={showDoctors}>
       <Search size={17}/>{showDoctors?"의료진 목록 닫기":"원본 의사 목록 보기"}<ChevronRight size={17}/>
      </button>
      {showDoctors&&<NativeApiCatalog resource="doctor-list"
        parameters={params}
        title={activeFilters.length?"선택 조건 의료진":"원본 전체 의료진"} go={go}/>}
      <p className="native-data-note">목록은 원본 의사 API의 실제 응답으로만 표시합니다. 원본 요청이 거부되는 조건은 오류로 구분합니다.</p>
    </section>}
    {!doctorList&&<section className="native-link-doctor">
     <p>원본에서 확인된 연결 유형: {typed||"분석 중"}</p>
     <button type="button" onClick={()=>go("/")}>
       <ArrowLeft size={17}/>원본 홈 메뉴로 돌아가기
     </button>
    </section>}
  </>}
 </div>;
}
