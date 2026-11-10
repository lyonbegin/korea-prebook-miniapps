import React,{useEffect,useState}from"react";
import{ChevronDown,ChevronRight,ChevronLeft,Menu,X,MapPin,BriefcaseMedical,Stethoscope,Phone,Navigation,House,Clock3,Home,Tags,Hospital,LayoutGrid}from"lucide-react";
import{fetchPublicFacts}from"./lib/originalGateway.js";
import{parsePublicFacts,routeFromLocation}from"./lib/sourceModel.js";
import sourceMenu from "./data/original-menu-20261109.json";
import{VerifiedSourcePage,SourceRows}from"./VerifiedSourcePage.jsx";
import {isCompanyRoute,isOriginalDistinctRoute} from "./OriginalDistinctPages.jsx";
import OriginalFooter from "./OriginalFooter.jsx";
import originalPriceCards from "./data/original-medical-cost-cards.json";
import NativeAppHome from "./NativeAppHome.jsx";
import NativeApiCatalog from "./NativeApiCatalog.jsx";

const ORIGINAL="https://my-doctor.io";
const NAV=[["홈","/"],["비대면 진료","/telemedicine/all-department"],["병원 찾기","/hospital"],["가격 비교","/medical-cost"],["약국 찾기","/pharmacy"],["의약품 정보","/medicine"],["건강연구소","/healthLab"]];
const CATEGORIES=[
["귀/코/목 질환","비염, 중이염, 인후염 등","ear.2vueof9c3v0uq.svg",["비염","중이염","인후염","축농증"]],
["만성질환","고지혈증, 고혈압, 당뇨병 등","diabetes.090stcs374avd.svg",["고지혈증","고혈압","당뇨병"]],
["비뇨기 질환","방광염, 전립선염, 요실금 등","kidney.1t1_1unm2wlc1.svg",["방광염","전립선염","요실금"]],
["소화기 질환","속쓰림, 장염, 위염 등","stomache.2ca46vciyelst.svg",["속쓰림","장염","위염"]],
["신경 질환","두통, 편두통, 안면경련 등","brain.3ieuexq3w4qcx.svg",["두통","편두통","안면경련"]],
["안구 질환","안구건조증, 결막염, 다래끼 등","eye.29a209_iyho6n.svg",["안구건조증","결막염","다래끼"]],
["여성 질환","질염, 생리통, 생리불순 등","female.454xcj48d_sp8.svg",["질염","생리통","생리불순"]],
["정신 질환","우울증, 강박장애, 공황장애 등","meditation.2jeysu9ce35-2.svg",["우울증","강박장애","공황장애"]],
["정형외과 질환","근육통, 근육경련, 관절염 등","xRay.42-50yr98ed7b.svg",["근육통","근육경련","관절염"]],
["치과 질환","치통, 충치, 치주염 등","tooth.3--dr6sp_2q3d.svg",["치통","충치","치주염"]],
["탈모","탈모, 여성 탈모 등","hairloss.0e8xww15mcc9q.svg",["탈모","여성 탈모"]],
["피부 질환","여드름, 무좀, 땀띠 등","skin.1yr9o5z7bd6b4.svg",["여드름","무좀","땀띠"]],
["호흡기 질환","감기, 독감, 코로나 등","cold.0zdk5k602s-60.svg",["감기","독감","코로나"]]
];
const DOC_DEPTS=["가정의학과","결핵과","내과","마취통증의학과","방사선종양학과","병리과","비뇨의학과","사상체질과","산부인과","성형외과","소아청소년과","신경과","신경외과","안과","영상의학과","예방의학과","외과","응급의학과","이비인후과","재활의학과","정신건강의학과","정형외과","직업환경의학과","진단검사의학과","치과","침구과","피부과","한방내과","한방부인과","한방소아과"];
const PRICEDESC={"마운자로":"나만의닥터 마운자로 최저가 비교","위고비":"나만의닥터 위고비, 오젬픽 등 최저가 비교","에페":"나만의닥터 에페 최저가 비교","탈모약":"피나스테리드, 두타스테리드 등 최저가 비교","여드름약":"이소트레티노인, 클린다마이신 등 최저가 비교","독감예방접종":"독감 백신 전국 최저가 가격 비교"};
function useNavigation(){
 const[route,setRoute]=useState(routeFromLocation);
 useEffect(()=>{const f=()=>{setRoute(routeFromLocation());window.scrollTo(0,0)};window.addEventListener("popstate",f);return()=>window.removeEventListener("popstate",f)},[]);
 const go=(path,sourceLink)=>{if(typeof path!=="string"||!path.startsWith("/")||path.startsWith("//"))return;const sourceLabel=String(sourceLink?.label||"").trim().slice(0,160);history.pushState(sourceLabel?{sourceLabel}:null,"",path);setRoute(routeFromLocation());window.scrollTo(0,0)};
 return[route,go];
}
function useSource(route){
 const[state,setState]=useState({data:null,loading:true,error:""});
 const[retry,setRetry]=useState(0);
 useEffect(()=>{const c=new AbortController();setState({data:null,loading:true,error:""});
  // Keep the loading view visible until the original response actually arrives.
  // The API now sends first-visit source facts before asynchronously persisting
  // them, so a synthetic 8-second timeout would incorrectly hide a valid load.
  fetchPublicFacts(route,c.signal).then(payload=>{
    const data=parsePublicFacts(payload,route);
    if(!c.signal.aborted)setState({data,loading:false,error:data.hasSourceData?"":"원본 데이터 구조를 확인할 수 없습니다."});
  }).catch(e=>{
    if(!c.signal.aborted)setState({data:null,loading:false,error:String(e.message||e)});
  });
  return()=>c.abort();
 },[route,retry]);return{...state,refresh:()=>setRetry(x=>x+1)};
}
const APP_TABS=[
  {label:"홈",path:"/",icon:Home},
  {label:"비대면 진료",path:"/telemedicine/all-department",icon:Stethoscope},
  {label:"가격 비교",path:"/medical-cost",icon:Tags},
  {label:"병원 찾기",path:"/hospital",icon:Hospital}
];
function AppTabBar({route,go,onMenu,menuOpen}){
 const selected=route.startsWith("/telemedicine")?"/telemedicine/all-department":
  route.startsWith("/medical-cost")?"/medical-cost":
  (route.startsWith("/hospital")||route.startsWith("/dept-hub")||route.startsWith("/map")||route.startsWith("/pharmacy"))?"/hospital":"/";
 return <nav className="native-app-tabbar" aria-label="앱 하단 메뉴">
  {APP_TABS.map(({label,path,icon:Icon})=><a key={path} href={path}
    aria-current={selected===path?"page":undefined}
    className={"native-tab"+(selected===path?" current":"")}
    onClick={e=>{e.preventDefault();go(path,{label})}}>
    <Icon size={22} strokeWidth={selected===path?2.25:1.85} aria-hidden="true"/><span>{label}</span>
   </a>)}
  <button type="button" className={"native-tab"+(menuOpen?" current":"")}
    aria-label="서비스 전체 메뉴" aria-expanded={menuOpen} onClick={onMenu}>
    <LayoutGrid size={22} aria-hidden="true"/><span>전체</span>
  </button>
 </nav>;
}
function Anchor({label,path,go,children,className=""}){return <a href={path} className={className} onClick={e=>{e.preventDefault();go(path)}}>{children||label}</a>}
function Breadcrumb({route,go}){
 const medical=route.startsWith("/medical-cost"),doctor=route.startsWith("/telemedicine"),hospital=route.startsWith("/hospital");
 const detailed=route.startsWith("/hospital/detail");
 const cleanRoute=decodeURIComponent(route.split("?")[0]);
 if(cleanRoute==="/map/baby119")return <div className="breadcrumb"><Anchor label="홈" path="/" go={go}/><span>›</span><Anchor label="병원찾기" path="/hospital" go={go}/><span>›</span><strong>소아과 119 지도</strong></div>;
 if(cleanRoute==="/qna")return <div className="breadcrumb"><Anchor label="홈" path="/" go={go}/><span>›</span><Anchor label="건강 정보" path="/healthLab" go={go}/><span>›</span><strong>의료진 Q&A</strong></div>;
 if(cleanRoute==="/hospital/야간진료")return <div className="breadcrumb"><Anchor label="홈" path="/" go={go}/><span>›</span><Anchor label="병원찾기" path="/hospital" go={go}/><span>›</span><strong>야간진료</strong></div>;
 if(cleanRoute==="/telemedicine/doctor/한사랑패밀리의원-허훈-10")return <div className="breadcrumb"><Anchor label="홈" path="/" go={go}/><span>›</span><Anchor label="비대면진료" path="/telemedicine" go={go}/><span>›</span><strong>의사 상세</strong></div>;
 if(cleanRoute==="/medical-cost/마운자로"||cleanRoute==="/medical-cost/여드름약/이소티논")return <div className="breadcrumb"><Anchor label="홈" path="/" go={go}/><span>›</span><Anchor label="가격비교" path="/medical-cost" go={go}/><span>›</span><strong>{cleanRoute.endsWith("/마운자로")?"마운자로":"여드름약"}</strong></div>;
 if(cleanRoute==="/medicine/0.9-엔에이시엘.케이40주-200710605")return <div className="breadcrumb"><Anchor label="홈" path="/" go={go}/><span>›</span><Anchor label="의약품 정보" path="/medicine" go={go}/><span>›</span><strong>의약품 상세</strong></div>;
 if(cleanRoute==="/healthLab/info/1268/만성-소화기-질환-관리법")return <div className="breadcrumb"><Anchor label="홈" path="/" go={go}/><span>›</span><Anchor label="건강 정보" path="/healthLab" go={go}/><span>›</span><strong>건강 꿀팁</strong></div>;
 if(cleanRoute==="/medicine")return <div className="breadcrumb"><Anchor label="홈" path="/" go={go}/><span>›</span><strong>의약품 정보</strong></div>;
 if(cleanRoute==="/healthLab/FAQ")return <div className="breadcrumb"><Anchor label="홈" path="/" go={go}/><span>›</span><Anchor label="건강 정보" path="/healthLab" go={go}/><span>›</span><strong>건강 FAQ</strong></div>;
 if(cleanRoute==="/pharmacy/야간약국")return <div className="breadcrumb"><Anchor label="홈" path="/" go={go}/><span>›</span><Anchor label="약국찾기" path="/pharmacy" go={go}/><span>›</span><strong>전국 야간 약국</strong></div>;
 if(cleanRoute==="/telemedicine/doctor/탑연합의원-박광규-100/reviews")return <div className="breadcrumb"><Anchor label="홈" path="/" go={go}/><span>›</span><Anchor label="비대면진료" path="/telemedicine" go={go}/><span>›</span><Anchor label="박광규 의사" path="/telemedicine/doctor/탑연합의원-박광규-100" go={go}/><span>›</span><strong>후기</strong></div>;
 if(cleanRoute==="/hospital/10055/reviews")return <div className="breadcrumb"><Anchor label="홈" path="/" go={go}/><span>›</span><Anchor label="병원찾기" path="/hospital" go={go}/><span>›</span><Anchor label="성남시 내과" path="/dept-hub/내과/경기-성남시" go={go}/><span>›</span><Anchor label="동산의원" path="/hospital/detail?hospital_id=10055" go={go}/><span>›</span><strong>후기</strong></div>;
 return <div className="breadcrumb"><Anchor label="홈" path="/" go={go}/><span>›</span>{detailed?<><Anchor label="병원찾기" path="/hospital" go={go}/><span>›</span><span>병원 상세</span></>:<strong>{medical?"가격비교":doctor?"비대면진료":hospital?"병원찾기":"상세정보"}</strong>}</div>;
}
function CostTable({tables}){
 return tables.map((t,i)=><div className="table-scroll" key={i}><table className="cost-table">
  {!!t.headers.length&&<thead><tr>{t.headers.map((cell,j)=><th key={j}>{cell}</th>)}</tr></thead>}
  <tbody>{t.rows.map((row,j)=><tr key={j}>{row.map((v,k)=><td key={k}>{v}</td>)}</tr>)}</tbody>
 </table></div>);
}
function HomeScreen({data,go}){
 return <><svg className="md-colorfilter" width="0" height="0" aria-hidden="true"><defs><filter id="md-remove-dark-backdrop" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1 1 1 0 -0.25"/></filter></defs></svg><section className="md-home">
  <h1>대한민국 1위<br/>비대면 진료 앱<br/>나만의닥터</h1>
  <div className="md-awards">{[
   "2026 대한민국 소비자 브랜드 대상 진료 부문 1위",
   "2024 중앙일보 올해의 우수브랜드대상 · 비대면진료 부문 1위",
   "2022 대한민국소비자브랜드 대상 · 서비스만족도 1위"
  ].map((s,i)=><div key={i} className="award-line">
    <img src={ORIGINAL+"/_next/static/media/laurel-left.2ngvh-_bdkhon.svg"} alt=""/>
    <span>{s}</span>
    <img src={ORIGINAL+"/_next/static/media/laurel-right.2i_spu7dd09cg.svg"} alt=""/>
   </div>)}</div>
  <div className="md-stats"><span>활성유저수 <b>1위¹</b><br/>회원수 <b>300만+</b></span><span>매출액 <b>1위²</b><br/>앱스토어 평점 <b>4.8점</b></span></div>
  <div className="md-stat-notes"><p>1 모바일인덱스 추정 기준 비대면진료 앱 월간 활성 이용자 수(MAU)<br/>　2026년 1월~8월 8개월 연속 1위 (Android+iOS 합산)</p><p>2 비대면진료 앱 운영사 4개사 2025년 매출액<br/>　(각 사 공시 재무제표 기준)</p></div>
  <img className="md-home-hero" src="https://my-doctor.io/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fhero-mockup.27qja46teurqn.webp&w=750&q=75" alt="나만의닥터 앱 사용 화면"/>
 </section><HomeOverview data={data} go={go}/></>;
}
const HOME_PRICE=[
 ["마운자로","mounjaro.3iuw_p3a_lzqq.svg","/medical-cost/마운자로"],
 ["위고비","wegovy.1ng_mja5lmh6k.svg","/medical-cost/위고비"],
 ["탈모약","hairloss.0e8xww15mcc9q.svg","/medical-cost/탈모약"],
 ["여드름약","skin.1yr9o5z7bd6b4.svg","/medical-cost/여드름약"],
 ["독감 예방접종","", "/medical-cost/독감예방접종"],
 ["가다실 9가","gardasil.29d-1lba1im_k.svg","/medical-cost/가다실9가"]
];
const HOME_MEDICAL=[
 ["치과 치료","tooth.0ou2u6kexg7cr.svg","/medical-cost/치과"],
 ["라식·라섹","eye.2x0wxiz3d0oad.svg","/medical-cost/시력교정술"],
 ["MRI 검사","mri.0vjgkacrombrc.svg","/medical-cost/MRI검사"],
 ["초음파 검사","ultrasound.08f94hlk3h_t8.svg","/medical-cost/초음파-검사"],
 ["예방접종 백신","medicine.0go4ijudiofx9.svg","/medical-cost/예방접종-백신"],
 ["내시경 검사","endoscope.2s5rgrcpesgsg.svg","/medical-cost/내시경-검사"]
];
const HOME_STEPS=[
 ["STEP 1","증상 선택","진료 받을 증상/진료과 선택","step-1.44nvhvho18h38.svg"],
 ["STEP 2","비대면 전화 진료","전화로 의사와 진료 후 앱으로 처방전 발행","step-2.1d9x5vc0gayz4.svg"],
 ["STEP 3","약 수령","가까운 약국에서 약 받으면 끝!","step-3.31yy8rr8i37qs.svg"]
];
function HomeOverview({data,go}){
 const pagePaths=new Set(data.links.map(x=>decodeURIComponent(x.path).split("?")[0]));
 const safeLink=(route)=>pagePaths.has(decodeURIComponent(route))?route:route;
 const cards=arr=><div className="home-observed-card-grid">{arr.map(([label,img,route])=>
  <Anchor key={route} className="home-observed-card" path={safeLink(route)} go={go}>
    {img?<img alt="" loading="lazy" src={ORIGINAL+"/_next/static/media/"+img}/>:null}
    <b>{label}</b>
  </Anchor>)}</div>;
 return <div className="home-observed-sections">
  <section className="home-observed-block home-telemedicine">
   <span className="home-section-tag">비대면 진료</span>
   <h2>전국민 누구나,<br/>언제든 어디서나 전화 진료</h2>
   <p>24시간 365일, 전화 한 통으로 진료받고<br/>가까운 약국에서 약을 수령하세요.</p>
   <div className="home-steps">{HOME_STEPS.map(([num,name,desc,icon])=><div className="home-step" key={num}>
     <img src={ORIGINAL+"/_next/static/media/"+icon} alt="" loading="lazy"/>
     <div><span>{num}</span><strong>{name}</strong><p>{desc}</p></div>
   </div>)}</div>
   <h2 className="home-conditions-heading">이런 증상들 모두<br/>전화로 진료볼 수 있어요</h2>
   <div className="home-observed-card-grid symptom">
    {CATEGORIES.map(([name,desc,img])=><Anchor key={name} className="home-observed-card" path="/telemedicine/all-department" go={go}>
      <img src={ORIGINAL+"/_next/static/media/"+img} alt="" loading="lazy"/>
      <b>{name}</b><small>{desc}</small>
    </Anchor>)}
   </div>
   <Anchor className="home-primary-action" label="비대면 진료 시작하기" path="/telemedicine/all-department" go={go}/>
  </section>
  <section className="home-observed-block"><h2>나만의닥터 최저가 비교<br/>마운자로, 위고비, 백신 등</h2>
   {cards(HOME_PRICE)}<Anchor className="home-primary-action" label="의료비 가격 비교" path="/medical-cost" go={go}/>
  </section>
  <section className="home-observed-block"><h2>치과, 라식, MRI 가격 비교하고 예약하기</h2>
   {cards(HOME_MEDICAL)}
  </section>
  <section className="home-observed-block"><h2>휴일, 야간에도문 연 병원•약국 찾기</h2>
   <div className="home-quick-links">
    <Anchor path="/hospital/일요일진료" label="일요일 진료 병원" go={go}/>
    <Anchor path="/hospital/야간진료" label="야간 진료 병원" go={go}/>
    <Anchor path="/pharmacy/야간약국" label="야간 약국" go={go}/>
   </div>
  </section>
  <section className="home-observed-block"><h2>효능·복용법·주의사항<br/>의약품 정보 찾기</h2>
   <div className="home-quick-links">
    <Anchor path="/medicine" label="의약품 검색" go={go}/>
    <Anchor path="/medicine/effect/해열·진통·소염제" label="해열·진통·소염제" go={go}/>
    <Anchor path="/medicine/effect/항히스타민제" label="항히스타민제" go={go}/>
   </div>
  </section>
  <section className="home-observed-block"><h2>쌓이는 건강포인트로 병원비 아끼기</h2>
   <h3>건강관리만 해도 리워드가 쌓이는 앱테크</h3>
   <img className="home-points-preview" alt="원본 닥터포인트 미리보기" loading="lazy"
    src={ORIGINAL+"/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fpreview.1ni6h0697352_.webp&w=750&q=75"}/>
  </section>
  <section className="home-observed-block"><h2>나에게 딱 맞는 건강 콘텐츠</h2>
   <div className="home-quick-links"><Anchor path="/healthLab" label="건강 정보" go={go}/><Anchor path="/qna" label="의료진 Q&A" go={go}/></div>
  </section>
  <section className="home-observed-block"><h2>우리동네 신환 유치<br/>나만의닥터에서 시작하세요</h2>
   <h3>의사가 만든 의료 서비스로서 언제나 의료인의 마음으로 함께 성장하겠습니다.</h3>
   <div className="home-quick-links">
    <a href={ORIGINAL} rel="noreferrer" target="_blank"><h3>병원 제휴하기</h3></a>
    <a href={ORIGINAL} rel="noreferrer" target="_blank"><h3>약국 제휴하기</h3></a>
   </div>
  </section>
  <details className="home-source-index"><summary>원본 전체 공개 경로 확인</summary>
    <SourceRows links={data.links.filter(x=>x.path!=="/")} go={go} kind="home-directory"/>
  </details>
 </div>;
}
function DoctorScreen({data,go}){
 const[active,setActive]=useState("증상"),[opened,setOpened]=useState("");
 const departments=data.links.filter(v=>v.path.startsWith("/telemedicine/")&&/(과|과\)|의학과)$/.test(v.label.trim())&&!/all-department/.test(v.path));
 const realSymptom=item=>data.links.find(v=>v.path.startsWith("/telemedicine/")&&
   (v.label.trim()===item||v.label.includes("("+item+")")))?.path;
 return <div className="native-doctor-directory"><section className="md-intro"><h1>비대면 진료</h1><p>진료받을 증상이나 진료과를 선택해 주세요.</p></section>
 <NativeApiCatalog resource="doctor-list" title="원본 앱 의사 목록" go={go} compact/>
 <div className="md-tabs"><button className={active==="증상"?"current":""} onClick={()=>setActive("증상")}>증상</button><button className={active==="진료과목"?"current":""} onClick={()=>setActive("진료과목")}>진료과목</button></div>
 {active==="증상"?<div className="md-symptoms">{CATEGORIES.map(([name,desc,icon,items])=><div className="symptom-section" key={name}>
   <button className="symptom-group" onClick={()=>setOpened(opened===name?"":name)} aria-expanded={opened===name}>
     <img src={ORIGINAL+"/_next/static/media/"+icon} alt=""/><span><b>{name}</b><small>{desc}</small></span><ChevronDown size={19}/>
   </button>
   {opened===name&&<div className="symptom-choices">{items.map(item=>{const path=realSymptom(item);return path?<Anchor key={item} go={go} label={item} path={path}/>:<span key={item} className="source-link-pending">{item} · 원본 링크 미확인</span>})}</div>}
  </div>)}</div>:<div className="department-grid">{departments.map(d=><Anchor className="dept-link" go={go} path={d.path} label={d.label} key={d.path}/>)}</div>}
 <details className="md-hidden-links"><summary>전체 증상 · 진료과 링크 보기</summary><SourceRows links={data.links.filter(x=>x.path!=="/")} go={go} kind="telemedicine-directory"/></details>
 </div>;
}
function HospitalScreen({data,go}){
 const[region,setRegion]=useState(""),[dept,setDept]=useState(""),[schedule,setSchedule]=useState(""),[message,setMessage]=useState("");
 const sourceDepts=data.links.filter(v=>v.path.startsWith("/dept-hub/")&&decodeURIComponent(v.path).split("/").filter(Boolean).length===2);
 const availableHours=data.links.filter(v=>v.path.startsWith("/hospital/")&&/야간진료|일요일진료|공휴일진료/.test(decodeURIComponent(v.path)));
 const findRoute=()=>{
    if(schedule){
      const existing=availableHours.find(x=>decodeURIComponent(x.path).includes(schedule));
      return existing?.path+(region?"/"+encodeURIComponent(region):"")||null;
    }
    if(dept){
      const existing=sourceDepts.find(x=>x.label===dept);
      return existing?.path+(region?"/"+encodeURIComponent(region):"")||null;
    }
    if(region)return null;
    return "/hospital";
 };
 const submitSearch=()=>{
    const target=findRoute();
    if(target){setMessage("");go(target)}
    else setMessage("선택 조건에 해당하는 원본 경로가 아직 확보되지 않았습니다.");
 };
 return <><NativeApiCatalog resource="hospital-list" title="원본 앱 병원 목록" go={go} compact/><section className="md-intro md-hospital-intro"><h1>근처 병원 찾기</h1><p>내 주변 문 연 병원을 조건·지역별로 찾아보세요. 야간·일요일 진료 병원의 위치와 영업시간을 나만의닥터에서 확인할 수 있어요.</p></section>
 <section className="md-lookup">
  <label><MapPin size={19}/><select aria-label="지역" value={region} onChange={e=>setRegion(e.target.value)}><option value="">지역</option>{["서울","경기","인천","부산","대구","광주","대전","울산","세종","경남","경북","전남","전북","강원","충남","충북","제주"].map(x=><option key={x} value={x}>{x}</option>)}</select><ChevronDown size={16}/></label>
  <label><BriefcaseMedical size={19}/><select aria-label="진료과" value={dept} onChange={e=>setDept(e.target.value)}><option value="">진료과</option>{DOC_DEPTS.map(x=><option key={x} value={x}>{x}</option>)}</select><ChevronDown size={16}/></label>
  <label><Stethoscope size={19}/><select aria-label="진료 시간" value={schedule} onChange={e=>setSchedule(e.target.value)}><option value="">모든 진료</option><option value="야간진료">야간진료</option><option value="일요일진료">일요일진료</option><option value="공휴일진료">공휴일진료</option></select><ChevronDown size={16}/></label>
  <button className="md-blue-button" onClick={submitSearch}>병원 조회하기</button>
  {message&&<p role="status" className="source-link-pending">{message}</p>}
 </section><section className="md-dept-list"><h2>진료과별 병원</h2><div>{sourceDepts.map(d=><Anchor key={d.path} label={d.label} path={d.path} go={go}/>)}</div></section>
 <section className="md-original-links"><h2>일요일 진료</h2>
 <SourceRows links={data.links.filter(x=>decodeURIComponent(x.path).startsWith("/hospital/일요일진료"))} go={go} kind="hospital-hours"/>
 <h2>야간 진료</h2>
 <SourceRows links={data.links.filter(x=>decodeURIComponent(x.path).startsWith("/hospital/야간진료"))} go={go} kind="hospital-hours"/>
 </section></>;
}
const ORIGINAL_PRICE_CARD_ORDER=[
"마운자로","위고비","삭센다","에페","다이어트약","탈모약","여드름약","독감예방접종","가다실9가","대상포진예방접종",
"수액","치과","시력교정술","MRI검사","상급병실료","초음파-검사","예방접종-백신",
"제증명-수수료","항원-호르몬-유전자-병리-검사","정밀-검사","내시경-검사","MRA-검사",
"주사-치료","물리치료","정신과-상담-치료","처치-및-수술","모발-이식","한방","치료재료","드림렌즈","교육-상담"
];
const ORIGINAL_PRICE_CARD_LABELS={
"다이어트약":"다이어트 경구약","독감예방접종":"독감 예방접종","가다실9가":"가다실 9가",
"대상포진예방접종":"대상포진 예방접종","치과":"치과 치료","시력교정술":"시력교정술",
"MRI검사":"MRI 검사","예방접종-백신":"예방접종 백신","초음파-검사":"초음파 검사",
"제증명-수수료":"제증명 수수료","정밀-검사":"정밀 검사","내시경-검사":"내시경 검사",
"상급병실료":"상급병실료","처치-및-수술":"처치 및 수술","모발-이식":"모발 이식",
"정신과-상담-치료":"정신과 상담·치료"
};
function CostScreen({data,go}){
 const[search,setSearch]=useState("");
 const choices=originalPriceCards.filter(x=>!search||[x.title,x.subtitle].join(" ").includes(search));
 return <div className="native-price-directory">
  <section className="md-cost-intro"><h1>의료비 가격 비교 | 나만의닥터</h1>
   <p>항목별 진료비와 약값을 확인해 보세요.</p>
  </section>
  <div className="md-search-quiet native-price-search"><Search size={19} aria-hidden="true"/>
    <input aria-label="가격 비교 항목 검색" value={search}
      onChange={e=>setSearch(e.target.value)} placeholder="어떤 가격이 궁금하세요?"/>
    {search&&<button type="button" aria-label="검색어 지우기" onClick={()=>setSearch("")}><X size={17}/></button>}
  </div>
  <NativeApiCatalog resource="lowest-price" title="원본 앱 실시간 가격 데이터" go={go} compact/>
  <section className="md-cost-list"><h2>가격 비교 카테고리</h2>
    <div className="md-cost-grid">{choices.map(v=><Anchor key={v.path} className="cost-tile" path={v.path} go={go}>
      <strong>{v.title}</strong>{v.subtitle&&<small>{v.subtitle}</small>}<ChevronRight size={17} className="native-price-arrow"/>
     </Anchor>)}</div>
    {choices.length===0&&<p role="status" className="native-price-empty">검색 결과가 없습니다.</p>}
  </section>
  <section className="md-original-links"><h2>주요 가격 비교</h2>
   <SourceRows links={data.links.filter(x=>!originalPriceCards.some(v=>decodeURIComponent(v.path)===decodeURIComponent(x.path))&&x.path!=="/")} go={go}/>
  </section>
 </div>;
}
function HospitalDetail({data,go}){
 const[tab,setTab]=useState("진료비"),[filter,setFilter]=useState("전체");
 const table=data.tables[0];
 const filtered=table?{...table,rows:table.rows.filter(row=>filter==="전체"||row[0].includes(filter)||(filter==="급여"&&row[0].startsWith("급여")))}:null;
 const labels=["전체","급여","대상포진 예방접종","독감 예방접종"];
 return <><section className="clinic-head"><h1>{data.title}</h1>
 <div className="clinic-location"><div><strong>병원 공개 정보</strong></div><p>{data.address||"원본 주소 정보 미확보"}</p></div>
 <div className="clinic-actions"><a href={ORIGINAL+data.path} target="_blank" rel="noreferrer"><Phone size={17}/>전화</a><a href={"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(data.title)} target="_blank" rel="noreferrer"><Navigation size={17}/>길찾기</a><a href={ORIGINAL+data.path} target="_blank" rel="noreferrer"><House size={17}/>홈페이지</a></div></section>
 <div className="md-clinic-tabs"><button className={tab==="진료비"?"current":""} onClick={()=>setTab("진료비")}>진료비</button><button className={tab==="병원 정보"?"current":""} onClick={()=>setTab("병원 정보")}>병원 정보</button></div>
 {tab==="진료비"?<><section className="clinic-prices"><h2>{data.title} 진료비 안내</h2><p>나만의닥터에서 수집한 {data.title}의 대면 진료비, 약제비, 접종료 등 모든 가격을 확인해보세요.</p></section>
 <div className="price-chips">{labels.map(l=><button key={l} className={filter===l?"current":""} onClick={()=>setFilter(l)}>{l}</button>)}</div>
 <section className="clinic-table"><h3>전체 진료비</h3>{filtered?<CostTable tables={[filtered]}/>:<p>등록된 공개 가격이 없습니다.</p>}</section></>:<section className="clinic-prices"><h2>{data.title} 위치·영업시간</h2><p>{data.address||"원본 주소 정보 미확보"}</p><div>{data.sections.filter(s=>/진료시간|영업시간|운영/.test(s.heading)).map((s,i)=><p key={i}>{s.heading}</p>)}</div></section>}
 <section className="md-original-links"><h2>병원 위치·진료 정보 및 주변 병원</h2>
 {data.sections.filter(s=>!/^(비대면진료|가격비교|병원찾기|약국찾기|의약품 정보|건강 정보|나만의닥터)$/.test(s.heading)).map((s,i)=><h3 key={i}>{s.heading}</h3>)}
 <SourceRows links={data.links.filter(x=>x.path!=="/")} go={go} kind="nearby-clinics"/></section>
 </>;
}
function GenericScreen({data,go}){
 return <section className="md-generic"><h1>{data.title}</h1><p>{data.description}</p>{data.tables.length>0&&<CostTable tables={data.tables}/>}<div>{data.links.slice(0,100).map(x=><Anchor key={x.path} className="generic-row" label={x.label} path={x.path} go={go}/>)}</div>{data.paragraphs.slice(0,6).map((x,i)=><p key={i}>{x}</p>)}</section>;
}
export default function App(){
 const[route,go]=useNavigation(),s=useSource(route),[menu,setMenu]=useState(false),[expanded,setExpanded]=useState("");
 useEffect(()=>setMenu(false),[route]);
 const home=route==="/",hospitalDetail=route.startsWith("/hospital/detail");
 const routeName=(history.state?.sourceLabel||sourceMenu.roots.flatMap(group=>group.groups.flatMap(g=>g.links))
   .find(item=>item.href===route)?.label)||(()=>{try{return decodeURIComponent(route.split("?")[0].split("/").filter(Boolean).pop()||"홈").replace(/-/g," ")}catch{return"선택한 항목"}})();
 const originalTarget=ORIGINAL+route;
 const navParent=["/","/medical-cost","/telemedicine","/telemedicine/all-department",
  "/hospital","/medicine","/pharmacy","/healthLab","/qna"].includes(route)?"/":
   route.startsWith("/medical-cost")?"/medical-cost":
   route.startsWith("/telemedicine")?"/telemedicine/all-department":
   route.startsWith("/medicine")?"/medicine":
   route.startsWith("/pharmacy")?"/pharmacy":
   route.startsWith("/hospital")||route.startsWith("/dept-hub")||route.startsWith("/map")?"/hospital":
   route.startsWith("/qna")||route.startsWith("/healthLab")?"/healthLab":"/";

 const companyPage=isCompanyRoute(route),distinctPage=isOriginalDistinctRoute(route),childEmergency=decodeURIComponent(route.split("?")[0])==="/map/baby119";
 return <div className={"site site-app-native"+(companyPage?" site-company":"")+(distinctPage?" site-original-nine":"")} data-app-reference="mydoctor-6.50.0">{!companyPage&&<header className="topbar native-app-header"><div className="toprow">
 {home?<button className="brand" onClick={()=>{setMenu(false);go("/")}} aria-label="홈"><span className="native-brand">나만의닥터</span></button>:
 <button className="native-app-back" type="button" onClick={()=>go(navParent)}
 aria-label="이전 화면"><ChevronLeft size={24}/><span>{routeName}</span></button>}
 <button className="menu-btn" onClick={()=>setMenu(!menu)} aria-label="전체 메뉴" aria-expanded={menu}>{menu?<X size={24}/>:<Menu size={24}/>}</button></div>
 {menu&&<nav className="dropdown source-menu" aria-label="원본 전체 메뉴" data-testid="source-menu">{sourceMenu.roots.map(root=><section className="source-menu-section" key={root.key}><button className="source-menu-root" aria-expanded={expanded===root.key} onClick={()=>setExpanded(expanded===root.key?"":root.key)}>{root.label}<ChevronDown size={17}/></button>{expanded===root.key&&root.groups.map(group=><div className="source-menu-group" key={group.title}><h3>{group.title}</h3><div className="source-menu-links">{group.links.map((item,i)=><a key={item.href+"-"+i} href={item.href} data-source-href={item.href} onClick={e=>{e.preventDefault();setMenu(false);go(item.href,{label:item.label})}}>{item.label}<ChevronRight size={14}/></a>)}</div></div>)}</section>)}</nav>}
 </header>}{!home&&!companyPage&&<Breadcrumb route={route} go={go}/>}
 <main className="viewport" data-source-quality={s.data?.sourceQuality||"unavailable"} data-original-complete={s.data?.isCompleteOriginalData?"true":"false"}>{s.loading?<div className="source-route-loading" role="status"><div className="source-route-title">{routeName}</div><p>선택한 원본 데이터를 불러오고 있습니다.</p><a href={originalTarget} target="_blank" rel="noreferrer">원본 페이지 바로 열기</a></div>:s.error?<div role="alert" className="error-panel source-route-error"><h1>{routeName}</h1><h2>원본 데이터 조회에 실패했습니다.</h2><p>{s.error}</p><p>저장된 데이터가 없는 경우 원본 사이트의 공개 정보를 확인하실 수 있습니다.</p><div className="source-route-actions"><a href={originalTarget} target="_blank" rel="noreferrer">원본 페이지 열기</a><button onClick={s.refresh}>데이터 다시 불러오기</button></div></div>
 :s.data?(home?<NativeAppHome data={s.data} go={go}/>:route==="/hospital"?<HospitalScreen data={s.data} go={go}/>:route==="/medical-cost"?<CostScreen data={s.data} go={go}/>:(route==="/telemedicine/all-department"||route==="/telemedicine")?<DoctorScreen data={s.data} go={go}/>:hospitalDetail?<HospitalDetail data={s.data} go={go}/>:<VerifiedSourcePage key={route} data={s.data} go={go} route={route}/>):null}
 </main>{!companyPage&&<AppTabBar route={route} go={go} onMenu={()=>setMenu(!menu)} menuOpen={menu}/>}
 </div>;
}
