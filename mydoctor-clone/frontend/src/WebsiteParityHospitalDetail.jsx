import React,{useMemo,useState} from "react";
import {Menu,X,ChevronRight,MapPin,Clock3,Phone,Navigation,House,ShieldCheck} from "lucide-react";
import facts from "./data/verified-public-page-facts-29.json";
import "./website-parity-hospital-detail.css";
import "./website-parity-hospital.css";

/* Faithful, interactive reimplementation of the REAL public-web screenshot
 * https://my-doctor.io/hospital/detail?hospital_id=323 captured 2026-11-09.
 * Patient/doctor identity, clinic hours and price claims remain snapshot
 * facts, never fabricated live appointment availability.
 */
const SOURCE=facts.find(x=>x.path==="/hospital/detail?hospital_id=323");
const BASE=import.meta.env.BASE_URL||"/";
const PRICES=SOURCE?.tables?.[0]||{headers:[],rows:[]};
const LABELS=["전체","급여","대상포진 예방접종","독감 예방접종"];
const NAME=SOURCE?.headline||"창원한마음병원";
const ADDRESS="경남 창원시 의창구 용동로57번길 8";
const PHONE="055-225-0000"; // Phone retained in captured public page's source link.
export default function WebsiteParityHospitalDetail({go}){
 const [menu,setMenu]=useState(false);
 const [tab,setTab]=useState("진료비");
 const [filter,setFilter]=useState("전체");
 const [notice,setNotice]=useState(false);
 const rows=useMemo(()=>filter==="전체"?PRICES.rows:PRICES.rows.filter(row=>
  filter==="급여"?row[0].includes("급여 진료"):row[0].includes(filter)
 ),[filter]);
 return <div className="ow-hd-page" data-testid="website-source-hospital-detail">
  <header className="owh-header">
   <button type="button" className="owh-brand" onClick={()=>go("/")} aria-label="나만의닥터 홈"><img src={BASE+"website-source-hospital-brand.png"} alt="나만의닥터"/></button>
   <button type="button" className="owh-menu-btn" aria-label={menu?"메뉴 닫기":"메뉴 열기"} aria-expanded={menu} onClick={()=>setMenu(v=>!v)}>{menu?<X size={22}/>:<Menu size={22}/>}</button>
   {menu&&<nav className="owh-dropdown" aria-label="전체 서비스">
    {[["비대면진료","/telemedicine"],["병원찾기","/hospital"],["가격비교","/medical-cost"]].map(([name,to])=>
     <button type="button" key={to} onClick={()=>{setMenu(false);go(to)}}>{name}<ChevronRight size={17}/></button>)}
   </nav>}
  </header>
  <nav className="ow-hd-crumb" aria-label="현재 위치">
   <button type="button" onClick={()=>go("/")}>홈</button><span>›</span>
   <button type="button" onClick={()=>go("/hospital")}>병원찾기</button><span>›</span>
   <button type="button" onClick={()=>go("/dept-hub/내과/경남-창원시")}>창원시 내과</button><span>›</span><strong>{NAME}</strong>
  </nav>
  <section className="ow-hd-top">
   <h1>{NAME}</h1>
   <div className="ow-hd-availability">
    <div className="ow-hd-hours"><img src={BASE+"website-source-clinic-open-icon.png"} width="21" height="20" alt="" aria-hidden="true"/>
      <strong>영업 중</strong><span>· 오늘 (월) 24시간</span><ChevronRight size={18}/></div>
    <div className="ow-hd-address"><img src={BASE+"website-source-clinic-location-icon.png"} width="21" height="22" alt="" aria-hidden="true"/>{ADDRESS}</div>
   </div>
   <div className="ow-hd-actions">
    <a href={"tel:"+PHONE}><Phone size={17}/>전화</a>
    <a href={"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(NAME+" "+ADDRESS)} target="_blank" rel="noreferrer"><img src={BASE+"website-source-clinic-location-icon.png"} width="18" height="18" alt="" aria-hidden="true"/>길찾기</a>
    <button type="button" onClick={()=>setNotice(x=>!x)}><House size={17}/>홈페이지</button>
   </div>
   {notice&&<p className="ow-hd-notice" role="status">원본 공개 자료에서 병원 공식 홈페이지 주소가 확인되지 않았습니다.</p>}
  </section>
  <div className="ow-hd-separator"/>
  <nav className="ow-hd-tabs" aria-label="병원 정보 탭">
   {["진료비","병원 정보"].map(name=><button type="button" aria-selected={tab===name}
     className={tab===name?"selected":""} key={name} onClick={()=>setTab(name)}>{name}</button>)}
  </nav>
  {tab==="진료비"?<>
   <section className="ow-hd-info">
    <h2>{NAME} 진료비 안내</h2>
    <p>나만의닥터에서 수집한 {NAME}의 대면 진료비, 약제<span className="ow-hd-mobile-break"><br/></span>비, 접종료 등 모든 가격을 확인해보세요.</p>
   </section>
   <nav className="ow-hd-filters" aria-label="진료비 유형">
    {LABELS.map(v=><button type="button" key={v} onClick={()=>setFilter(v)} aria-pressed={filter===v} className={filter===v?"active":""}>{v}</button>)}
   </nav>
   <section className="ow-hd-prices">
    <h2>{filter==="전체"?"전체 진료비":filter+" 진료비"}</h2>
    <div className="ow-hd-tableclip"><table>
      <thead><tr>{PRICES.headers.slice(0,4).map(h=><th key={h}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r,i)=><tr key={i}>{r.slice(0,4).map((v,k)=><td key={k}>{v}</td>)}</tr>)}</tbody>
    </table></div>
   </section>
  </>:<section className="ow-hd-hospital-info">
    <h2>{NAME} 위치·영업시간</h2><p>위치: {ADDRESS}</p>
    <p>원본 수집 당시 공개된 진료 시간: 월요일 24시간</p>
    <p>진료 시간과 예약 가능 여부는 병원에 직접 확인할 수 있습니다.</p>
    <a href={"tel:"+PHONE}>병원에 전화하기 <ChevronRight size={18}/></a>
    {(SOURCE?.links||[]).filter(x=>x.path.startsWith("/hospital/detail?hospital_id=")).slice(0,5)
     .map(x=><button type="button" key={x.path} onClick={()=>go(x.path)}>{x.label}<ChevronRight size={15}/></button>)}
   </section>}
  <p className="ow-hd-snapshot-note">2026년 11월 9일 원본 공개 화면 기준. 영업 상태 및 진료비의 실시간 갱신 여부는 확인되지 않았습니다.</p>
  <footer className="ow-hd-fixed"><button type="button" onClick={()=>go("/telemedicine")}>진료 예약하기</button></footer>
 </div>;
}
