import React,{useEffect,useMemo,useState}from"react";
import{Activity,ArrowLeft,ArrowRight,CalendarCheck,ChevronDown,ChevronRight,Clock3,HeartPulse,Home,MapPin,Menu,Phone,Search,ShieldCheck,Stethoscope,X}from"lucide-react";
import{fetchSource}from"./lib/originalGateway.js";
import{MAIN_LINKS,localPath,parseSource,routeFromLocation}from"./lib/sourceModel.js";
const NAV=[{title:"홈",path:"/",icon:Home},{title:"비대면 진료",path:"/telemedicine/all-department",icon:Stethoscope},{title:"병원 찾기",path:"/hospital",icon:MapPin},{title:"가격 비교",path:"/medical-cost",icon:Activity}];
function useNavigation(){
 const [route,setRoute]=useState(routeFromLocation);
 useEffect(()=>{const changed=()=>{setRoute(routeFromLocation());window.scrollTo(0,0)};addEventListener("popstate",changed);return()=>removeEventListener("popstate",changed)},[]);
 const go=path=>{if(!path||!path.startsWith("/")||path.startsWith("//"))return;history.pushState(null,"",path);setRoute(routeFromLocation());window.scrollTo(0,0)};
 return[route,go];
}
function usePublicData(route){
 const [state,setState]=useState({loading:true,data:null,error:"",url:route});
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
   const c=new AbortController();
   setState({loading:true,data:null,error:"",url:route});
   fetchSource(route,c.signal).then(html=>{
    const data=parseSource(html,route);
    if(!c.signal.aborted)setState({loading:false,data,error:data.hasSourceData?"":"원본 데이터 구조를 읽지 못했습니다.",url:route});
   }).catch(e=>{if(!c.signal.aborted)setState({loading:false,data:null,error:String(e.message||e),url:route})});
   return()=>c.abort();
 },[route,retry]);
 return {...state,refresh:()=>setRetry(x=>x+1)};
}
function Anchor({item,go,children,className=""}){
 return <a className={className} href={item.path} onClick={e=>{e.preventDefault();go(item.path)}}>{children||item.label}<ChevronRight size={16}/></a>
}
function LinkCards({rows,go,title}){
 if(!rows.length)return null;
 return <section className="section card-section"><h2>{title}</h2><div className="card-list">
   {rows.map((v,i)=><Anchor key={v.path+"-"+i} className="list-card" item={{path:v.path,label:v.title||v.label}} go={go}/>)}
 </div></section>
}
function PriceTables({tables}){
 return tables.map((table,i)=><section className="section cost-table-section" key={i}>
  <h2>{i===0?"진료비 안내":"상세 비교"}</h2><div className="table-scroll"><table>
  {!!table.headers.length&&<thead><tr>{table.headers.map((v,j)=><th key={j}>{v}</th>)}</tr></thead>}
  <tbody>{table.rows.map((row,j)=><tr key={j}>{row.map((v,k)=><td key={k}>{v}</td>)}</tr>)}</tbody>
  </table></div></section>)
}
function HomeScreen({data,go}){
 const cards=[
  {title:"비대면 진료",desc:"증상과 진료과를 선택하세요",icon:Stethoscope,path:"/telemedicine/all-department"},
  {title:"내 주변 병원 찾기",desc:"지역과 진료과별로 병원 확인",icon:MapPin,path:"/hospital"},
  {title:"의료비 가격 비교",desc:"진료·검사·시술 가격 정보",icon:Activity,path:"/medical-cost"}];
 return <><section className="home-hero"><div className="hero-eyebrow">나만의닥터</div>
  <h1>{data.title||"원본 홈페이지를 확인하는 중"}</h1><p>{data.description}</p>
  <Anchor className="hero-primary" go={go} item={{path:"/telemedicine/all-department",label:"비대면 진료 시작하기"}}>비대면 진료 시작하기</Anchor>
  </section><div className="quick-grid">{cards.map(({title,desc,icon:Icon,path})=>
  <button className="quick-card" key={path} onClick={()=>go(path)}><Icon size={24}/><strong>{title}</strong><small>{desc}</small><ArrowRight size={16}/></button>)}</div>
  <LinkCards rows={data.categories} go={go} title="병원·의료비 살펴보기"/>
  <LinkCards rows={data.links.filter(l=>/healthLab|telemedicine|medical-cost/.test(l.path)).slice(0,24)} go={go} title="건강정보 및 서비스"/>
 </>;
}
function HospitalScreen({data,go}){
 const [search,setSearch]=useState("");
 const rows=data.links.filter(x=>/hospital/.test(x.path)&&(!search||x.label.includes(search))).slice(0,150);
 return <><section className="page-heading"><h1>{data.title||"근처 병원 찾기"}</h1><p>{data.description}</p></section>
  <div className="search-field"><Search size={19}/><input aria-label="병원 및 지역 검색" placeholder="지역·진료과 검색" value={search} onChange={e=>setSearch(e.target.value)}/></div>
  <LinkCards rows={rows} go={go} title="지역·진료과별 병원"/>
  {data.paragraphs.length>0&&<section className="section muted-text"><p>{data.paragraphs[0]}</p></section>}</>;
}
function CostScreen({data,go}){
 const [search,setSearch]=useState("");
 const cards=data.categories.filter(x=>!search||x.title.includes(search));
 return <><section className="page-heading"><h1>{data.title||"의료비 가격 비교"}</h1><p>{data.description}</p></section>
  <div className="search-field"><Search size={19}/><input aria-label="가격 비교 항목 검색" placeholder="치과·MRI·라식 등 검색" value={search} onChange={e=>setSearch(e.target.value)}/></div>
  <LinkCards rows={cards} go={go} title="가격 비교 카테고리"/>
  <PriceTables tables={data.tables}/></>;
}
function TelemedicineScreen({data,go}){
 const doctors=data.links.filter(x=>x.path.startsWith("/telemedicine/")).slice(0,140);
 return <><section className="page-heading"><span className="heading-tag">비대면 진료</span>
  <h1>{data.title||"증상·진료과 선택"}</h1><p>{data.description}</p></section>
  <LinkCards rows={doctors} go={go} title="진료과와 증상 선택"/>
  <PriceTables tables={data.tables}/></>;
}
function DetailScreen({data,go}){
 const address=data.paragraphs.find(v=>/시|군|구|동|로|길/.test(v)&&v.length<220)||"";
 return <><section className="page-heading"><span className="heading-tag">공개 병원 정보</span><h1>{data.title}</h1>
  {!!address&&<p><MapPin size={17}/>{address}</p>}</section>
  <PriceTables tables={data.tables}/>
  <LinkCards rows={data.links.filter(x=>x.path.startsWith("/hospital")).slice(0,20)} go={go} title="관련 병원"/>
  {!!data.hours.length&&<section className="section"><h2>진료 시간</h2>{data.hours.map(x=><p key={x.heading}>{x.heading}</p>)}</section>}
  <p className="legal-note">실제 예약·진료는 원본 서비스 또는 해당 의료기관을 통해 확인됩니다.</p></>;
}
function GenericScreen({data,go}){
 return <><section className="page-heading"><h1>{data.title}</h1><p>{data.description}</p></section>
   <PriceTables tables={data.tables}/>
   <LinkCards rows={data.links.slice(0,120)} go={go} title="관련 항목"/>
   {data.paragraphs.slice(0,18).map((v,i)=><p className="body-paragraph" key={i}>{v}</p>)}</>;
}
export default function App(){
 const [route,go]=useNavigation();
 const state=usePublicData(route);
 const [menu,setMenu]=useState(false);
 useEffect(()=>setMenu(false),[route]);
 const label=NAV.find(x=>x.path===route)?.title||"상세 정보";
 return <div className="site"><header className="topbar">
  <div className="toprow">{route==="/"?<button className="brand" onClick={()=>go("/")} aria-label="홈">나만의닥터<span className="brand-dot">.</span></button>
   :<button className="back" onClick={()=>history.length>1?history.back():go("/")} aria-label="뒤로 가기"><ArrowLeft size={22}/></button>}
   <span className="top-title">{route==="/"?"":label}</span>
   <button className="menu-btn" aria-label="전체 메뉴" onClick={()=>setMenu(!menu)}>{menu?<X size={23}/>:<Menu size={23}/>}</button></div>
  {menu&&<div className="dropdown">{NAV.map(n=><button key={n.path} onClick={()=>go(n.path)}>{n.title}<ChevronRight size={16}/></button>)}</div>}
  </header>
  <main className="viewport" data-testid="page-content">
    {state.loading?<div className="loading" role="status"><span className="spinner"/>원본 공개 정보를 읽는 중입니다.</div>
    :state.error?<div className="error-panel" role="alert"><h2>원본 데이터 검증 필요</h2><p>{state.error}</p><button onClick={state.refresh}>다시 조회</button></div>
    :state.data?<>{route==="/"?<HomeScreen data={state.data} go={go}/>
      :route.startsWith("/hospital/detail")?<DetailScreen data={state.data} go={go}/>
      :route==="/hospital"?<HospitalScreen data={state.data} go={go}/>
      :route==="/medical-cost"?<CostScreen data={state.data} go={go}/>
      :route.startsWith("/telemedicine")?<TelemedicineScreen data={state.data} go={go}/>
      :<GenericScreen data={state.data} go={go}/>}</>
    :null}
  </main>
  <nav className="bottomnav" aria-label="주요 서비스">{NAV.map(({title,path,icon:Icon})=>
   <button key={path} aria-current={route===path?"page":undefined} className={route===path?"active":""} onClick={()=>go(path)}><Icon size={21}/><small>{title}</small></button>)}</nav>
  <footer className="source-note">공개 원본 자료 기반 개발·검증용 독립 서비스</footer>
 </div>;
}
