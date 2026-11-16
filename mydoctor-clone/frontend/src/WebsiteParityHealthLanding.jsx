import React,{useState} from "react";
import {Menu,X,ChevronRight} from "lucide-react";
import observed from "./data/verified-public-page-facts-29.json";
import "./website-parity-health-landing.css";

const data=observed.find(x=>x.path==="/healthLab");
const root=import.meta.env.BASE_URL||"/";
const findHref=(name)=>data?.links?.find(x=>x.label===name)?.path||"";
export default function WebsiteParityHealthLanding({go}){
 const [menu,setMenu]=useState(false);
 const bmi=findHref("비만도 계산기");
 return <div className="ow-health-landing" data-testid="website-source-health-landing">
  <header className="owh-header">
   <button className="owh-brand" type="button" onClick={()=>go("/")} aria-label="나만의닥터 홈">
    <img alt="나만의닥터" src={root+"website-source-hospital-brand.png"}/></button>
   <button className="owh-menu-btn" type="button" aria-expanded={menu}
    aria-label={menu?"메뉴 닫기":"메뉴 열기"} onClick={()=>setMenu(v=>!v)}>{menu?<X size={22}/>:<Menu size={22}/>}</button>
   {menu&&<nav className="owh-dropdown" aria-label="전체 서비스">
    {[["비대면진료","/telemedicine"],["병원찾기","/hospital"],["가격비교","/medical-cost"],["의약품 정보","/medicine"]].map(([title,url])=>
     <button type="button" key={url} onClick={()=>{go(url);setMenu(false)}}>{title}<ChevronRight size={16}/></button>)}
   </nav>}
  </header>
  <nav className="ow-health-breadcrumb" aria-label="현재 위치">
   <button type="button" onClick={()=>go("/")}>홈</button><span>›</span><strong>건강 정보</strong>
  </nav>
  <section className="ow-health-panel ow-health-quiz">
   <h2>건강퀴즈</h2>
   <h3>매일 돈 버는<br/>나만의닥터 건강퀴즈</h3>
   <p>365일 열리는 퀴즈를 풀고<br/>최대 10,000캐시 받기 💰</p>
   <img alt="" className="ow-health-quiz-art" src={root+"website-source-health-quiz.png"}/>
   <button className="ow-health-cta" type="button" onClick={()=>go("/healthLab/quiz")}>건강퀴즈 풀기</button>
  </section>
  <section className="ow-health-panel ow-health-test">
   <h2>건강테스트</h2>
   <h3>병원 가기 전 알아보는<br/>탈모 진단 테스트</h3>
   <p>요즘 들어 유난히 머리가 얇아지고<br/>많이 빠지는 것 같다면? 👨🏻‍🦱</p>
   <img alt="" className="ow-health-test-art" src={root+"website-source-health-test.png"}/>
   <button className="ow-health-cta" type="button" onClick={()=>go("/healthLab/test")}>테스트 시작하기</button>
  </section>
  <section className="ow-health-panel ow-health-calcs">
   <h2>건강계산기</h2>
   <button type="button" className="ow-health-calc-row" onClick={()=>bmi&&go(bmi)}>비만도 계산기</button>
   {(data?.links||[]).filter(x=>x.path.startsWith("/healthLab/calculator/")&&x.path!==bmi)
    .map(x=><button type="button" key={x.path} className="ow-health-calc-row" onClick={()=>go(x.path)}>{x.label}</button>)}
  </section>
 </div>;
}