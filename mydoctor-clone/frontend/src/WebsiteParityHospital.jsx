import React,{useState} from "react";
import {Menu,X,ChevronDown,ChevronRight,MapPin,BriefcaseMedical,Stethoscope,Hospital} from "lucide-react";
import sources from "./data/verified-public-page-facts-29.json";
import originalFooter from "./data/original-footer-nav.json";
import "./website-parity-hospital.css";
const hospitalSource=sources.find(x=>x.path==="/hospital");
const specialties=(hospitalSource?.links||[]).filter(x=>x.path.startsWith("/dept-hub/")).filter((x,i,a)=>a.findIndex(y=>y.path===x.path)===i);
const regions=["서울","경기","인천","부산","대구","대전","광주","울산","세종","제주"];

/* These are the actual observed 390px original public website link ROWS.
 * The source has intentional per-row wrapping, unlike CSS flex auto-wrap
 * which previously shuffled hospitals into the wrong visual lines. */
const originalDepartmentRows=[
 ["가정의학과","결핵과","내과","마취통증의학과"],
 ["방사선종양학과","병리과","비뇨의학과","사상체질과"],
 ["산부인과","성형외과","소아청소년과","신경과","신경외과"],
 ["안과","영상의학과","예방의학과","외과","응급의학과"],
 ["이비인후과","재활의학과","정신건강의학과","정형외과"],
 ["직업환경의학과","진단검사의학과","치과","침구과","피부과"],
 ["한방내과","한방부인과","한방소아과","한방신경정신과"],
 ["한방안·이비인후·피부과","한방재활의학과","핵의학과"],
 ["흉부외과"]
];
const originalDepartmentMap=new Map(specialties.map(item=>[item.label,item.path]));

const sunday=(hospitalSource?.links||[]).filter(x=>/\/(%EC%9D%BC%EC%9A%94%EC%9D%BC%EC%A7%84%EB%A3%8C|일요일진료)/.test(x.path));
const night=(hospitalSource?.links||[]).filter(x=>/\/(%EC%95%BC%EA%B0%84%EC%A7%84%EB%A3%8C|야간진료)/.test(x.path));
function AvailabilitySection({heading,items,go}){
 return <section className="ow-hospital-availability">
  <h2>{heading}</h2>
  {items.map(x=><button type="button" key={x.path} onClick={()=>go(x.path)}>{x.label}</button>)}
 </section>;
}
function WebsiteFooter({go}){
 return <footer className="ow-hospital-footer">
  {originalFooter.groups.map(group=><section className="ow-hospital-footer-group" key={group.title}>
   <h3>{group.title}</h3>
   <div style={{gridTemplateRows:`repeat(${Math.ceil(group.links.length/2)},31px)`}}>{group.links.map(x=>x.href.startsWith("/")?
     <button type="button" key={x.href} onClick={()=>go(x.href)}>{x.label}</button>:
     <a key={x.href} href={x.href} target="_blank" rel="noopener noreferrer">{x.label}</a>)}</div>
  </section>)}
  <section className="ow-hospital-company">
   <h3>(주)메라키플레이스</h3>
   <strong>비즈니스/광고 제휴 문의: sales@merakiplace.kr</strong>
   <p>대표: 선재원, 손웅래 | 사업자등록번호: 554-86-02396</p>
   <p>통신판매업신고: 2026-서울강남-02884</p>
   <p>서울특별시 강남구 테헤란로 242, 4층 (역삼동)</p>
   <p>이메일: help@merakiplace.kr | 전화번호: 1544-6172</p>
   <p>고객센터 운영시간: 평일 오전 10시 ~ 오후 7시</p>
   <p>(점심시간: 오후 12시 ~ 오후 1시)</p>
   <p className="ow-hospital-social">◎  ▣  ▶</p>
   <nav>사이트맵　 이용약관　 개인정보처리방침　 위치기반서비스이용약관</nav>
   <small>Copyright 2026 Merakiplace Inc. All rights reserved.</small>
  </section>
 </footer>;
}
function Selector({Icon,icon,value,onChange,options,label}){
 return <label className="ow-hospital-select">
  <img className="ow-hospital-original-icon" src={(import.meta.env.BASE_URL||"/")+"website-source-hospital-"+icon+".png"} alt="" aria-hidden="true"/>
  <select aria-label={label} value={value} onChange={e=>onChange(e.target.value)}>
    <option value="">{label}</option>
    {options.map(o=><option key={o} value={o}>{o}</option>)}
  </select><ChevronDown size={17} aria-hidden="true"/>
 </label>;
}
export default function WebsiteParityHospital({go}){
 const [menu,setMenu]=useState(false);
 const [region,setRegion]=useState("");
 const [department,setDepartment]=useState("");
 const [treatment,setTreatment]=useState("");
 const choices=specialties.map(x=>x.label);
 const submit=()=>{
   if(department)go("/dept-hub/"+encodeURIComponent(department)+(region?"/"+encodeURIComponent(region):""));
   else if(treatment==="일요일")go("/hospital/일요일진료");
   else if(treatment==="야간")go("/hospital/야간진료");
   else go("/hospital/야간진료");
 };
 return <div className="ow-hospital-page" data-testid="website-parity-hospital">
   <header className="owh-header">
     <button type="button" className="owh-brand" aria-label="나만의닥터 홈" onClick={()=>go("/")}><img src={(import.meta.env.BASE_URL||"/")+"website-source-hospital-brand.png"} alt="나만의닥터"/></button>
     <button type="button" className="owh-menu-btn" aria-label={menu?"메뉴 닫기":"메뉴 열기"} aria-expanded={menu}
       onClick={()=>setMenu(x=>!x)}>{menu?<X size={22}/>:<Menu size={22}/>}</button>
     {menu&&<nav className="owh-dropdown">
       {[["비대면진료","/telemedicine"],["가격비교","/medical-cost"],["병원찾기","/hospital"],["약국찾기","/pharmacy"]].map(([label,url])=>
         <button type="button" key={url} onClick={()=>{setMenu(false);go(url)}}>{label}<ChevronRight size={17}/></button>)}
     </nav>}
   </header>
   <nav className="ow-hospital-breadcrumb" aria-label="현재 위치">
     <button type="button" onClick={()=>go("/")}>홈</button><span>›</span><strong>병원찾기</strong>
   </nav>
   <section className="ow-hospital-intro">
     <h1>근처 병원 찾기</h1>
     <p>내 주변 문 연 병원을 조건·지역별로 찾아보세요. 야간·일요일 진료 병원의 위치와 영업시간을 나만의닥터에서 확인할 수 있어요.</p>
   </section>
   <form className="ow-hospital-form" onSubmit={e=>{e.preventDefault();submit()}}>
     <Selector Icon={MapPin} icon="region" label="지역" value={region} onChange={setRegion} options={regions}/>
     <Selector Icon={BriefcaseMedical} icon="specialty" label="진료과" value={department} onChange={setDepartment} options={choices}/>
     <Selector Icon={Stethoscope} icon="care" label="모든 진료" value={treatment} onChange={setTreatment}
       options={["전체","야간","일요일","주말","공휴일"]}/>
     <button type="submit" className="ow-hospital-submit">병원 조회하기</button>
   </form>
   <section className="ow-hospital-departments">
     <h2>진료과별 병원</h2>
     <div className="ow-hospital-link-rows">
       {originalDepartmentRows.map((row,i)=><div className="ow-hospital-link-row" key={i}>
         {row.map(label=><button type="button" key={label} onClick={()=>go(
           originalDepartmentMap.get(label)||"/dept-hub/"+encodeURIComponent(label)
         )}>{label}</button>)}
       </div>)}
     </div>
   </section>
   <AvailabilitySection heading="일요일 진료" items={sunday} go={go}/>
   <AvailabilitySection heading="야간 진료" items={night} go={go}/>
   <WebsiteFooter go={go}/>
 </div>;
}
