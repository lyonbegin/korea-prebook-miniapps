import React,{useEffect,useState} from "react";
import {
  Stethoscope,Hospital,Tags,Pill,ChevronRight,MapPin,
  Clock3,Search,HeartPulse,Syringe,FileText,MessageCircle,
  Activity,CalendarDays
} from "lucide-react";
import NativeApiCatalog from "./NativeApiCatalog.jsx";
import {nativeHomeMenuItems,nativeHomeBanners} from "./nativeDataAdapters.js";
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
 const [banners,setBanners]=useState([]);
 useEffect(()=>{
  const abort=new AbortController();
  fetchNativeCatalog("home-banner",{},abort.signal)
   .then(result=>setBanners(nativeHomeBanners(result.data)))
   .catch(()=>{});
  return ()=>abort.abort();
 },[]);
 if(!banners.length)return <NavLink className="native-home-banner" path="/telemedicine/all-department"
   go={go} label="비대면 진료">
   <span>365일 24시간 전국민 누구나</span><strong>비대면 진료 받을 수 있어요!</strong>
   <Stethoscope aria-hidden="true" size={38}/>
  </NavLink>;
 return <div className="native-app-banner-track" aria-label="원본 앱 배너">
   {banners.map((banner,i)=>{
    const picture=<img alt={"원본 앱 배너 "+(i+1)} src={banner.image} loading={i===0?"eager":"lazy"}/>;
    return banner.path?
     <NavLink key={banner.id??i} path={banner.path} go={go} className="native-image-banner" label="배너 상세">{picture}</NavLink>:
     <div key={banner.id??i} className="native-image-banner" style={banner.color?{backgroundColor:banner.color}:undefined}>
       {picture}</div>;
   })}
  </div>;
}
function NativeHomeMenuGrid({go}){
 const [items,setItems]=useState([]);
 const [status,setStatus]=useState("loading");
 const [selected,setSelected]=useState(null);
 useEffect(()=>{
  const abort=new AbortController();
  fetchNativeCatalog("home-menu",{},abort.signal).then(result=>{
    setItems(nativeHomeMenuItems(result.data));setStatus("loaded");
  }).catch(()=>setStatus("unavailable"));
  return ()=>abort.abort();
 },[]);
 if(status==="loading")return <p role="status" className="native-app-menu-status">원본 앱 진료 메뉴를 불러오고 있습니다.</p>;
 if(status==="unavailable")return <p role="status" className="native-app-menu-status">원본 앱 진료 메뉴 데이터가 연결되지 않았습니다.</p>;
 if(!items.length)return <p role="status" className="native-app-menu-status">원본 API에서 진료 메뉴 항목을 찾지 못했습니다.</p>;
 return <>
  <div className="native-symptom-grid" data-native-menu-count={items.length}>
   {items.map((item,i)=>{
    const body=<><span className={"native-symptom-icon tone-"+["sky","peach","coral","rose","orange","pink","slate","blue","mint"][i%9]}>
      {item.image?<img src={item.image} alt="" loading="lazy"/>:<Stethoscope size={24} aria-hidden="true"/>}</span>
      <span>{item.label}</span></>;
    return item.path?
      <NavLink key={item.id??i} path={item.path} go={go} className="native-symptom-item" label={item.label}>{body}</NavLink>:
      <button type="button" key={item.id??i} className="native-symptom-item native-symptom-button" onClick={()=>setSelected(item)} aria-label={item.label+" 원본 메뉴 상세"}>{body}</button>;
   })}
  </div>
  {selected&&<div className="native-data-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}>
    <section className="native-data-dialog" role="dialog" aria-modal="true" aria-label={selected.label+" 원본 메뉴 정보"}>
      <div className="native-data-dialog-head"><h2>{selected.label}</h2><button type="button" aria-label="닫기" onClick={()=>setSelected(null)}>닫기</button></div>
      {selected.subtitle&&<p>{selected.subtitle}</p>}
      {selected.image&&<img src={selected.image} alt="" className="native-data-detail-image"/>}
      <div className="native-menu-facts">
       {selected.raw?.symptom_ids&&<p>증상 코드: {String(selected.raw.symptom_ids)}</p>}
       {selected.raw?.department_ids&&<p>진료과 코드: {String(selected.raw.department_ids)}</p>}
      </div>
      <p className="native-data-note">원본 앱의 메뉴 데이터입니다. 해당 메뉴의 의사 검색 조건은 추가 분석 중입니다.</p>
    </section>
   </div>}
 </>;
}
/**
 * Strictly evidenced original 6.50.0 layout pieces:
 *  HomeScreen #45594  ScrollView gap=12 paddingTop=12
 *  HomeNavigationSection #45993; StyleSheet #45992:
 *    flexDirection=row, marginHorizontal=12, gap=12;
 *    white service cards radius=16 padding=12 gap=12
 *    hospitalLocation SvgIcon size=40, label "병원/약국\\n찾기"
 *  MedicalAppointmentSection #45649; StyleSheet #45648:
 *    12dp margin, 12dp padding; headings "비대면 진료" / "최저가 병원 예약";
 *    footer action "모든 증상 보기"
 *  AdBanner follows the original section flow; not the hero-first placement.
 * Unconfirmed extra public web navigation is collapsed below the native shell.
 */
function normalizeHomeNavigationConfig(response) {
  // HBC96: #46013 getConfig({key:"HomeNavigationConfig"}), response.data.value JSON string.
  const payload=response?.data?.data?.value??response?.data?.value;
  let entries=payload;
  if(typeof payload==="string"){
    try{entries=JSON.parse(payload)}catch{return []}
  }
  if(!Array.isArray(entries))return [];
  return entries.filter(item=>{
    if(!item||typeof item!=="object"||typeof item.title!=="string")return false;
    if(!item.title.trim()||typeof item.imageUrl!=="string")return false;
    return /^https:\/\/img\.my-doctor\.io\//.test(item.imageUrl);
  }).slice(0,5).map(item=>{
    const deepLink=typeof item.navigationUrl==="string"&&
      /^merakiyourdoctor:\/\/navigate\?screen=[A-Za-z0-9_]+$/.test(item.navigationUrl)?
      item.navigationUrl:null;
    return {title:item.title,imageUrl:item.imageUrl,deepLink,
      shouldCheckLogin:item.shouldCheckLogin===true};
  });
}
function HermesHomeNavigation({go}){
  const [entries,setEntries]=useState([]);
  const [selected,setSelected]=useState(null);
  const [sourceState,setSourceState]=useState("loading");
  useEffect(()=>{
    const ctrl=new AbortController();
    fetchNativeCatalog("app-config",{config_key:"HomeNavigationConfig"},ctrl.signal)
      .then(response=>{
        if(ctrl.signal.aborted)return;
        const items=normalizeHomeNavigationConfig(response);
        setEntries(items);setSourceState(items.length?"source":"missing");
      })
      .catch(()=>{if(!ctrl.signal.aborted)setSourceState("unavailable")});
    return ()=>ctrl.abort();
  },[]);
  return <>
    <nav className="hermes-home-navigation" data-original-nav-count={1+entries.length}
      aria-label="원본 홈 바로가기">
      <NavLink className="hermes-home-nav-card" path="/hospital" go={go} label="병원/약국 찾기">
        <Hospital size={40} strokeWidth={1.6} aria-hidden="true"/>
        <strong>병원/약국<br/>찾기</strong>
      </NavLink>
      {entries.map((item,i)=><button type="button"
        key={item.deepLink??i} className="hermes-home-nav-card hermes-config-nav-card"
        aria-label={item.title.replace(/\n/g," ")}
        onClick={()=>setSelected(item)}>
        <img src={item.imageUrl} alt="" width="40" height="40" loading="eager"/>
        <strong>{item.title.split("\n").map((part,j)=>
          <React.Fragment key={j}>{j>0&&<br/>}{part}</React.Fragment>)}</strong>
      </button>)}
    </nav>
    {sourceState==="unavailable"&&
      <span className="hermes-source-state" role="status">원본 홈 설정을 불러오지 못했습니다.</span>}
    {sourceState==="missing"&&
      <span className="hermes-source-state" role="status">원본 홈 바로가기 설정에 표시할 항목이 없습니다.</span>}
    {selected&&<div className="native-data-overlay"
       onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}>
      <section className="native-data-dialog" role="dialog" aria-modal="true"
        aria-label={selected.title.replace(/\n/g," ")+" 원본 앱 이동"}>
        <div className="native-data-dialog-head">
          <h2>{selected.title.replace(/\n/g," ")}</h2>
          <button type="button" onClick={()=>setSelected(null)} aria-label="닫기">닫기</button>
        </div>
        <p>원본 Android 6.50.0 홈 설정에서 직접 불러온 화면입니다.</p>
        {selected.shouldCheckLogin&&
          <p className="native-data-note">원본 앱에서 로그인 확인이 필요한 화면입니다.</p>}
        {selected.deepLink&&<a href={selected.deepLink}
          className="hermes-native-open-link">원본 Android 앱에서 해당 화면 열기</a>}
        <p className="native-data-note">이 화면의 웹 UI는 Hermes 코드 분석 대상입니다.</p>
      </section>
    </div>}
  </>;
}
export default function NativeAppHome({data,go}) {
  const [homeMode,setHomeMode]=useState("telemedicine");
  const observed=(data?.links||[]).filter(x=>x.path&&x.label&&x.path!=="/");
  const appCards=homeMode==="telemedicine"?appSymptoms:appBookings;
  return <div className="native-home hermes-v650-home" data-native-reference="mydoctor-6.50.0-hbc96">
    <section className="native-home-top">
      <HermesHomeNavigation go={go}/>
      <div className="native-app-service-box hermes-medical-appointment">
        <div className="native-segment hermes-appointment-headings" role="tablist" aria-label="진료 서비스 선택">
          <button type="button" role="tab" aria-selected={homeMode==="telemedicine"}
            className={homeMode==="telemedicine"?"selected":""}
            onClick={()=>setHomeMode("telemedicine")}>비대면 진료</button>
          <button type="button" role="tab" aria-selected={homeMode==="booking"}
            className={homeMode==="booking"?"selected":""}
            onClick={()=>setHomeMode("booking")}>최저가 병원 예약</button>
        </div>
        {homeMode==="telemedicine"?<NativeHomeMenuGrid go={go}/>:
          <div className="native-symptom-grid">
            {appCards.map(({label,path,icon:Icon,tone})=>
              <NavLink key={path} path={path} go={go} className="native-symptom-item" label={label}>
                <span className={"native-symptom-icon tone-"+tone}><Icon aria-hidden="true" size={28} strokeWidth={1.8}/></span>
                <span>{label}</span>
              </NavLink>)}
          </div>}
        <NavLink className="native-app-all hermes-all-symptoms"
          path={homeMode==="telemedicine"?"/telemedicine/all-department":"/medical-cost"}
          go={go} label={homeMode==="telemedicine"?"모든 증상 보기":"전체 보기"}>
          {homeMode==="telemedicine"?"모든 증상 보기":"전체 보기"} <ChevronRight size={16}/>
        </NavLink>
      </div>
      <NativeHomeBanner go={go}/>
    </section>
    <section className="hermes-native-legal" aria-label="원본 앱 정보">
      <div>
        <a href="https://my-doctor.io/" target="_blank" rel="noreferrer">이용약관</a>
        <a href="https://my-doctor.io/" target="_blank" rel="noreferrer"><strong>개인정보처리방침</strong></a>
        <a href="https://my-doctor.io/" target="_blank" rel="noreferrer">위치기반서비스이용약관</a>
      </div>
      <p>광고 문의 : sales@merakiplace.kr</p>
    </section>
    <details className="hermes-nonnative-links">
      <summary>웹에서 확인된 추가 서비스 링크</summary>
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
      <section className="native-home-block">
        <div className="native-heading"><h2>가격 비교</h2></div>
        <div className="native-topic-grid">
          {prices.map(p=><NavLink key={p.path} path={p.path} go={go} label={p.name} className="native-topic-item">
            <span>{p.name}</span><ChevronRight size={15}/></NavLink>)}
        </div>
      </section>
      <section className="native-home-block">
        <div className="native-heading"><h2>진료과별 병원 찾기</h2></div>
        <div className="native-dept-grid">
          {care.map(p=><NavLink key={p.path} path={p.path} go={go} label={p.name} className="native-dept-item">
            <span>{p.name}</span><ChevronRight size={15}/></NavLink>)}
        </div>
        <div className="native-utility-list">
          {utility.map(({label,path,icon:Icon})=><NavLink key={path} path={path} go={go} className="native-utility-row" label={label}>
            <Icon size={20}/><span>{label}</span><ChevronRight size={17}/></NavLink>)}
        </div>
      </section>
      <section className="native-home-block">
        <div className="native-heading"><h2>건강 정보</h2></div>
        <div className="native-health-links">
          <NavLink path="/medicine" go={go} className="native-health-link" label="의약품 검색"><Pill size={22}/><strong>의약품 정보</strong><ChevronRight size={16}/></NavLink>
          <NavLink path="/qna" go={go} className="native-health-link" label="의료진 Q&A"><MessageCircle size={22}/><strong>의료진 Q&A</strong><ChevronRight size={16}/></NavLink>
          <NavLink path="/healthLab" go={go} className="native-health-link" label="건강 콘텐츠"><HeartPulse size={22}/><strong>건강 콘텐츠</strong><ChevronRight size={16}/></NavLink>
        </div>
      </section>
    </details>
    {!!observed.length&&<details className="native-source-paths">
      <summary>원본에서 확인된 상세 경로 <span>({observed.length})</span></summary>
      {observed.slice(0,180).map(x=><NavLink key={x.path} path={x.path} go={go} className="native-observed-row" label={x.label}>
        <span>{x.label}</span><ChevronRight size={16}/></NavLink>)}
    </details>}
  </div>;
}
