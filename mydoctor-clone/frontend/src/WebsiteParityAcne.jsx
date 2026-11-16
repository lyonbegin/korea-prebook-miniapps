import React,{useState,useRef} from "react";
import {Menu,X,ChevronRight} from "lucide-react";
import observed from "./data/verified-public-page-facts-29.json";
import "./website-parity-mounjaro.css";
import "./website-parity-acne.css";

const detail=observed.find(x=>decodeURIComponent(x.path)==="/medical-cost/여드름약/이소티논");
const getCell=(which,row,column)=>detail?.tables?.[which]?.rows?.[row]?.[column]||"";

const commonRegions=["전국","서울","경기","인천","부산","대구","대전","광주"];
const selectCards=[];
export default function WebsiteParityAcne({go}){
 const [opened,setOpened]=useState(false);
 const [region,setRegion]=useState("전국"),[category,setCategory]=useState("여드름약");
 const [dose,setDose]=useState("여드름약(이소티논, 니메겐 등 이소트레티노인)"),[pack,setPack]=useState("1개월"),[list,setList]=useState("병원");
 const resultRef=useRef(null);
 const renderedSummary=<>
  나만의닥터에서 수집한 전국 여드름약(이소티논, 니<br className="ow-mounjaro-hard-line"/>
  메겐 등 이소트레티노인) 1개월 가격(2,390곳 기준,<br className="ow-mounjaro-hard-line"/>
  2026-11-09)은 약국 약제비 평균 {getCell(1,1,1)}, 최저<br className="ow-mounjaro-hard-line"/>
  {getCell(1,0,1)}이며, 병원 처방비 평균 {getCell(0,1,1)}, 최저<br className="ow-mounjaro-hard-line"/>
  {getCell(0,0,1)}입니다.
 </>;
 const info=detail?.links?.filter(x=>x.path.startsWith("/hospital/detail?")).slice(0,18)||[];
 return <div className="ow-mounjaro-page ow-acne-page" data-testid="website-parity-medical-cost-item-by-area">
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
     <span className="ow-acne-breadcrumb">여드름약 › <strong>전국 여드름약(이소티논, 니메겐 등 이소트레티노인) 가격 비교</strong></span>
   </nav>
   <section className="ow-mounjaro-intro">
     <h1>전국 여드름약 처방 성지 병원/약국<br className="ow-mounjaro-hard-line"/> 가격비교(2026) - 이소티논, 니메겐<br className="ow-mounjaro-hard-line"/> 등 이소트레티노인</h1>
     <p>{renderedSummary}</p>
   </section>
   <section className="ow-mounjaro-lookup" aria-label="여드름약 최저가 조회 조건">
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
          {["여드름약"].map(v=><option key={v}>{v}</option>)}
         </select>
       </label>
       <label className="ow-mounjaro-field">
         <span>분류</span>
         <select aria-label="여드름약 성분" value={dose} onChange={e=>setDose(e.target.value)}>
          {["여드름약(이소티논, 니메겐 등 이소트레티노인)"].map(v=><option key={v}>{v}</option>)}
         </select>
         <span className="ow-acne-display-value" aria-hidden="true">여드름약(이소<br/>티논, 니메겐 등<br/>이소트레티노<br/>인)</span>
       </label>
     </div>
     <label className="ow-mounjaro-field">
       <span>용량</span>
       <select aria-label="팩 수" value={pack} onChange={e=>setPack(e.target.value)}>
        {["1개월","2개월","3개월"].map(v=><option key={v}>{v}</option>)}
       </select>
     </label>
     <button className="ow-mounjaro-submit" type="button"
       onClick={()=>resultRef.current?.scrollIntoView({behavior:"smooth",block:"start"})}>
       병원/약국 가격 조회하기
     </button>
   </section>
   <section className="ow-mounjaro-results" ref={resultRef} id="source-price-results">
     <div className="ow-acne-segment" role="tablist" aria-label="가격 검색 결과 유형">
  <button type="button" className={list==="병원"?"active":""} onClick={()=>setList("병원")}>처방 병원</button>
  <button type="button" className={list==="약국"?"active":""} onClick={()=>setList("약국")}>최저가 약국</button></div>
  <h2>전국 여드름약 처방 병원 저렴한 곳</h2>
     <div className="ow-mounjaro-result-list">
       {info.map((hospital,i)=>{
         const match=selectCards[i];
         return <button type="button" className="ow-mounjaro-provider" key={hospital.path}
           onClick={()=>go(hospital.path)}>
           <span><strong>{hospital.label}</strong>
             <small>{match?.[1]||"원본 공개 병원 정보"}</small></span>
           <span className="ow-mounjaro-picture" aria-hidden="true"/>
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
