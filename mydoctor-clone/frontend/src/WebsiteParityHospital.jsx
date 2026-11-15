import React,{useState} from "react";
import {Menu,X,ChevronDown,ChevronRight,MapPin,BriefcaseMedical,Stethoscope,Hospital} from "lucide-react";
import sources from "./data/verified-public-page-facts-29.json";
import "./website-parity-hospital.css";
const hospitalSource=sources.find(x=>x.path==="/hospital");
const specialties=(hospitalSource?.links||[]).filter(x=>x.path.startsWith("/dept-hub/"));
const regions=["서울","경기","인천","부산","대구","대전","광주","울산","세종","제주"];
function Selector({Icon,value,onChange,options,label}){
 return <label className="ow-hospital-select">
  <Icon size={19} strokeWidth={2.2} aria-hidden="true"/>
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
     <button type="button" className="owh-brand" aria-label="나만의닥터 홈" onClick={()=>go("/")}>나만의닥.</button>
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
     <Selector Icon={MapPin} label="지역" value={region} onChange={setRegion} options={regions}/>
     <Selector Icon={BriefcaseMedical} label="진료과" value={department} onChange={setDepartment} options={choices}/>
     <Selector Icon={Stethoscope} label="모든 진료" value={treatment} onChange={setTreatment}
       options={["전체","야간","일요일","주말","공휴일"]}/>
     <button type="submit" className="ow-hospital-submit">병원 조회하기</button>
   </form>
   <section className="ow-hospital-departments">
     <h2>진료과별 병원</h2>
     <div className="ow-hospital-links">
       {specialties.map(item=><button type="button" key={item.path}
         onClick={()=>go(item.path)}>{item.label}</button>)}
     </div>
   </section>
 </div>;
}
