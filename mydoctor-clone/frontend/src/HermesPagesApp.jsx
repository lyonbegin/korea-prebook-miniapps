import React,{useEffect,useMemo,useState} from "react";
import {Home,Hospital,Stethoscope,Tags,ChevronLeft,ChevronRight,Search,X,FileText} from "lucide-react";
import HermesSourceWebScreen from "./HermesSourceWebScreen.jsx";
import HermesPagesDetail from "./HermesPagesDetail.jsx";
import {publicMenuGroups,publicLinks} from "./HermesPagesStaticData.js";
import "./hermes-pages.css";

const ROOT=import.meta.env.BASE_URL||"/";
const pageUrl=(screen="home",target="")=>ROOT+"?screen="+encodeURIComponent(screen)+(target?"&target="+encodeURIComponent(target):"");
const parsePage=()=>{
  const q=new URLSearchParams(window.location.search);
  const screen=q.get("screen")||"home";
  const valid=["home","hospital-list","telemedicine","medical-cost","pharmacy","health","detail"];
  return {screen:valid.includes(screen)?screen:"home",target:q.get("target")||""};
};
function resolveRoute(raw){
  if(!raw||raw==="/")return {screen:"home",target:""};
  let path=raw;
  if(raw.startsWith("/native/hermes-preview?")){
    const q=new URLSearchParams(raw.split("?")[1]);
    return {screen:q.get("screen")==="hospital-list"?"hospital-list":"home",target:""};
  }
  if(raw.startsWith("/dept-hub/")||raw.startsWith("/map/"))
    return {screen:"detail",target:raw};
  if(raw.startsWith("/hospital/"))return {screen:"detail",target:raw};
  if(raw==="/hospital")return {screen:"hospital-list",target:""};
  if(raw==="/telemedicine"||raw==="/telemedicine/all-department")
    return {screen:"telemedicine",target:""};
  if(raw.startsWith("/telemedicine/"))return {screen:"detail",target:raw};
  if(raw==="/medical-cost")return {screen:"medical-cost",target:""};
  if(raw.startsWith("/medical-cost/"))return {screen:"detail",target:raw};
  if(raw==="/pharmacy")return {screen:"pharmacy",target:""};
  if(raw==="/healthLab"||raw==="/qna"||raw==="/medicine")
    return {screen:"health",target:""};
  if(raw.startsWith("/pharmacy/")||raw.startsWith("/healthLab/")||raw.startsWith("/medicine/")||raw.startsWith("/qna/"))
    return {screen:"detail",target:raw};
  // Keep unsupported observed public links inside the mobile web instead of silently
  // jumping back to Home. These use the factual detail view's internal renderer.
  if(raw.startsWith("/")&&!raw.startsWith("//"))return {screen:"detail",target:raw};
  return {screen:"home",target:""};
}
const MENU=[
 {screen:"home",label:"홈",Icon:Home},
 {screen:"telemedicine",label:"비대면 진료",Icon:Stethoscope},
 {screen:"medical-cost",label:"가격 비교",Icon:Tags},
 {screen:"hospital-list",label:"병원 찾기",Icon:Hospital}
];
function Header({title,onBack,subTitle}){
  return <header className="gh-hermes-header">
    <button type="button" onClick={onBack} aria-label="뒤로 가기"><ChevronLeft size={23}/></button>
    <div><strong>{title}</strong>{subTitle&&<small>{subTitle}</small>}</div>
  </header>;
}
function Directory({groupKey,title,go}){
  const [term,setTerm]=useState("");
  const grouped=useMemo(()=>publicMenuGroups(groupKey),[groupKey]);
  const needle=term.trim().toLocaleLowerCase("ko-KR");
  const rows=useMemo(()=>grouped.map(g=>({
    ...g,links:g.links.filter(item=>
      !needle||item.label.toLocaleLowerCase("ko-KR").includes(needle))
  })).filter(g=>g.links.length),[grouped,needle]);
  const all=publicLinks(groupKey);
  return <div className="gh-directory" data-testid="pages-static-directory">
    <Header title={title} subTitle="진료·가격·병원 메뉴" onBack={()=>go("/")}/>
    {groupKey==="hospital"&&
      <div className="gh-evidence-note">Hermes #48385·#48386 병원 목록: 실제 병원 명단은 로그인 필요(원본 API 401). 아래는 수집된 공개 진료과·지역 탐색 링크입니다.</div>}
    <form role="search" className="gh-directory-search" onSubmit={e=>e.preventDefault()}>
      <Search size={20}/><input type="search" aria-label={title+" 검색"}
        value={term} placeholder="메뉴 또는 진료과 검색"
        onChange={e=>setTerm(e.target.value)}/>
      {term&&<button type="button" aria-label="검색어 지우기" onClick={()=>setTerm("")}><X size={19}/></button>}
    </form>
    <p className="gh-directory-count">공개 원본 메뉴 {rows.reduce((a,g)=>a+g.links.length,0)}개 / 전체 {all.length}개</p>
    {rows.map(group=><section key={group.title} className="gh-directory-section">
      <h2>{group.title}</h2>
      {group.links.map(item=><button type="button" className="gh-directory-row"
          key={item.path} onClick={()=>go(item.path)} aria-label={item.label+" 상세"}>
        <span>{item.label}</span><ChevronRight size={17}/></button>)}
    </section>)}
    {!rows.length&&<p className="gh-directory-empty">해당하는 공개 메뉴가 없습니다.</p>}
  </div>;
}
function BottomTabs({screen,target,go}){
  const selected=screen==="detail"?(target.startsWith("/medical-cost/")?"medical-cost":
     target.startsWith("/telemedicine/")?"telemedicine":"hospital-list"):screen;
  return <nav className="gh-bottom-tabs" aria-label="모바일 웹 하단 메뉴">
    {MENU.map(({screen:id,label,Icon})=><a href={pageUrl(id)} key={id}
        aria-current={selected===id?"page":undefined}
        onClick={e=>{e.preventDefault();go(id==="home"?"/":id==="hospital-list"?"/hospital":id==="medical-cost"?"/medical-cost":"/telemedicine")}}
        className={selected===id?"gh-tab active":"gh-tab"}>
      <Icon size={21} strokeWidth={selected===id?2.25:1.8}/><span>{label}</span>
    </a>)}
  </nav>;
}
export default function HermesPagesApp(){
  const [page,setPage]=useState(parsePage);
  useEffect(()=>{
    const onBack=()=>{setPage(parsePage());window.scrollTo({top:0})};
    window.addEventListener("popstate",onBack);
    document.title="나만의닥터 | Hermes UI 모바일 웹";
    return ()=>window.removeEventListener("popstate",onBack);
  },[]);
  const go=(raw)=>{
    const next=resolveRoute(raw);
    history.pushState(null,"",pageUrl(next.screen,next.target));
    setPage(next);
    window.scrollTo({top:0,behavior:"instant"});
  };
  return <div className="gh-hermes-site" data-testid="github-pages-hermes-app">
    <main className="gh-hermes-main" id="main">
      {page.screen==="home"&&<HermesSourceWebScreen screen="home" staticMode go={go}/>}
      {page.screen==="hospital-list"&&<Directory key="hospital" groupKey="hospital" title="병원 찾기" go={go}/>}
      {page.screen==="telemedicine"&&<Directory key="telemedicine" groupKey="telemedicine" title="비대면 진료" go={go}/>}
      {page.screen==="medical-cost"&&<Directory key="price" groupKey="price" title="최저가 병원 예약 · 가격 비교" go={go}/>}
      {page.screen==="pharmacy"&&<Directory key="pharmacy" groupKey="pharmacy" title="약국 찾기" go={go}/>}
      {page.screen==="health"&&<Directory key="health" groupKey="health" title="건강 정보" go={go}/>}
      {page.screen==="detail"&&<HermesPagesDetail target={page.target} go={go} back={()=>history.length>1?history.back():go("/")}/>}
      <footer className="gh-pages-source-footer">
        <FileText size={15}/> Android 6.50.0 Hermes 확인 레이아웃 + 공개 메뉴 정적 자료 · GitHub Pages
      </footer>
    </main>
    <BottomTabs screen={page.screen} target={page.target} go={go}/>
  </div>;
}
