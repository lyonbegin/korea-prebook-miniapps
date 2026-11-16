import React,{useState,useRef} from "react";
import {Menu,X,ChevronRight} from "lucide-react";
import observed from "./data/verified-public-page-facts-29.json";
import "./website-parity-mounjaro.css";

const detail=observed.find(x=>decodeURIComponent(x.path)==="/medical-cost/마운자로");
const getCell=(which,row,column)=>detail?.tables?.[which]?.rows?.[row]?.[column]||"";
const SRC_TEXT="나만의닥터에서 수집한 전국 마운자로 1팩 가격(2,567곳 기준, 2026-11-09)은 약국 약제비 평균 "+getCell(1,1,1)+", 최저 "+getCell(1,0,1)+"이며, 병원 처방비 평균 "+getCell(0,1,1)+", 최저 "+getCell(0,0,1)+"입니다.";
const commonRegions=["전국","서울","경기","인천","부산","대구","대전","광주"];
const selectCards=[
 ["청담더셀의원","압구정로데오역 · 서울 강남구 청담동"],
 ["청담에끌라드의원","서울 강남구 청담동"],
 ["성포센트럴내과","경기도 안산시"],
];
export default function WebsiteParityMounjaro({go}){
 const [opened,setOpened]=useState(false);
 const [region,setRegion]=useState("전국"),[category,setCategory]=useState("마운자로/젭바운드 등");
 const [dose,setDose]=useState("2.5mg"),[pack,setPack]=useState("1팩"),[list,setList]=useState("병원");
 const resultRef=useRef(null);
 const renderedSummary=<>
  나만의닥터에서 수집한 전국 마운자로 1팩 가격<br className="ow-mounjaro-hard-line"/>
  (2,567곳 기준, 2026-11-09)은 약국 약제비 평균<br className="ow-mounjaro-hard-line"/>
  {getCell(1,1,1)}, 최저 {getCell(1,0,1)}이며, 병원 처방비 평<br className="ow-mounjaro-hard-line"/>
  균 {getCell(0,1,1)}, 최저 {getCell(0,0,1)}입니다.
 </>;
 const info=detail?.links?.filter(x=>x.path.startsWith("/hospital/detail?")).slice(0,18)||[];
 return <div className="ow-mounjaro-page" data-testid="website-parity-medical-cost-category">
   <header className="owh-header">
     <button type="button" className="owh-brand" aria-label="나만의닥터 홈" onClick={()=>go("/")}>
      <img src={(import.meta.env.BASE_URL||"/")+"website-source-hospital-brand.png"} alt="나만의닥터"/>
     </button>
     <button type="button" className="owh-menu-btn" aria-label={opened?"메뉴 닫기":"메뉴 열기"}
      aria-expanded={opened} onClick={()=>setOpened(v=>!v)}>{opened?<X size={22}/>:<Menu size={22}/>}</button>
     {opened&&<nav className="owh-dropdown" aria-label="모바일 메뉴">
      {[["비대면진료","/telemedicine"],["가격비교","/medical-cost"],["병원찾기","/hospital"],["약국찾기","/pharmacy"]]
       .map(([label,p])=><button type="button" key={p}
        onClick={()=>{setOpened(false);go(p)}}>{label}<ChevronRight size={17}/></button>)}
     </nav>}
   </header>
   <nav className="ow-hospital-breadcrumb" aria-label="현재 위치">
     <button type="button" onClick={()=>go("/")}>홈</button><span>›</span>
     <button type="button" onClick={()=>go("/medical-cost")}>가격비교</button><span>›</span>
     <strong>전국 마운자로 가격 비교</strong>
   </nav>
   <section className="ow-mounjaro-intro">
     <h1>전국 마운자로 처방 병원/약국 가격<br className="ow-mounjaro-hard-line"/> 비교 정보 (2026)</h1>
     <p>{renderedSummary}</p>
   </section>
   <section className="ow-mounjaro-lookup" aria-label="마운자로 최저가 조회 조건">
     <label className="ow-mounjaro-field">
       <span>지역</span>
       <select aria-label="지역" value={region} onChange={e=>setRegion(e.target.value)}>
        {commonRegions.map(r=><option key={r}>{r}</option>)}
       </select>
     </label>
     <div className="ow-mounjaro-two">
       <label className="ow-mounjaro-field">
         <span>카테고리</span>
         <select aria-label="카테고리" value={category} onChange={e=>setCategory(e.target.value)}>
          {["마운자로/젭바운드 등","위고비"].map(v=><option key={v}>{v}</option>)}
         </select>
       </label>
       <label className="ow-mounjaro-field">
         <span>용량</span>
         <select aria-label="주사 용량" value={dose} onChange={e=>setDose(e.target.value)}>
          {["2.5mg","5mg","7.5mg","10mg","12.5mg","15mg"].map(v=><option key={v}>{v}</option>)}
         </select>
       </label>
     </div>
     <label className="ow-mounjaro-field">
       <span>용량</span>
       <select aria-label="팩 수" value={pack} onChange={e=>setPack(e.target.value)}>
        {["1팩","2팩","3팩"].map(v=><option key={v}>{v}</option>)}
       </select>
     </label>
     <button className="ow-mounjaro-submit" type="button"
       onClick={()=>resultRef.current?.scrollIntoView({behavior:"smooth",block:"start"})}>
       병원/약국 가격 조회하기
     </button>
   </section>
   <section className="ow-mounjaro-results" ref={resultRef} id="source-price-results">
     <h2>전국 마운자로 처방 병원 저렴한 곳</h2>
     <div className="ow-mounjaro-result-list">
       {info.map((hospital,i)=>{
         const match=selectCards[i];
         return <button type="button" className="ow-mounjaro-provider" key={hospital.path}
           onClick={()=>go(hospital.path)}>
           <span><strong>{hospital.label}</strong>
             <small>{match?.[1]||"원본 공개 병원 정보"}</small></span>
           <span className="ow-mounjaro-picture" aria-hidden="true"/>
           <ChevronRight size={17}/>
         </button>;
       })}
     </div>
     {!!detail?.tables?.length&&<div className="ow-mounjaro-tables">
       {detail.tables.map((table,i)=><section key={i}>
         <h3>{i===0?"병원 처방비":"약국 약제비"}</h3>
         <div className="ow-mounjaro-table-scroll"><table>
           <thead><tr>{table.headers.map((h,k)=><th key={k}>{h}</th>)}</tr></thead>
           <tbody>{table.rows.map((row,k)=><tr key={k}>{row.map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody>
         </table></div>
       </section>)}
     </div>}
   </section>
 </div>;
}
