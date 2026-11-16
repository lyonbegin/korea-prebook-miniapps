import React,{useMemo,useState} from "react";
import {Menu,X,ChevronDown,Clock3,Heart,ChevronRight} from "lucide-react";
import facts from "./data/verified-public-page-facts-29.json";
import "./website-parity-condition.css";
const source=facts.find(x=>x.path==="/telemedicine/고혈압-비대면진료-예약");
const PUBLIC=import.meta.env.BASE_URL||"/";
const VISIBLES=[
 {name:"이정훈",clinic:"서울아산내과의원",rating:"100%",reviews:"300+",time:"07:00",specialty:true},
 {name:"홍성진",clinic:"미소진산부인과의원",rating:"98%",reviews:"999+",time:"07:00",specialty:false},
 {name:"장용혁",clinic:"지안마디내과의원",rating:"100%",reviews:"200+",time:"07:00",specialty:true},
 {name:"조준형",clinic:"조준형내과의원",rating:"100%",reviews:"700+",time:"07:20",specialty:true}
];
const parse=(x)=>{
 const m=x.label.match(/^(.*?) ([가-힣]{2,4}) 의사 (\d+%|수집 중) \(리뷰 ([^)]+)\) (.*)$/);
 if(!m)return null;
 return {clinic:m[1],name:m[2],rating:m[3],reviews:m[4],time:m[5].match(/(\d{2}:\d{2})부터/)?.[1]||"",specialty:/전문의/.test(m[5]),path:x.path};
};
const all=(source?.links||[]).map(parse).filter(Boolean);
const featured=VISIBLES.map((v,i)=>({...v,path:all.find(x=>x.name===v.name)?.path,art:i}));
const others=all.filter(x=>!VISIBLES.some(v=>v.name===x.name));
export default function WebsiteParityHypertension({go}){
 const [menu,setMenu]=useState(false),[order,setOrder]=useState("기본 순"),[quick,setQuick]=useState(false),[special,setSpecial]=useState(false);
 const cards=useMemo(()=>{
  let rows=[...featured,...others];
  if(special)rows=rows.filter(x=>x.specialty);
  if(quick)rows=rows.filter(x=>Boolean(x.time));
  if(order==="리뷰순")rows.sort((a,b)=>Number(b.reviews.replace(/\D/g,""))-Number(a.reviews.replace(/\D/g,"")));
  if(order==="평점순")rows.sort((a,b)=>parseInt(b.rating,10)-parseInt(a.rating,10));
  return rows;
 },[order,quick,special]);
 return <div className="ow-hypertension-page" data-testid="website-source-hypertension-list">
  <header className="owh-header">
   <button type="button" className="owh-brand" onClick={()=>go("/")} aria-label="나만의닥터 홈">
    <img src={PUBLIC+"website-source-hospital-brand.png"} alt="나만의닥터"/></button>
   <button type="button" className="owh-menu-btn" onClick={()=>setMenu(v=>!v)} aria-label={menu?"메뉴 닫기":"메뉴 열기"}>{menu?<X size={22}/>:<Menu size={22}/>}</button>
   {menu&&<nav className="owh-dropdown"><button onClick={()=>go("/telemedicine")} type="button">비대면진료</button><button onClick={()=>go("/hospital")} type="button">병원 찾기</button></nav>}
  </header>
  <nav className="ow-hypertension-crumb" aria-label="현재 위치">
   <button type="button" onClick={()=>go("/")}>홈</button><span>›</span>
   <button type="button" onClick={()=>go("/telemedicine")}>비대면진료</button><span>›</span>
   <strong>고혈압 비대면 진료</strong>
  </nav>
  <section className="ow-hypertension-intro">
   <h1>고혈압 비대면 진료 예약</h1>
   <p>고혈압 비대면 진료 예약은 <strong>나만의닥터</strong>를 통해 앱 설<span className="ow-source-linebreak"><br/></span>치 없이 가능해요. 전문의, 리뷰, 약력, 진료시간, 진료<span className="ow-source-linebreak"><br/></span>비를 확인하고 안전하게 비대면 진료를 예약해보세요.</p>
  </section>
  <div className="ow-hypertension-filters">
   <button type="button" onClick={()=>go("/telemedicine/all-department")}>고혈압 <ChevronDown size={14}/></button>
   <label aria-label="의사 정렬"><select value={order} onChange={e=>setOrder(e.target.value)}><option>기본 순</option><option>리뷰순</option><option>평점순</option></select><ChevronDown size={14}/></label>
   <button type="button" aria-pressed={quick} className={quick?"active":""} onClick={()=>setQuick(v=>!v)}>바로 진료</button>
   <button type="button" aria-pressed={special} className={special?"active":""} onClick={()=>setSpecial(v=>!v)}>전문의</button>
  </div>
  <div className="ow-hypertension-doctors">{cards.map((v,i)=><button type="button" key={v.path||v.clinic} className="ow-hypertension-doctor" onClick={()=>v.path&&go(v.path)} disabled={!v.path}>
   {v.art!==undefined&&<img className="ow-hypertension-avatar" src={PUBLIC+"website-source-hypertension-avatar-"+v.art+".png"} alt=""/>}
   <div className="ow-hypertension-clinic">{v.clinic}</div>
   <div className="ow-hypertension-name"><strong>{v.name} 의사</strong>
    <Heart size={15} fill="#ff353f" stroke="#ff353f"/><span>{v.rating}</span>
    <small>(리뷰 {v.reviews})</small></div>
   <div className="ow-hypertension-time"><b>진료가능</b><img className="ow-hypertension-clock" src={PUBLIC+"website-source-hypertension-clock.png"} alt="" width="16" height="16"/>
    <span>당시 {v.time||"시간 확인 필요"}부터 가능</span></div>
   {v.specialty&&<span className="ow-hypertension-badge">내과 전문의</span>}
  </button>)}</div>
  <p className="ow-hypertension-snapshot-note">의사·진료시간은 2026년 11월 9일 원본 화면 기록이며 현재 예약 가능 여부를 뜻하지 않습니다.</p>
 </div>;
}