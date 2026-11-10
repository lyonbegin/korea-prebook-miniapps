import React from "react";
import {
  Stethoscope,Hospital,Tags,Pill,ChevronRight,MapPin,
  Clock3,Search,HeartPulse,Syringe,FileText,MessageCircle,
  Activity,CalendarDays
} from "lucide-react";

/** Mobile-web implementation of the app-oriented service hierarchy.
 * Reference build: MyDoctor 6.50.0 XAPK, React Native/Hermes UI resources.
 * Public links keep the app's on-demand DB/source-data lifecycle.
 * This screen does not claim an exact screenshot or source JSX reconstruction.
 */
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
export default function NativeAppHome({data,go}) {
  const observed=(data?.links||[]).filter(x=>x.path&&x.label&&x.path!=="/");
  return <div className="native-home" data-native-reference="mydoctor-6.50.0">
    <section className="native-home-greeting">
      <p className="native-overline">나만의닥터</p>
      <h1>어떤 도움이 필요하세요?</h1>
      <NavLink path="/hospital" go={go} className="native-home-search" label="병원 검색">
        <Search size={19}/><span>병원, 진료과, 증상을 검색해 보세요</span><ChevronRight size={17}/>
      </NavLink>
    </section>
    <section className="native-home-primary" aria-label="주요 서비스">
      <NavLink className="native-hero-care" path="/telemedicine/all-department" go={go} label="비대면 진료">
        <span className="native-hero-eyebrow">비대면 진료</span>
        <strong>병원에 가지 않고<br/>전화로 진료받기</strong>
        <span className="native-hero-cta">진료 시작하기 <ChevronRight size={16}/></span>
        <Stethoscope className="native-hero-icon" size={64} strokeWidth={1.35}/>
      </NavLink>
    </section>
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
