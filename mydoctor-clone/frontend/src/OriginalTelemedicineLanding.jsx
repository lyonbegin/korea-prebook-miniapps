import React,{useState} from "react";
import {Menu,X,ChevronDown,ChevronRight,Ear,Hand,Droplets,Stethoscope,Brain,Eye,CircleDot,HeartPulse} from "lucide-react";
import "./original-telemedicine-landing.css";
const sourceSymptoms=[
 {name:"귀/코/목 질환",subtitle:"비염, 중이염, 인후염 등",Icon:Ear,color:"#f7c6b8",
   links:[["비염","/telemedicine/감기-비대면진료-예약"],["인후염","/telemedicine/이비인후과-비대면진료-예약"]]},
 {name:"만성질환",subtitle:"고지혈증, 고혈압, 당뇨병 등",Icon:Hand,color:"#ffb6a9",
   links:[["고지혈증","/telemedicine/고지혈증-비대면진료-예약"],["고혈압","/telemedicine/고혈압-비대면진료-예약"]]},
 {name:"비뇨기 질환",subtitle:"방광염, 전립선염, 요실금 등",Icon:Droplets,color:"#ffa8b0",
   links:[["방광염","/telemedicine/방광염-비대면진료-예약"],["비뇨의학과","/telemedicine/비뇨기과-비뇨의학과-비대면진료-예약"]]},
 {name:"소화기 질환",subtitle:"속쓰림, 장염, 위염 등",Icon:Stethoscope,color:"#fa9298",
   links:[["과민성대장증후군","/telemedicine/과민성대장증후군-비대면진료-예약"],["내과","/telemedicine/내과-비대면진료-예약"]]},
 {name:"신경 질환",subtitle:"두통, 편두통, 안면경련 등",Icon:Brain,color:"#f7a4ab",
   links:[["신경과","/telemedicine/신경과-비대면진료-예약"],["두통","/telemedicine/신경과-비대면진료-예약"]]},
 {name:"안구 질환",subtitle:"안구건조증, 결막염, 다래끼 등",Icon:Eye,color:"#c4ccd5",
   links:[["녹내장","/telemedicine/녹내장-비대면진료-예약"],["안과","/telemedicine/안과-비대면진료-예약"]]},
 {name:"여성 질환",subtitle:"질염, 생리통, 생리불순 등",Icon:CircleDot,color:"#fc8c95",
   links:[["질염","/telemedicine/질염-비대면진료-예약"],["산부인과","/telemedicine/산부인과-비대면진료-예약"]]},
 {name:"피부 질환",subtitle:"여드름, 두드러기, 대상포진 등",Icon:HeartPulse,color:"#ff9da8",
   links:[["여드름","/telemedicine/여드름-비대면진료-예약"],["대상포진","/telemedicine/대상포진-비대면진료-예약"]]}
];
const sourceDepartments=[
 ["이비인후과","/telemedicine/이비인후과-비대면진료-예약"],
 ["내과","/telemedicine/내과-비대면진료-예약"],
 ["피부과","/telemedicine/피부과-비대면진료-예약"],
 ["정형외과","/telemedicine/정형외과-비대면진료-예약"],
 ["소아청소년과","/telemedicine/소아과-소아청소년과-비대면진료-예약"],
 ["안과","/telemedicine/안과-비대면진료-예약"],
 ["산부인과","/telemedicine/산부인과-비대면진료-예약"],
 ["치과","/telemedicine/치과-비대면진료-예약"]
];
export default function OriginalTelemedicineLanding({go}){
 const [menu,setMenu]=useState(false),[tab,setTab]=useState("symptom"),[expanded,setExpanded]=useState(null);
 return <div className="original-telemedicine-root" data-testid="original-telemedicine-landing">
   <header className="owh-header">
     <button type="button" className="owh-brand" aria-label="나만의닥터 홈" onClick={()=>go("/")}>
       <img src={(import.meta.env.BASE_URL||"/")+"website-source-hospital-brand.png"} alt="나만의닥터"/>
     </button>
     <button type="button" className="owh-menu-btn" aria-label={menu?"메뉴 닫기":"메뉴 열기"}
       aria-expanded={menu} onClick={()=>setMenu(x=>!x)}>{menu?<X size={22}/>:<Menu size={22}/>}</button>
     {menu&&<nav className="owh-dropdown">
       {[["비대면진료","/telemedicine"],["가격비교","/medical-cost"],["병원찾기","/hospital"],["약국찾기","/pharmacy"]]
        .map(([label,path])=><button type="button" key={path} onClick={()=>{setMenu(false);go(path)}}>
          {label}<ChevronRight size={17}/></button>)}
     </nav>}
   </header>
   <nav className="ow-hospital-breadcrumb" aria-label="현재 위치">
     <button type="button" onClick={()=>go("/")}>홈</button><span>›</span><strong>비대면진료</strong>
   </nav>
   <section className="original-telemedicine-hero">
     <h1>비대면 진료 예약</h1>
     <p>앱 다운로드 없이 비대면 진료를 예약하려면, <a href="#" onClick={e=>{e.preventDefault();go("/")}}>나만의닥터</a>에서 증상 선택 &gt; 의사 선택 &gt; 증상/예약 정보 입력을 진행해주세요.</p>
   </section>
   <div className="original-telemedicine-tabs" role="tablist" aria-label="비대면 진료 검색 유형">
     <button type="button" role="tab" aria-selected={tab==="symptom"} className={tab==="symptom"?"active":""}
       onClick={()=>{setTab("symptom");setExpanded(null)}}>증상</button>
     <button type="button" role="tab" aria-selected={tab==="department"} className={tab==="department"?"active":""}
       onClick={()=>{setTab("department");setExpanded(null)}}>진료과목</button>
   </div>
   {tab==="symptom"?<div className="original-telemedicine-symptoms" role="tabpanel">
      {sourceSymptoms.map((item,i)=><div key={item.name} className="original-telemedicine-group">
        <button type="button" className="original-telemedicine-row"
          aria-expanded={expanded===i}
          onClick={()=>setExpanded(expanded===i?null:i)}>
          <span className="original-telemedicine-icon">
            <item.Icon size={35} strokeWidth={i===5?2.5:2.8} fill="none" color={item.color}/>
          </span>
          <span className="original-telemedicine-row-text">
            <strong>{item.name}</strong><small>{item.subtitle}</small>
          </span>
          <ChevronDown size={18} color="#303942"/>
        </button>
        {expanded===i&&<div className="original-telemedicine-expanded">
          {item.links.map(([label,path])=><button key={label} onClick={()=>go(path)} type="button">
            {label}<ChevronRight size={16}/></button>)}
        </div>}
      </div>)}
    </div>:<div className="original-telemedicine-departments" role="tabpanel">
      {sourceDepartments.map(([name,path])=><button type="button" key={path} onClick={()=>go(path)}>
        {name}<ChevronRight size={17}/></button>)}
    </div>}
 </div>;
}
