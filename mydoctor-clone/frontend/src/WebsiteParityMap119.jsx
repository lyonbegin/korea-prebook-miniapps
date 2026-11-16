import React,{useMemo,useState} from "react";
import {Menu,X,MessageCircle,LocateFixed,List,Info,ChevronRight,ChevronDown} from "lucide-react";
import snapshot from "./data/verified-public-page-facts-29.json";
import "./website-parity-map119.css";

const BASE=import.meta.env.BASE_URL||"/";
const facts=snapshot.find(x=>x.path==="/map/119");
/* The original 2026-11-09 browser snapshot's map tile area was empty.
   Do not fabricate live map tiles, locations, emergency queue or bed count.
   Interaction is functional, but the illustrative emergency sheet is
   explicitly labeled as an archived source reference. */
export default function WebsiteParityMap119({go}){
 const [menu,setMenu]=useState(false);
 const [tab,setTab]=useState("응급실");
 const [sheet,setSheet]=useState(true);
 const [message,setMessage]=useState("");
 const regions=useMemo(()=>(facts?.links||[]).filter(x=>x.label.endsWith("응급실")).slice(0,20),[]);
 const share=async()=>{
  const url=location.href;
  try{
   if(navigator.share)await navigator.share({title:"나만의닥터 119 지도",url});
   else if(navigator.clipboard){await navigator.clipboard.writeText(url);setMessage("주소를 복사했습니다.")}
   else setMessage(url);
  }catch{setMessage("공유가 취소되었습니다.")}
 };
 const locate=()=>{
  if(!navigator.geolocation){setMessage("이 브라우저는 현재 위치를 지원하지 않습니다.");return;}
  navigator.geolocation.getCurrentPosition(
   ()=>setMessage("현재 위치를 확인했습니다. 실시간 의료기관 정보는 연결되지 않았습니다."),
   ()=>setMessage("위치 권한을 확인해 주세요."),{timeout:5000,enableHighAccuracy:false});
 };
 return <div className="ow-map119" data-testid="website-source-emergency-map">
  <header className="owh-header">
   <button type="button" className="owh-brand" onClick={()=>go("/")} aria-label="나만의닥터 홈">
    <img src={BASE+"website-source-hospital-brand.png"} alt="나만의닥터"/></button>
   <button type="button" className="owh-menu-btn" onClick={()=>setMenu(v=>!v)} aria-label={menu?"메뉴 닫기":"메뉴 열기"}>{menu?<X size={22}/>:<Menu size={22}/>}</button>
   {menu&&<nav className="owh-dropdown"><button type="button" onClick={()=>go("/hospital")}>병원 찾기</button><button type="button" onClick={()=>go("/map/baby119")}>소아 응급 지도</button></nav>}
  </header>
  <nav className="ow-map119-breadcrumb" aria-label="현재 위치"><button type="button" onClick={()=>go("/")}>홈</button><span>›</span><button type="button" onClick={()=>go("/hospital")}>병원찾기</button><span>›</span><strong>119 지도</strong></nav>
  <div className="ow-map119-blue">
   <div><span>나만의닥터</span><strong>119 지도</strong></div>
   <button type="button" onClick={share}>공유 <MessageCircle size={15} fill="#171c22"/></button>
  </div>
  <nav className="ow-map119-tabs" aria-label="119 지도 종류">{["응급실","병원","약국","비대면 진료"].map(name=>
   <button type="button" key={name} className={tab===name?"current":""} onClick={()=>{
    if(name==="비대면 진료")go("/telemedicine");else setTab(name);
   }}>{name}</button>)}</nav>
  <div className="ow-map119-canvas" aria-label="원본 지도 영역, 의료기관 실시간 데이터 미연결">
   <div className="ow-map119-controls">
    <button type="button" className="ow-map119-list" onClick={()=>setSheet(x=>!x)}><List size={18}/> {sheet?"목록 보기":"지도 보기"}</button>
    <button type="button" className="ow-map119-locate" onClick={locate} aria-label="현재 위치"><LocateFixed size={23}/></button>
   </div>
   {message&&<div className="ow-map119-message" role="status" onClick={()=>setMessage("")}>{message}</div>}
  </div>
  {sheet&&<section className="ow-map119-sheet">
   <div className="ow-map119-handle"/>
   <div className="ow-map119-notice"><Info size={17} fill="#fff" stroke="#383e45"/>
    병원을 누르면 응급실 번호를 볼 수 있어요!</div>
   <div className="ow-map119-hospital-source"><strong>삼성서울병원</strong>
    <p>소아 응급실 <span>원본 기록 · 실시간 현황 아님</span></p>
   </div>
   <details className="ow-map119-regions"><summary>지역별 응급실 찾기 <ChevronDown size={16}/></summary>
    {regions.map(x=><button type="button" key={x.path} onClick={()=>go(x.path)}>{x.label}<ChevronRight size={14}/></button>)}
   </details>
  </section>}
 </div>;
}