import React,{useMemo,useState} from "react";
import {ChevronRight} from "lucide-react";
import originalFacts from "./data/verified-public-page-facts-29.json";
import "./website-original-quick.css";

/* Screenshot-grounded web parity: my-doctor.io 390x844 (2026-11-09).
   No synthetic providers, prices, medicine, Q&A answers or reviews.
   Review badges and the single visible review are transcription of the
   captured original viewport, NOT claimed live review inventories. */
const getFact=path=>originalFacts.find(x=>{
 try{return decodeURIComponent(x.path)===decodeURIComponent(path)}
 catch{return x.path===path}
});
const MEDICINE_PATH="/medicine/ingredient/세마글루티드";
const HEADER_FALLBACK="원본 공개 정보";
export function MedicineIngredientSource({go}){
 const doc=getFact(MEDICINE_PATH);
 const links=doc?.links||[];
 return <section className="ow-q-med" data-source-view="medicine-filter-original">
   <header className="ow-q-med-head">
    <h1>{doc?.headline||"세마글루티드 성분 의약품"}</h1>
    <p>세마글루티드 성분을 함유한 의약품입니다. 같은 성분의 다른 의약품을 알아보세요.</p>
   </header>
   <section className="ow-q-med-body">
    <h2>의약품 {links.length}개</h2>
    {links.map(item=>{
     const label=item.label.replace(/^전문의약품\s*/,"");
     const name=label.split(" 세마글루티드")[0];
     const detail=label.includes("세마글루티드")?"세마글루티드 · 노보노디스크제약(주)":"";
     return <button className="ow-q-med-card" key={item.path} onClick={()=>go(item.path)} type="button">
       <div><span>전문의약품</span><strong>{name}</strong></div>
       <p>{detail}</p>
     </button>;
    })}
   </section>
 </section>;
}
const categories=[
 ["저체중",0,18.5],["정상",18.5,23],["과체중",23,25],
 ["비만",25,30],["고도비만",30,Infinity]
];
export function HealthBmiSource({go}){
 const [height,setHeight]=useState("170");
 const [weight,setWeight]=useState("65");
 const [result,setResult]=useState(65/Math.pow(1.7,2));
 const valid=Number(height)>=50&&Number(height)<=260&&Number(weight)>=2&&Number(weight)<=400;
 const category=useMemo(()=>categories.find(([,min,max])=>result>=min&&result<max)?.[0]||"분류 확인 필요",[result]);
 const submit=e=>{e.preventDefault();if(valid)setResult(Number(weight)/Math.pow(Number(height)/100,2))};
 return <div className="ow-q-bmi" data-source-view="bmi-original">
  <section className="ow-q-bmi-main">
   <h1>비만도 계산기</h1>
   <p className="ow-q-bmi-intro">BMI는 신체질량지수로 신장과 체중을 이용해 비만도를 알아볼 수 있는 방법입니다.</p>
   <form onSubmit={submit}>
    <div className="ow-q-bmi-fields">
     <label>신장<div><input aria-label="신장 (cm)" type="number" min="50" max="260" value={height} onChange={e=>setHeight(e.target.value)}/><span>cm</span></div></label>
     <label>체중<div><input aria-label="체중 (kg)" type="number" min="2" max="400" value={weight} onChange={e=>setWeight(e.target.value)}/><span>kg</span></div></label>
    </div>
    <button className="ow-q-bmi-submit" type="submit" disabled={!valid}>결과 보기</button>
   </form>
   <div className="ow-q-bmi-result" role="status">
    <div className="ow-q-bmi-value"><strong>{(Math.floor(result*10)/10).toFixed(1)}</strong> kg/m²</div>
    <span className="ow-q-bmi-status">{category}</span>
    <p>비만을 간접적으로 판정하는 방법으로 체중(kg)을 신장(m)의 제곱으로 나누어 구할 수 있습니다.</p>
   </div>
   <p className="ow-q-bmi-note">성인 기준이에요. 어린이·청소년이나 임신 중이라면 기준이 달라요. 결과는 참고용이며 진단을 대신하지 않아요.</p>
  </section>
  <section className="ow-q-bmi-criteria">
   <h2>BMI 비만도 기준</h2>
   <table><thead><tr><th>구분</th><th>BMI(kg/m²)</th></tr></thead><tbody>
    <tr><td>저체중</td><td>18.5 미만</td></tr><tr><td>정상</td><td>18.5 이상 ~ 23 미만</td></tr>
    <tr><td>과체중</td><td>23 이상 ~ 25 미만</td></tr><tr><td>비만</td><td>25 이상</td></tr>
   </tbody></table>
   <h2>관련 건강 정보</h2>
   <button onClick={()=>go("/healthLab/FAQ")} type="button">건강 FAQ 보기 <ChevronRight size={16}/></button>
  </section>
 </div>;
}
const doctorChips=[
 ["피부 질환",201],["호흡기 질환",189],["안구 질환",179],
 ["고혈압/고지혈증/당뇨",118],["신경/통증 질환",77],
 ["정형외과 질환",76],["탈모",75],["소화기 질환",37],
 ["다이어트",23],["귀/코/목 질환",11],["헤르페스",10],
 ["여성 질환",4],["소아 질환",1]
];
const hospitalChips=[
 ["안구 질환",58],["피부 질환",48],["여성 질환",43],
 ["호흡기 질환",28],["고혈압/고지혈증/당뇨",21],
 ["헤르페스",11],["소화기 질환",5],["소아 질환",4],
 ["탈모",4],["비뇨기 질환",1],["정형외과 질환",1]
];
export function OriginalReviewSource({kind="doctor",go}){
 const doctor=kind==="doctor";
 const chips=doctor?doctorChips:hospitalChips;
 const [active,setActive]=useState("");
 const [extended,setExtended]=useState(false);
 const route=doctor?"/telemedicine/doctor/탑연합의원-박광규-100/reviews":"/hospital/10055/reviews";
 const doc=getFact(route);
 const title=doctor?"박광규 가정의학과 의사 후기 1,079건 · 재진료 의향 99% (2026)":
  "동산의원 후기 464건 · 재진료 의향 97% (2026)";
 const name=doctor?"박광규 의사":"동산의원";
 const count=doctor?"1,079":"464";
 const ratio=doctor?"99%":"97%";
 const subsection=doctor?"박광규 의사 비대면 진료 후기 1,079건":"동산의원 비대면 진료 후기 224건";
 const reviewTitle=doctor?"친절히 상담해주셔서감사드려요":"다시 진료받고 싶어요";
 const clickChip=x=>setActive(active===x?"":x);
 return <div className={"ow-q-reviews "+(doctor?"ow-q-reviews-doctor":"ow-q-reviews-hospital")} data-source-view={doctor?"doctor-reviews-original":"hospital-reviews-original"}>
  <section className="ow-q-review-head">
   <h1>{doctor?<>박광규 가정의학과 의사 후기 1,079<br/>건 · 재진료 의향 99% (2026)</>:<>동산의원 후기 464건 · 재진료 의향<br/>97% (2026)</>}</h1>
   <div className="ow-q-review-metrics"><div><span>전체 후기</span><strong>{count}건</strong></div><div><span>재진료 의향</span><strong>{ratio}</strong></div></div>
   {doctor&&<div className="ow-q-review-ratings">
     <p><span>친절도</span><b>친절해요 99%</b></p>
     <p><span>설명</span><b>자세해요 95%</b></p>
     <p><span>시간 준수</span><b>잘 지켜요 99%</b></p>
   </div>}
   <div className="ow-q-review-tag-title">증상별 후기</div>
   <div className="ow-q-review-tags">{chips.map(([name,n])=>
     <button type="button" key={name} className={active===name?"selected":""} aria-pressed={active===name}
       onClick={()=>clickChip(name)}>{name} {n}건</button>)}</div>
  </section>
  <section className="ow-q-review-items">
   <h2>{active?active+" 후기":subsection}</h2>
   <p className="ow-q-reviews-subtitle">{active?"원본 화면에서 확인된 증상 분류":"최근 글 후기 우선 100건 표시"}</p>
   {!active&&<article className="ow-q-review-item">
    {doctor?<div className="ow-q-review-meta">피부 질환 처방　 김**(여성 50대)　|　26.10.24</div>:
      <div className="ow-q-review-doctor"><span className="ow-q-doctor-icon">👨🏻‍⚕️</span> 조상제 의사</div>}
    {!doctor&&<div className="ow-q-review-revisit">다시 진료받고 싶어요</div>}
    {!doctor&&<div className="ow-q-review-meta">여성 질환　 전**(여성 30대)　|　26.10.28</div>}
    {doctor&&<div className="ow-q-review-revisit">다시 진료받고 싶어요</div>}
    <p>{reviewTitle}</p>
    <div className="ow-q-review-detail-tags">{(doctor?["시간 준수","예약시간을 잘 지켜요"]:["시간 준수","친절한 진료","자세한 설명"]).map(x=>
     <span key={x}>{x}</span>)}</div>
   </article>}
   {active&&<p className="ow-q-reviews-empty">선택한 증상별 개별 후기는 원본에서 추가 자료 확인이 필요합니다.</p>}
   <button type="button" className="ow-q-review-more" onClick={()=>setExtended(!extended)}>
     {extended?"접기":"후기 전체 보기"} <ChevronRight size={17}/>
   </button>
   {extended&&<div className="ow-q-review-source"><p>{doc?.headline||HEADER_FALLBACK}</p>
     <button onClick={()=>go(doc?.links?.[0]?.path||"/hospital")} type="button">의료진·병원 정보 보기</button></div>}
  </section>
 </div>;
}
export default function WebsiteOriginalQuickPages({target,go}){
 let route=target;try{route=decodeURIComponent(target)}catch{}
 route=route.split("?")[0];
 if(route===MEDICINE_PATH)return <MedicineIngredientSource go={go}/>;
 if(route==="/healthLab/calculator/bmi")return <HealthBmiSource go={go}/>;
 if(route==="/hospital/10055/reviews")return <OriginalReviewSource kind="hospital" go={go}/>;
 if(route==="/telemedicine/doctor/탑연합의원-박광규-100/reviews")return <OriginalReviewSource kind="doctor" go={go}/>;
 return null;
}
