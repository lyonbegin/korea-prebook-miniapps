import React,{useEffect,useState}from"react";
import{ChevronDown,ChevronRight,Menu,X,MapPin,BriefcaseMedical,Stethoscope,Phone,Navigation,House,Clock3}from"lucide-react";
import{fetchPublicFacts}from"./lib/originalGateway.js";
import{parsePublicFacts,routeFromLocation}from"./lib/sourceModel.js";
import sourceMenu from "./data/original-menu-20261109.json";
import{VerifiedSourcePage}from"./VerifiedSourcePage.jsx";

const ORIGINAL="https://my-doctor.io";
const NAV=[["홈","/"],["비대면 진료","/telemedicine/all-department"],["병원 찾기","/hospital"],["가격 비교","/medical-cost"],["약국 찾기","/pharmacy"],["의약품 정보","/medicine"],["건강연구소","/healthLab"]];
const CATEGORIES=[
["귀/코/목 질환","비염, 중이염, 인후염 등","ear.2vueof9c3v0uq.svg",["비염","중이염","인후염","축농증"]],
["만성질환","고지혈증, 고혈압, 당뇨병 등","diabetes.090stcs374avd.svg",["고지혈증","고혈압","당뇨병"]],
["비뇨기 질환","방광염, 전립선염, 요실금 등","kidney.1t1_1unm2wlc1.svg",["방광염","전립선염","요실금"]],
["소화기 질환","속쓰림, 장염, 위염 등","stomache.2ca46vciyelst.svg",["속쓰림","장염","위염"]],
["신경 질환","두통, 편두통, 안면경련 등","brain.3ieuexq3w4qcx.svg",["두통","편두통","안면경련"]],
["안구 질환","안구건조증, 결막염, 다래끼 등","eye.29a209_iyho6n.svg",["안구건조증","결막염","다래끼"]],
["여성 질환","질염, 생리통, 생리불순 등","female.454xcj48d_sp8.svg",["질염","생리통","생리불순"]]
];
const DOC_DEPTS=["가정의학과","결핵과","내과","마취통증의학과","방사선종양학과","병리과","비뇨의학과","사상체질과","산부인과","성형외과","소아청소년과","신경과","신경외과","안과","영상의학과","예방의학과","외과","응급의학과","이비인후과","재활의학과","정신건강의학과","정형외과","직업환경의학과","진단검사의학과","치과","침구과","피부과","한방내과","한방부인과","한방소아과"];
const PRICEDESC={"마운자로":"나만의닥터 마운자로 최저가 비교","위고비":"나만의닥터 위고비, 오젬픽 등 최저가 비교","에페":"나만의닥터 에페 최저가 비교","탈모약":"피나스테리드, 두타스테리드 등 최저가 비교","여드름약":"이소트레티노인, 클린다마이신 등 최저가 비교","독감예방접종":"독감 백신 전국 최저가 가격 비교"};
function useNavigation(){
 const[route,setRoute]=useState(routeFromLocation);
 useEffect(()=>{const f=()=>{setRoute(routeFromLocation());window.scrollTo(0,0)};window.addEventListener("popstate",f);return()=>window.removeEventListener("popstate",f)},[]);
 const go=path=>{if(typeof path!=="string"||!path.startsWith("/")||path.startsWith("//"))return;history.pushState(null,"",path);setRoute(routeFromLocation());window.scrollTo(0,0)};
 return[route,go];
}
function useSource(route){
 const[state,setState]=useState({data:null,loading:true,error:""});
 const[retry,setRetry]=useState(0);
 useEffect(()=>{const c=new AbortController();setState({data:null,loading:true,error:""});
  fetchPublicFacts(route,c.signal).then(payload=>{const data=parsePublicFacts(payload,route);if(!c.signal.aborted)setState({data,loading:false,error:data.hasSourceData?"":"원본 데이터 구조를 확인할 수 없습니다."})})
  .catch(e=>{if(!c.signal.aborted)setState({data:null,loading:false,error:String(e.message||e)})});return()=>c.abort();
 },[route,retry]);return{...state,refresh:()=>setRetry(x=>x+1)};
}
function Anchor({label,path,go,children,className=""}){return <a href={path} className={className} onClick={e=>{e.preventDefault();go(path)}}>{children||label}</a>}
function Breadcrumb({route,go}){
 const medical=route.startsWith("/medical-cost"),doctor=route.startsWith("/telemedicine"),hospital=route.startsWith("/hospital");
 const detailed=route.startsWith("/hospital/detail");
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
  <div className="md-awards">♕ 2026 대한민국 소비자 브랜드 대상 진료 부문 1위 ♕<br/>♕ 2024 중앙일보 올해의 우수브랜드대상 · 비대면진료 부문 1위 ♕<br/>♕ 2022 대한민국소비자브랜드 대상 · 서비스만족도 1위 ♕</div>
  <div className="md-stats"><span>활성유저수 <b>1위¹</b><br/>회원수 <b>300만+</b></span><span>매출액 <b>1위²</b><br/>앱스토어 평점 <b>4.8점</b></span></div>
  <div className="md-stat-notes"><p>1 모바일인덱스 추정 기준 비대면진료 앱 월간 활성 이용자 수(MAU)<br/>　2026년 1월~8월 8개월 연속 1위 (Android+iOS 합산)</p><p>2 비대면진료 앱 운영사 4개사 2025년 매출액<br/>　(각 사 공시 재무제표 기준)</p></div>
  <img className="md-home-hero" src="https://my-doctor.io/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fhero-mockup.27qja46teurqn.webp&w=750&q=75" alt="나만의닥터 앱 사용 화면"/>
 </section><section className="md-below"><h2>전국민 누구나, 언제든 어디서나 전화 진료</h2><p>24시간 365일, 전화 한 통으로 진료받고 가까운 약국에서 약을 수령하세요.</p>
 <Anchor className="blue-cta-inline" path="/telemedicine/all-department" label="비대면 진료 시작하기" go={go}/>
 <h2>최저가 병원 예약</h2><Anchor path="/medical-cost" label="진료비 가격 비교" go={go}/>
 </section></>;
}
function DoctorScreen({data,go}){
 const[active,setActive]=useState("증상"),[opened,setOpened]=useState("");
 const departments=data.links.filter(v=>v.path.startsWith("/telemedicine/")&&!/all-department/.test(v.path));
 return <><section className="md-intro"><h1>비대면 진료 예약</h1><p>앱 다운로드 없이 비대면 진료를 예약하려면, <a href={ORIGINAL+"/telemedicine/all-department"} target="_blank" rel="noreferrer">나만의닥터</a>에서 증상 선택 &gt; 의사 선택 &gt; 증상/예약 정보 입력을 진행해주세요.</p></section>
 <div className="md-tabs"><button className={active==="증상"?"current":""} onClick={()=>setActive("증상")}>증상</button><button className={active==="진료과목"?"current":""} onClick={()=>setActive("진료과목")}>진료과목</button></div>
 {active==="증상"?<div className="md-symptoms">{CATEGORIES.map(([name,desc,icon,items])=><div className="symptom-section" key={name}>
   <button className="symptom-group" onClick={()=>setOpened(opened===name?"":name)} aria-expanded={opened===name}>
     <img src={ORIGINAL+"/_next/static/media/"+icon} alt=""/><span><b>{name}</b><small>{desc}</small></span><ChevronDown size={19}/>
   </button>
   {opened===name&&<div className="symptom-choices">{items.map(item=><Anchor key={item} go={go} label={item} path={"/telemedicine/"+encodeURIComponent(item+"-비대면진료-예약")}/>)}</div>}
  </div>)}</div>:<div className="department-grid">{departments.map(d=><Anchor className="dept-link" go={go} path={d.path} label={d.label} key={d.path}/>)}</div>}
 </>;
}
function HospitalScreen({data,go}){
 const[region,setRegion]=useState(""),[dept,setDept]=useState(""),[schedule,setSchedule]=useState("");
 return <><section className="md-intro md-hospital-intro"><h1>근처 병원 찾기</h1><p>내 주변 문 연 병원을 조건·지역별로 찾아보세요. 야간·일요일 진료 병원의 위치와 영업시간을 나만의닥터에서 확인할 수 있어요.</p></section>
 <section className="md-lookup">
  <label><MapPin size={19}/><select aria-label="지역" value={region} onChange={e=>setRegion(e.target.value)}><option value="">지역</option>{["서울","경기","인천","부산","대구","광주","대전","울산","세종","경남","경북","전남","전북","강원","충남","충북","제주"].map(x=><option key={x} value={x}>{x}</option>)}</select><ChevronDown size={16}/></label>
  <label><BriefcaseMedical size={19}/><select aria-label="진료과" value={dept} onChange={e=>setDept(e.target.value)}><option value="">진료과</option>{DOC_DEPTS.map(x=><option key={x} value={x}>{x}</option>)}</select><ChevronDown size={16}/></label>
  <label><Stethoscope size={19}/><select aria-label="진료 시간" value={schedule} onChange={e=>setSchedule(e.target.value)}><option value="">모든 진료</option><option value="야간진료">야간진료</option><option value="일요일진료">일요일진료</option><option value="공휴일진료">공휴일진료</option></select><ChevronDown size={16}/></label>
  <button className="md-blue-button" onClick={()=>{if(schedule)go("/hospital/"+encodeURIComponent(schedule)+(region?"/"+encodeURIComponent(region):""));else go("/hospital")}}>병원 조회하기</button>
 </section><section className="md-dept-list"><h2>진료과별 병원</h2><div>{DOC_DEPTS.map(d=><Anchor key={d} label={d} path={"/telemedicine/"+encodeURIComponent(d+"-비대면진료-예약")} go={go}/>)}</div></section></>;
}
function CostScreen({data,go}){
 const[search,setSearch]=useState("");
 const choices=data.categories.filter(x=>!search||x.title.includes(search));
 return <><section className="md-cost-intro"><h1>의료비 가격 비교 | 나만의닥터</h1><p>나만의닥터에서 비급여 진료비와 의료비 가격을 비교해 보세요. 치과 치료, 시력교정술, MRI 검사, 예방접종 백신, 초음파 검사, 상급병실료 등 병원 가격을 지역별로 확인할 수 있어요.</p></section>
 <section className="md-cost-list"><h2>가격 비교 카테고리</h2><div className="md-cost-grid">{choices.map(v=><Anchor key={v.path} className="cost-tile" path={v.path} go={go}><strong>{v.title}</strong><small>{PRICEDESC[v.title]||""}</small></Anchor>)}</div></section>
 <div className="md-search-quiet"><input aria-label="가격 비교 항목 검색" value={search} onChange={e=>setSearch(e.target.value)} placeholder="가격 비교 항목 검색"/></div></>;
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
 </>;
}
function GenericScreen({data,go}){
 return <section className="md-generic"><h1>{data.title}</h1><p>{data.description}</p>{data.tables.length>0&&<CostTable tables={data.tables}/>}<div>{data.links.slice(0,100).map(x=><Anchor key={x.path} className="generic-row" label={x.label} path={x.path} go={go}/>)}</div>{data.paragraphs.slice(0,6).map((x,i)=><p key={i}>{x}</p>)}</section>;
}
export default function App(){
 const[route,go]=useNavigation(),s=useSource(route),[menu,setMenu]=useState(false),[expanded,setExpanded]=useState("");
 useEffect(()=>setMenu(false),[route]);
 const home=route==="/",hospitalDetail=route.startsWith("/hospital/detail");
 return <div className="site"><header className="topbar"><div className="toprow">
 <button className="brand" onClick={()=>go("/")} aria-label="홈"><img src={ORIGINAL+"/_next/static/media/logo.0ye495etchd_w.svg"} alt="나만의닥터"/></button>
 <button className="menu-btn" onClick={()=>setMenu(!menu)} aria-label="전체 메뉴">{menu?<X size={25}/>:<Menu size={24}/>}</button></div>
 {menu&&<nav className="dropdown source-menu" aria-label="원본 전체 메뉴" data-testid="source-menu">{sourceMenu.roots.map(root=><section className="source-menu-section" key={root.key}><button className="source-menu-root" aria-expanded={expanded===root.key} onClick={()=>setExpanded(expanded===root.key?"":root.key)}>{root.label}<ChevronDown size={17}/></button>{expanded===root.key&&root.groups.map(group=><div className="source-menu-group" key={group.title}><h3>{group.title}</h3><div className="source-menu-links">{group.links.map((item,i)=><a key={item.href+"-"+i} href={item.href} data-source-href={item.href} onClick={e=>{e.preventDefault();go(item.href)}}>{item.label}<ChevronRight size={14}/></a>)}</div></div>)}</section>)}</nav>}
 </header>{!home&&<Breadcrumb route={route} go={go}/>}
 <main className="viewport">{s.data&&<div className="source-quality" role="status">DB 공개 사실 데이터 · {s.data.sourceQuality==="heading_only"?"제목만 확보":s.data.sourceQuality==="verified_title_and_global_navigation"?"메뉴·제목 확보":s.data.sourceQuality==="verified_public_factual_price_rows"?"가격표 확인":"공개 메타데이터 확인"} · 전체 원본 기능 동일성 검증 전</div>}{s.loading?<p className="loading" role="status">공개 원본 정보를 불러오는 중입니다.</p>:s.error?<div role="alert" className="error-panel"><h2>원본 데이터 검증 필요</h2><p>{s.error}</p><button onClick={s.refresh}>다시 조회</button></div>
 :s.data?(home?<HomeScreen data={s.data} go={go}/>:route==="/hospital"?<HospitalScreen data={s.data} go={go}/>:route==="/medical-cost"?<CostScreen data={s.data} go={go}/>:route==="/telemedicine/all-department"?<DoctorScreen data={s.data} go={go}/>:hospitalDetail?<HospitalDetail data={s.data} go={go}/>:<VerifiedSourcePage data={s.data} go={go} route={route}/>):null}
 </main>{(home||hospitalDetail)&&<a className={home?"fixed-call-to-action":"fixed-call-to-action clinic-action-fixed"} href={home?ORIGINAL:ORIGINAL+"/hospital/detail?hospital_id=323"} target="_blank" rel="noreferrer">{home?"나만의 닥터 다운로드":"진료 예약하기"}</a>}
 </div>;
}
