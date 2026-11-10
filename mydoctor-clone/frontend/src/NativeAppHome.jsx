import React,{useEffect,useState} from "react";
import {
  Stethoscope,Hospital,Tags,Pill,ChevronRight,MapPin,
  Clock3,Search,HeartPulse,Syringe,FileText,MessageCircle,
  Activity,CalendarDays
} from "lucide-react";
import NativeApiCatalog,{normalizeNativeCards} from "./NativeApiCatalog.jsx";
import {fetchNativeCatalog} from "./lib/originalGateway.js";

/** Mobile-web implementation of the app-oriented service hierarchy.
 * Reference build: MyDoctor 6.50.0 XAPK, React Native/Hermes UI resources.
 * Public links keep the app's on-demand DB/source-data lifecycle.
 * This screen does not claim an exact screenshot or source JSX reconstruction.
 */
const appSymptoms=[
 {label:"감기·비염",path:"/telemedicine/감기-비대면진료-예약",icon:Activity,tone:"sky"},
 {label:"소아과",path:"/telemedicine/소아과-소아청소년과-비대면진료-예약",icon:HeartPulse,tone:"peach"},
 {label:"탈모약 처방",path:"/telemedicine/탈모-비대면진료-예약",icon:Pill,tone:"coral"},
 {label:"여드름·피부",path:"/telemedicine/여드름-비대면진료-예약",icon:Stethoscope,tone:"rose"},
 {label:"다이어트",path:"/medical-cost/다이어트약",icon:Tags,tone:"orange"},
 {label:"여성질환",path:"/telemedicine/산부인과-비대면진료-예약",icon:HeartPulse,tone:"pink"},
 {label:"안과·인공눈물",path:"/telemedicine/안과-비대면진료-예약",icon:Activity,tone:"slate"},
 {label:"헤르페스",path:"/telemedicine/헤르페스-비대면진료-예약",icon:Stethoscope,tone:"blue"},
 {label:"당뇨·고혈압",path:"/telemedicine/고혈압-비대면진료-예약",icon:Syringe,tone:"mint"}
];
const appBookings=[
 {label:"마운자로",path:"/medical-cost/마운자로",icon:Tags,tone:"sky"},
 {label:"위고비",path:"/medical-cost/위고비",icon:Tags,tone:"peach"},
 {label:"가다실 9가",path:"/medical-cost/가다실9가",icon:Syringe,tone:"coral"},
 {label:"대상포진",path:"/medical-cost/대상포진예방접종",icon:HeartPulse,tone:"rose"},
 {label:"독감 예방접종",path:"/medical-cost/독감예방접종",icon:Syringe,tone:"orange"},
 {label:"치과 치료",path:"/medical-cost/치과",icon:Hospital,tone:"blue"}
];
const quick = [
  {name:"비대면 진료",sub:"증상·진료과 선택",path:"/telemedicine/all-department",icon:Stethoscope},
  {name:"병원 찾기",sub:"야간·휴일 진료",path:"/hospital",icon:Hospital},
  {name:"최저가 비교",sub:"진료비·약값 정보",path:"/medical-cost",icon:Tags},
  {name:"약국 찾기",sub:"운영시간 확인",path:"/pharmacy",icon:Pill}
];
const prices = [
  {name:"마운자로",path:"/medical-cost/마운자로"},
  {name:"위고비",path:"/medical-cost/위고비"},
  {name:"탈모약",path:"/medical-cost/탈모약"},
  {name:"여드름약",path:"/medical-cost/여드름약"},
  {name:"독감 예방접종",path:"/medical-cost/독감예방접종"},
  {name:"가다실 9가",path:"/medical-cost/가다실9가"}
];
const care = [
  {name:"내과",path:"/dept-hub/내과"},
  {name:"피부과",path:"/dept-hub/피부과"},
  {name:"정형외과",path:"/dept-hub/정형외과"},
  {name:"소아청소년과",path:"/dept-hub/소아청소년과"},
  {name:"산부인과",path:"/dept-hub/산부인과"},
  {name:"이비인후과",path:"/dept-hub/이비인후과"}
];
const utility=[
  {label:"야간 진료 병원",path:"/hospital/야간진료",icon:Clock3},
  {label:"일요일 진료",path:"/hospital/일요일진료",icon:CalendarDays},
  {label:"야간 약국",path:"/pharmacy/야간약국",icon:MapPin}
];
function NavLink({path,go,children,className="",label}) {
  return <a href={path} className={className} onClick={e=>{e.preventDefault();go(path,{label:label||undefined})}}>{children}</a>;
}
function NativeHomeBanner({go}){
 const [banner,setBanner]=useState(null);
 useEffect(()=>{
  const abort=new AbortController();
  fetchNativeCatalog("home-banner",{},abort.signal).then(result=>{
    const candidates=normalizeNativeCards(result.data);
    if(candidates.length)setBanner(candidates[0]);
  }).catch(()=>{}); // unverified API stays distinct from the static navigation baseline
  return ()=>abort.abort();
 },[]);
 const contents=<>
   {banner?.image&&<img className="native-home-banner-image" alt="" src={banner.image}/>}
   <span>{banner?.subtitle||"365일 24시간 전국민 누구나"}</span>
   <strong>{banner?.label||"비대면 진료 받을 수 있어요!"}</strong>
   {!banner?.image&&<Stethoscope aria-hidden="true" size={38}/>}
 </>;
 const className="native-home-banner"+(banner?.image?" has-native-image":"");
 // Never redirect an observed native banner to an unrelated fallback destination.
 if(banner&&!banner.path)return <div className={className} data-native-link-unverified="true">{contents}</div>;
 return <NavLink className={className} path={banner?.path||"/telemedicine/all-department"} go={go}
   label={banner?.label||"비대면 진료"}>{contents}</NavLink>;
}
export default function NativeAppHome({data,go}) {
  const [homeMode,setHomeMode]=useState("telemedicine");
  const observed=(data?.links||[]).filter(x=>x.path&&x.label&&x.path!=="/");
  const appCards=homeMode==="telemedicine"?appSymptoms:appBookings;
  return <div className="native-home" data-native-reference="mydoctor-6.50.0">
    <section className="native-home-top">
      <NativeHomeBanner go={go}/>
      <div className="native-app-service-box">
        <div className="native-segment" role="tablist" aria-label="진료 서비스 선택">
          <button type="button" role="tab" aria-selected={homeMode==="telemedicine"}
            className={homeMode==="telemedicine"?"selected":""}
            onClick={()=>setHomeMode("telemedicine")}>비대면 진료</button>
          <button type="button" role="tab" aria-selected={homeMode==="booking"}
            className={homeMode==="booking"?"selected":""}
            onClick={()=>setHomeMode("booking")}>최저가 병원 예약</button>
        </div>
        <div className="native-symptom-grid">
          {appCards.map(({label,path,icon:Icon,tone})=>
           <NavLink key={path} path={path} go={go} className="native-symptom-item" label={label}>
            <span className={"native-symptom-icon tone-"+tone}><Icon aria-hidden="true" size={28} strokeWidth={1.8}/></span>
            <span>{label}</span>
           </NavLink>)}
        </div>
        <NavLink className="native-app-all" path={homeMode==="telemedicine"?"/telemedicine/all-department":"/medical-cost"}
            go={go} label="전체 보기">전체 보기 <ChevronRight size={16}/></NavLink>
      </div>
    </section>
    <NativeApiCatalog resource="home-menu" title="원본 앱에서 불러온 홈 메뉴" go={go}/>
    <section className="native-home-block" aria-label="서비스 바로가기">
      <div className="native-heading"><h2>빠른 서비스</h2></div>
      <div className="native-quick-grid">
        {quick.map(({name,sub,path,icon:Icon})=>
          <NavLink key={path} path={path} go={go} className="native-quick-item" label={name}>
            <span className="native-quick-icon"><Icon size={25} strokeWidth={1.85}/></span>
            <strong>{name}</strong><small>{sub}</small>
          </NavLink>)}
      </div>
    </section>
    <div className="native-section-break"/>
    <section className="native-home-block">
      <div className="native-heading"><h2>가격 비교</h2>
        <NavLink path="/medical-cost" go={go} className="native-section-more" label="전체 가격 비교">전체 보기 <ChevronRight size={15}/></NavLink>
      </div>
      <p className="native-section-desc">약과 진료 항목별 공개 가격을 찾아보세요.</p>
      <div className="native-topic-grid">
        {prices.map(p=><NavLink key={p.path} path={p.path} go={go} label={p.name} className="native-topic-item">
          <span>{p.name}</span><ChevronRight size={15}/></NavLink>)}
      </div>
    </section>
    <div className="native-section-break"/>
    <section className="native-home-block">
      <div className="native-heading"><h2>진료과별 병원 찾기</h2>
        <NavLink path="/hospital" go={go} className="native-section-more" label="병원 전체 보기">전체 보기 <ChevronRight size={15}/></NavLink>
      </div>
      <div className="native-dept-grid">
        {care.map(p=><NavLink key={p.path} path={p.path} go={go} label={p.name} className="native-dept-item">
          <span>{p.name}</span><ChevronRight size={15}/></NavLink>)}
      </div>
      <div className="native-utility-list">
        {utility.map(({label,path,icon:Icon})=><NavLink key={path} path={path} go={go} className="native-utility-row" label={label}>
          <Icon size={20}/><span>{label}</span><ChevronRight size={17}/></NavLink>)}
      </div>
    </section>
    <div className="native-section-break"/>
    <section className="native-home-block">
      <div className="native-heading"><h2>건강 정보</h2></div>
      <div className="native-health-links">
        <NavLink path="/medicine" go={go} className="native-health-link" label="의약품 검색"><Pill size={22}/><strong>의약품 정보</strong><ChevronRight size={16}/></NavLink>
        <NavLink path="/qna" go={go} className="native-health-link" label="의료진 Q&A"><MessageCircle size={22}/><strong>의료진 Q&A</strong><ChevronRight size={16}/></NavLink>
        <NavLink path="/healthLab" go={go} className="native-health-link" label="건강 콘텐츠"><HeartPulse size={22}/><strong>건강 콘텐츠</strong><ChevronRight size={16}/></NavLink>
      </div>
    </section>
    {!!observed.length&&<details className="native-source-paths">
      <summary>원본에서 확인된 상세 경로 <span>({observed.length})</span></summary>
      {observed.slice(0,180).map(x=><NavLink key={x.path} path={x.path} go={go} className="native-observed-row" label={x.label}>
        <span>{x.label}</span><ChevronRight size={16}/></NavLink>)}
    </details>}
  </div>;
}
