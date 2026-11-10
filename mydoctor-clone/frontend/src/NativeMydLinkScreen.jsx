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
 useEffect(()=>{
   setResult(null);setError("");setLoading(true);setShowDoctors(false);
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
      <p>원본 MyD 링크의 의사 검색 조건을 확인했습니다. 전체 의사 목록은 별도로 조회할 수 있습니다.</p>
      <button type="button" onClick={()=>setShowDoctors(x=>!x)}
       aria-expanded={showDoctors}>
       <Search size={17}/>{showDoctors?"의료진 목록 닫기":"원본 의사 목록 보기"}<ChevronRight size={17}/>
      </button>
      {showDoctors&&<NativeApiCatalog resource="doctor-list" title="원본 전체 의료진" go={go}/>}
      <p className="native-data-note">검색 조건과 원본 목록의 1:1 대응은 추가 검증 중입니다. 필터링된 결과로 표시하지 않습니다.</p>
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
