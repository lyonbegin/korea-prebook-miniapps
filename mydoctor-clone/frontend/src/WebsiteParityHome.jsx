import React,{useState} from "react";
import {Menu,X,ChevronRight,Stethoscope,Tags,Hospital,Pill,Phone} from "lucide-react";
import "./website-parity-home.css";

const entries=[
 {title:"비대면진료",path:"/telemedicine",Icon:Stethoscope},
 {title:"가격비교",path:"/medical-cost",Icon:Tags},
 {title:"병원찾기",path:"/hospital",Icon:Hospital},
 {title:"약국찾기",path:"/pharmacy",Icon:Pill},
];
const awards=[
 "2026 대한민국 소비자 브랜드 대상 진료 부문 1위",
 "2024 중앙일보 올해의 우수브랜드대상 · 비대면진료 부문 1위",
 "2022 대한민국소비자브랜드 대상 · 서비스만족도 1위",
];
const symptoms=[
 ["👂","귀/코/목 질환","비염, 중이염, 인후염 등","/telemedicine/이비인후과-비대면진료-예약"],
 ["🩸","만성질환","고지혈증, 고혈압, 당뇨병 등","/telemedicine/고혈압-비대면진료-예약"],
 ["🫁","비뇨기 질환","방광염, 전립선염, 요실금 등","/telemedicine/방광염-비대면진료-예약"],
 ["🩷","소화기 질환","속쓰림, 장염, 위염 등","/telemedicine/과민성대장증후군-비대면진료-예약"],
 ["🧠","신경 질환","두통, 편두통, 안면경련 등","/telemedicine/all-department"],
 ["👁️","안구 질환","안구건조증, 결막염, 다래끼 등","/telemedicine/안과-비대면진료-예약"],
 ["♀️","여성 질환","질염, 생리통, 생리불순 등","/telemedicine/질염-비대면진료-예약"],
 ["🌐","정신 질환","우울증, 강박장애, 공황장애 등","/telemedicine/공황장애-비대면진료-예약"],
 ["🦴","정형외과 질환","근육통, 근육경련, 관절염 등","/telemedicine/정형외과-비대면진료-예약"],
 ["🦷","치과 질환","치통, 충치, 치주염 등","/telemedicine/치과-비대면진료-예약"],
 ["💇","탈모","탈모, 여성 탈모 등","/telemedicine/탈모-비대면진료-예약"],
 ["🩹","피부 질환","여드름, 무좀, 땀띠 등","/telemedicine/피부과-비대면진료-예약"],
 ["🩺","호흡기 질환","감기, 독감, 코로나 등","/telemedicine/감기-비대면진료-예약"]
];
export default function WebsiteParityHome({go}){
 const [opened,setOpened]=useState(false);
 return <div className="original-website-home" data-testid="website-parity-home">
   <header className="owh-header">
     <button type="button" className="owh-brand" onClick={()=>go("/")}
       aria-label="나만의닥터 홈">나만의닥.</button>
     <button type="button" className="owh-menu-btn"
       aria-label={opened?"메뉴 닫기":"메뉴 열기"} aria-expanded={opened}
       onClick={()=>setOpened(x=>!x)}>{opened?<X size={22}/>:<Menu size={22}/>}</button>
     {opened&&<nav className="owh-dropdown" aria-label="원본 웹사이트 메뉴">
       {entries.map(({title,path,Icon})=><button type="button" key={path}
         onClick={()=>{setOpened(false);go(path)}}><Icon size={20}/>{title}<ChevronRight size={18}/></button>)}
     </nav>}
   </header>
   <section className="owh-marketing-hero">
     <h1>대한민국 1위<br/>비대면 진료 앱<br/>나만의닥터</h1>
     <div className="owh-awards">
       {awards.map((award,i)=><div key={i} className="owh-award">
         <img className="owh-laurel" src={(import.meta.env.BASE_URL||"/")+"website-laurel-left.png"} alt="" aria-hidden="true"/>
         <span>{award}</span><img className="owh-laurel right" src={(import.meta.env.BASE_URL||"/")+"website-laurel-right.png"} alt="" aria-hidden="true"/>
       </div>)}
     </div>
     <div className="owh-stat-panel">
       <div>활성유저수 <b>1위<sup>1</sup></b><br/>회원수 <b>300만+</b></div>
       <div>매출액 <b>1위<sup>2</sup></b><br/>앱스토어 평점 <b>4.8점</b></div>
     </div>
     <div className="owh-fineprint">
       <p>1 모바일인덱스 추정 기준 비대면진료 앱 월간 활성 이용자 수 (MAU)<br/>　 2026년 1월~8월 8개월 연속 1위 (Android+iOS 합산)</p>
       <p>2 비대면진료 앱 운영사 4개사 2025년 매출액<br/>　 (각 사 공시 재무제표 기준)</p>
     </div>
     <div className="owh-phone-illustration" role="img" aria-label="나만의닥터 휴대전화 앱 화면 이미지">
       <img src={(import.meta.env.BASE_URL||"/")+"website-original-phone.png"} alt="" />
     </div>
   </section>
   <section className="owh-service-overview">
     <span className="owh-section-chip">비대면 진료</span>
     <h2>전국민 누구나,<br/>언제든 어디서나 전화 진료</h2>
     <p>24시간 365일, 전화 한 통으로 진료받고<br/>가까운 약국에서 약을 수령하세요.</p>
     <div className="owh-steps">
       {[["STEP 1","증상 선택","진료 받을 증상/진료과 선택"],
         ["STEP 2","비대면 전화 진료","전화로 의사와 진료 후 앱으로 처방전 발행"],
         ["STEP 3","약 수령","가까운 약국에서 약 받으면 끝!"]]
          .map(([step,title,subtitle],i)=><button key={step} type="button"
            onClick={()=>go("/telemedicine")} className="owh-step">
            <span className="owh-step-image">{i===0?"🏥":i===1?"📞":"💊"}</span>
            <span><small>{step}</small><strong>{title}</strong><em>{subtitle}</em></span>
          </button>)}
     </div>
     <h3 className="owh-conditions-heading">이런 증상들 모두<br/>전화로 진료볼 수 있어요</h3>
     <div className="owh-conditions-grid" data-testid="source-marketing-conditions">
       {symptoms.map(([symbol,title,desc,path])=><button type="button"
         key={title} className="owh-condition" onClick={()=>go(path)}>
         <span className="owh-condition-illustration">{symbol}</span>
         <strong>{title}</strong><small>{desc}</small>
       </button>)}
     </div>
     <button type="button" className="owh-primary-action" onClick={()=>go("/telemedicine")}>
       비대면 진료 시작하기
     </button>
   </section>
   <section className="owh-service-overview owh-service-overview-secondary">
     <span className="owh-section-chip">최저가 병원 예약</span>
     <h2>나만의닥터 최저가 비교<br/>마운자로, 위고비, 백신 등</h2>
     <p>병원별 진료비를 비교하고 예약하세요.</p>
     <div className="owh-price-categories">
       {[["마운자로","/medical-cost/마운자로"],["위고비","/medical-cost/위고비"],
         ["예방접종 백신","/medical-cost/예방접종-백신"],["수액","/medical-cost/수액"]].map(([name,path])=>
         <button type="button" key={path} onClick={()=>go(path)}>{name}<ChevronRight size={15}/></button>)}
     </div>
   </section>
   <div className="owh-cta-spacer"/>
   <button type="button" className="owh-fixed-download" aria-label="나만의닥터 다운로드"
     onClick={()=>go("/telemedicine")}>나만의 닥터 다운로드</button>
 </div>;
}
