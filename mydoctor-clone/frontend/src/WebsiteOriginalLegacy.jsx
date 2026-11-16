import React,{useMemo,useState} from "react";
import {Menu,X,ChevronRight} from "lucide-react";
import sourceFacts from "./data/verified-public-page-facts-29.json";
import {parsePublicFacts} from "./lib/sourceModel.js";
import {VerifiedSourcePage} from "./VerifiedSourcePage.jsx";
import WebsiteOriginalQuickPages from "./WebsiteOriginalQuickPages.jsx";
import "./website-parity-hospital.css";
import "./website-original-legacy.css";

/* Reuse the already-existing ORIGINAL WEB page types, rather than replacing
 * every public page with a native-app-style generic detail screen.
 * All facts come from captured my-doctor.io HTTP-200 responses (2026-11-09).
 * Live API is deliberately not called from the static GitHub Pages build.
 */
const canonical=value=>{
 try{return decodeURIComponent(String(value||""))}
 catch{return String(value||"")}
};
const cleanPath=target=>canonical(target).split("?")[0];
const ancestor=path=>path.startsWith("/telemedicine/")?"비대면진료":
 path.startsWith("/hospital/")?"병원찾기":path.startsWith("/pharmacy/")?"약국찾기":
 path.startsWith("/map/")?"병원찾기":path.startsWith("/medicine/")?"의약품 정보":
 path.startsWith("/healthLab/")?"건강 정보":
 path.startsWith("/qna")?"의료진 Q&A":"";
export default function WebsiteOriginalLegacy({target,go}){
 const [menu,setMenu]=useState(false);
 const raw=sourceFacts.find(x=>canonical(x.path)===canonical(target));
 const data=useMemo(()=>parsePublicFacts({
  facts:raw||{path:target,headline:"원본 자료가 확보되지 않은 화면",links:[],headings:[],tables:[]},
  quality:raw?"original-browser-capture-2026-11-09":"no-confirmed-original-facts"
 },target),[target,raw]);
 const company=cleanPath(target)==="/company";
 return <div className={"ow-legacy-page"+(company?" ow-legacy-company":"")} data-testid="website-source-original-detail" data-source-cached={!!raw}>
   {!company&&<>
    <header className="owh-header">
     <button className="owh-brand" type="button" aria-label="나만의닥터 홈" onClick={()=>go("/")}>
      <img src={(import.meta.env.BASE_URL||"/")+"website-source-hospital-brand.png"} alt="나만의닥터"/>
     </button>
     <button type="button" className="owh-menu-btn" aria-label={menu?"메뉴 닫기":"메뉴 열기"}
      aria-expanded={menu} onClick={()=>setMenu(x=>!x)}>{menu?<X size={22}/>:<Menu size={22}/>}</button>
     {menu&&<nav className="owh-dropdown" aria-label="모바일 메뉴">
      {[["비대면진료","/telemedicine"],["가격비교","/medical-cost"],["병원찾기","/hospital"],["약국찾기","/pharmacy"]].map(([name,href])=>
       <button key={href} type="button" onClick={()=>{setMenu(false);go(href)}}>{name}<ChevronRight size={17}/></button>)}
     </nav>}
    </header>
    <nav className="ow-hospital-breadcrumb" aria-label="현재 위치">
     <button onClick={()=>go("/")} type="button">홈</button><span>›</span>
     {ancestor(cleanPath(target))&&<button type="button" onClick={()=>go(
       target.startsWith("/telemedicine/")?"/telemedicine":target.startsWith("/hospital/")?"/hospital":
       target.startsWith("/pharmacy/")?"/pharmacy":"/healthLab"
     )}>{ancestor(cleanPath(target))}</button>}
    </nav>
   </>}
   <div className="ow-legacy-body">
    <>{["/medicine/ingredient/세마글루티드","/healthLab/calculator/bmi","/hospital/10055/reviews","/telemedicine/doctor/탑연합의원-박광규-100/reviews"].includes(cleanPath(target))?
      <WebsiteOriginalQuickPages target={target} go={go}/>:
      <VerifiedSourcePage key={target} route={canonical(target)} data={data} go={go}/>}</>
   </div>
 </div>;
}
