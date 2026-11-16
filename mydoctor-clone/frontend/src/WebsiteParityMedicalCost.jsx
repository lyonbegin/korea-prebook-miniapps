import React,{useState} from "react";
import {Menu,X,ChevronRight} from "lucide-react";
import cards from "./data/original-medical-cost-cards.json";
import OriginalFooter from "./OriginalFooter.jsx";
import "./website-parity-medical-cost.css";

const categoryCards=cards.map((c,i)=>({...c,description:
  [
   "나만의닥터 마운자로 최저가 비교",
   "나만의닥터 위고비, 오젬픽 등 최저가 비교",
   "",
   "나만의닥터 에페 최저가 비교",
   "",
   "피나스테리드, 두타스테리드 등 최저가 비교",
   "이소트레티노인, 클린다마이신 등 최저가 비교",
   "독감 백신 전국 최저가 가격비교",
  ][i]??c.subtitle
 }));
const mainPriceLinks=[
  ["마운자로 가격","/medical-cost/마운자로"],
  ["삭센다 가격","/medical-cost/삭센다"],
  ["에페 가격","/medical-cost/에페"],
  ["서울 탈모약 가격","/medical-cost/탈모약"],
  ["서울 수액 가격","/medical-cost/수액"],
  ["서울 초음파 검사 가격","/medical-cost/초음파-검사"],
  ["예방접종 백신 가격","/medical-cost/예방접종-백신"]
];
export default function WebsiteParityMedicalCost({go}){
 const [opened,setOpened]=useState(false);
 return <div className="ow-medical-price-page" data-testid="website-parity-medical-cost">
  <header className="owh-header">
    <button type="button" className="owh-brand" aria-label="나만의닥터 홈" onClick={()=>go("/")}>
      <img src={(import.meta.env.BASE_URL||"/")+"website-source-hospital-brand.png"} alt="나만의닥터"/>
    </button>
    <button type="button" className="owh-menu-btn" aria-label={opened?"메뉴 닫기":"메뉴 열기"}
      aria-expanded={opened} onClick={()=>setOpened(v=>!v)}>{opened?<X size={22}/>:<Menu size={22}/>}</button>
    {opened&&<nav className="owh-dropdown" aria-label="모바일 메뉴">
      {[["비대면진료","/telemedicine"],["가격비교","/medical-cost"],["병원찾기","/hospital"],["약국찾기","/pharmacy"]]
       .map(([name,p])=><button type="button" key={p}
         onClick={()=>{setOpened(false);go(p)}}>{name}<ChevronRight size={16}/></button>)}
    </nav>}
  </header>
  <nav className="ow-hospital-breadcrumb" aria-label="현재 위치">
    <button type="button" onClick={()=>go("/")}>홈</button><span>›</span><strong>가격비교</strong>
  </nav>
  <section className="ow-price-intro">
    <h1>의료비 가격 비교 | 나만의닥터</h1>
    <p>나만의닥터에서 비급여 진료비와 의료비 가격을 비교해 보세요. 치과 치료, 시력교정술, MRI 검사, 예방접종 백신, 초음파 검사, 상급병실료 등 병원 가격을 지역별로 확인할 수 있어요.</p>
  </section>
  <section className="ow-price-catalog">
    <h2>가격 비교 카테고리</h2>
    <div className="ow-price-grid">
      {categoryCards.map((card,i)=><button className="ow-price-category" key={card.path}
        type="button" onClick={()=>go(card.path)} aria-label={card.title+" 가격 비교 상세"}>
        <strong>{card.title}</strong>
        {!!card.description&&<span>{card.description}</span>}
      </button>)}
    </div>
  </section>
  <section className="ow-price-popular">
    <h2>주요 가격 비교</h2>
    {mainPriceLinks.map(([title,p])=><button type="button" key={p} onClick={()=>go(p)}>{title}</button>)}
  </section>
  <OriginalFooter go={go}/>
 </div>;
}
