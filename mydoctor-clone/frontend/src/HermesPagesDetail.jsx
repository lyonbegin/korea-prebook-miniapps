import React,{useMemo,useState} from "react";
import {
  ArrowLeft,Search,X,ChevronRight,ChevronDown,MapPin,Clock3,
  Hospital,Stethoscope,Tags,Pill,FileText,CalendarDays,
  Phone,ShieldCheck,Star,ArrowRight
} from "lucide-react";
import facts from "./data/verified-public-page-facts-29.json";
import {DepartmentHospitalBrowser,VerifiedHospitalProfile} from "./HermesDepartmentHospitals.jsx";
import medicalCostCards from "./data/original-medical-cost-cards.json";
import {allObservedPublicLinks,publicLinks} from "./HermesPagesStaticData.js";
import "./hermes-pages-detail.css";

const norm=(p)=>{
  if(typeof p!=="string")return "";
  try{return decodeURIComponent(p).replace(/\/$/,"")||"/"}catch{return p}
};
const pathIndex=new Map(facts.map(x=>[norm(x.path),x]));
const observedLinks=[
  ...allObservedPublicLinks,
  ...facts.flatMap(f=>f.links||[]),
  ...medicalCostCards.map(x=>({path:x.path,label:x.title}))
];
const getEvidence=(target)=>{
  const exact=pathIndex.get(norm(target));
  if(exact)return exact;
  if(norm(target).startsWith("/pharmacy/야간약국"))return pathIndex.get("/pharmacy/야간약국");
  return null;
};
const findLink=(target)=>observedLinks.find(x=>norm(x.path)===norm(target));
const words=(t)=>(t||"").replace(/\s+/g," ").trim();
const titleFor=(target,doc)=>{
  if(doc?.headline)return words(doc.headline);
  const match=findLink(target);
  if(match?.label)return match.label;
  const name=norm(target).split("?")[0].split("/").filter(Boolean).pop();
  return words(name?.replace(/-/g," ")||"상세 정보");
};
const limit=(arr,n=18)=>Array.isArray(arr)?arr.slice(0,n):[];
const shown=(value)=>typeof value==="string"&&value.trim();
const sourceDate="2026-11-09";
const validLink=(x)=>x&&typeof x.path==="string"&&x.path.startsWith("/")&&!x.path.startsWith("//");
const related=(target,doc,n=16)=>{
  const prefix=target.startsWith("/dept-hub/")?"/dept-hub/":
    target.startsWith("/medical-cost/")?"/medical-cost/":
    target.startsWith("/telemedicine/")?"/telemedicine/":
    target.startsWith("/hospital/")?"/hospital/":
    target.startsWith("/pharmacy/")?"/pharmacy/":
    target.startsWith("/medicine/")?"/medicine/":
    target.startsWith("/healthLab/")?"/healthLab/":"/";
  return [...(doc?.links||[]),...observedLinks]
    .filter(validLink)
    .filter(x=>x.path.startsWith(prefix)&&norm(x.path)!==norm(target))
    .filter((x,i,a)=>a.findIndex(y=>norm(y.path)===norm(x.path))===i)
    .slice(0,n);
};
function DetailHead({title,subtitle,back}){
  return <header className="gh-d-head">
    <button type="button" aria-label="이전 화면" onClick={back}><ArrowLeft size={22}/></button>
    <span><strong>{title}</strong>{subtitle&&<small>{subtitle}</small>}</span>
  </header>;
}
function VerifiedChip({children}){return <span className="gh-d-chip">{children}</span>}
function SourceCaption({isData}){return <p className="gh-d-source">{isData?
  "원본 공개 페이지 수집 정보 · "+sourceDate+" 기준":"공개 메뉴를 기반으로 구성한 UI · 조회 결과 미포함"}</p>}
function LinkRows({links,go,compact=false}){
  if(!links.length)return null;
  return <div className={"gh-d-rows"+(compact?" compact":"")}>
    {links.map((x,i)=><button type="button" key={x.path+"-"+i}
      onClick={()=>go(x.path)} className="gh-d-link-row">
      <span>{x.label}</span><ChevronRight size={17} aria-hidden="true"/>
    </button>)}
  </div>;
}
function SearchField({value,onChange,placeholder}){
  return <label className="gh-d-search"><Search size={18}/>
    <input value={value} type="search" aria-label="목록 검색" placeholder={placeholder}
      onChange={e=>onChange(e.target.value)}/>
    {value&&<button aria-label="검색어 지우기" type="button" onClick={()=>onChange("")}><X size={17}/></button>}
  </label>;
}
function DataTable({table}){
  if(!table?.rows?.length)return null;
  return <div className="gh-d-table-scroll" role="region" aria-label="수집된 가격 및 정보 표" tabIndex={0}>
    <table className="gh-d-table">
      <thead><tr>{(table.headers||[]).map((h,i)=><th key={i}>{h}</th>)}</tr></thead>
      <tbody>{table.rows.map((row,i)=><tr key={i}>
        {row.map((v,j)=><td key={j}>{v===null?"":String(v)}</td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}
function Section({title,children,subTitle}){
  return <section className="gh-d-section"><div className="gh-d-section-title">
    <h2>{title}</h2>{subTitle&&<small>{subTitle}</small>}</div>{children}
  </section>;
}
function PriceDetail({target,doc,go}){
 const [tab,setTab]=useState("prices"),[search,setSearch]=useState("");
 const [expanded,setExpanded]=useState(false);
 const card=medicalCostCards.find(x=>norm(x.path)===norm(target));
 const name=card?.title||findLink(target)?.label||titleFor(target,doc).split(" 가격")[0];
 const providerLinks=(doc?.links||[]).filter(x=>/\/hospital\/detail\?hospital_id=/.test(x.path));
 const seen=new Set();
 const providers=providerLinks.filter(x=>{if(seen.has(x.path))return false;seen.add(x.path);return true});
 const filtered=providers.filter(x=>x.label.toLowerCase().includes(search.toLowerCase()));
 const suggestions=medicalCostCards.filter(x=>norm(x.path)!==norm(target)).slice(0,10);
 return <>
   <div className="gh-d-hero">
     <div className="gh-d-hero-icon"><Tags size={25}/></div>
     <p className="gh-d-eyebrow">병원 예약 · 가격 비교</p>
     <h1>{name}</h1>
     {card?.subtitle&&<p>{card.subtitle}</p>}
     <SourceCaption isData={!!doc}/>
   </div>
   <nav className="gh-d-segments" aria-label="가격 비교 상세 탭">
    {[["prices","가격 정보"],["providers","병원·약국"],["related","다른 항목"]].map(([id,label])=>
      <button key={id} type="button" aria-pressed={tab===id}
        className={tab===id?"active":""} onClick={()=>setTab(id)}>{label}</button>)}
   </nav>
   {tab==="prices"&&<>
     <Section title="가격 비교" subTitle={doc?.tables?.length?sourceDate+" 원본 공개 자료":undefined}>
       {doc?.tables?.length?
         doc.tables.map((t,i)=><div className="gh-d-table-section" key={i}>
            <h3>{t.headers?.[0]||"가격표"} {i+1}</h3><DataTable table={t}/>
          </div>):
         <div className="gh-d-data-empty">
           <Tags size={28}/><strong>{name} 가격 자료</strong>
           <p>이 항목의 병원별 실제 가격표는 현재 정적 자료에 포함되지 않았습니다.</p>
         </div>}
     </Section>
     {doc?.headings?.length>0&&<Section title="원본에서 확인한 병원·정보">
       <div className="gh-d-tags">{limit(doc.headings.filter(h=>/의원|병원|약국/.test(h)),12).map((h,i)=>
         <VerifiedChip key={i}>{h}</VerifiedChip>)}</div>
     </Section>}
     <Section title="다른 항목 비교"><LinkRows links={suggestions.map(x=>({label:x.title,path:x.path}))} go={go} compact/></Section>
   </>}
   {tab==="providers"&&<Section title="가격 비교 병원" subTitle={doc?sourceDate+" 목록":undefined}>
      <SearchField value={search} onChange={setSearch} placeholder="병원 이름 검색"/>
      {filtered.length?<LinkRows links={filtered} go={go}/>:
        <div className="gh-d-data-empty"><Hospital size={28}/><p>확인된 병원 목록이 없습니다.</p></div>}
   </Section>}
   {tab==="related"&&<Section title="다른 가격 비교 항목">
      <LinkRows go={go} links={medicalCostCards.filter(x=>norm(x.path)!==norm(target)).map(x=>({label:x.title,path:x.path}))}/>
   </Section>}
 </>;
}
function TelemedicineDetail({target,doc,go}){
 const [term,setTerm]=useState(""),[onlyReservations,setOnlyReservations]=useState(false);
 const title=(findLink(target)?.label||titleFor(target,doc)).replace(/ 비대면진료.*$/,"");
 const doctors=(doc?.links||[]).filter(x=>x.path.startsWith("/telemedicine/doctor/"));
 const filtered=doctors.filter(x=>(!term||x.label.toLowerCase().includes(term.toLowerCase()))&&
   (!onlyReservations||/예약가능/.test(x.label)));
 const more=publicLinks("telemedicine").filter(x=>norm(x.path)!==norm(target)).slice(0,16);
 return <>
   <div className="gh-d-hero">
     <div className="gh-d-hero-icon"><Stethoscope size={26}/></div>
     <p className="gh-d-eyebrow">비대면 진료</p>
     <h1>{title} 진료</h1>
     <p>증상·진료과 선택부터 의사 정보 확인까지</p>
     <SourceCaption isData={!!doc}/>
   </div>
   <Section title="진료 가능한 의사 찾기">
     <SearchField value={term} onChange={setTerm} placeholder="병원·의사 이름 검색"/>
     <button className={"gh-d-filter"+(onlyReservations?" active":"")} type="button"
       aria-pressed={onlyReservations} onClick={()=>setOnlyReservations(x=>!x)}>
       <CalendarDays size={15}/> 예약가능 표시된 의사
     </button>
     {!!filtered.length&&<div className="gh-d-doctor-list">
       {filtered.slice(0,25).map((x,i)=><button className="gh-d-doctor-row" key={x.path+"-"+i}
         type="button" onClick={()=>go(x.path)}>
           <span className="gh-d-doctor-avatar"><Stethoscope size={23}/></span>
           <span className="gh-d-doctor-copy"><strong>{x.label.split(/ \d{2,3}%/)[0]}</strong>
             <small>{x.label.includes("예약가능")?"수집 당시 예약가능 표시": "원본 공개 의사 정보"}</small></span>
           <ChevronRight size={17}/>
         </button>)}
     </div>}
     {!filtered.length&&<div className="gh-d-data-empty"><Stethoscope size={25}/>
       <strong>조회된 의사 정보가 없습니다.</strong>
       <p>이 질환에 대한 의사별 공개 목록은 정적 자료로 수집되지 않았습니다.</p>
     </div>}
   </Section>
   <Section title="다른 증상·진료과">
     <div className="gh-d-pill-links">{more.map(x=><button type="button" key={x.path}
       onClick={()=>go(x.path)}>{x.label}</button>)}</div>
   </Section>
 </>;
}
function DepartmentDetail({target,doc,go}){
 const [term,setTerm]=useState(""),[mode,setMode]=useState("all");
 const name=(findLink(target)?.label||norm(target).split("/")[2]||"진료과").replace(/ 병원.*$/,"");
 const source=doc?.links?.length?doc.links:[];
 const other=publicLinks("hospital").filter(x=>x.path.startsWith("/dept-hub/")&&norm(x.path)!==norm(target));
 const links=source.length?source:other;
 const filtered=links.filter(x=>(mode==="all"||
    (mode==="weekend"&&/일요일|주말|토요일/.test(x.label))||
    (mode==="night"&&/야간/.test(x.label))||
    (mode==="area"&&/서울|경기|인천|부산|대구|대전/.test(x.label)))
   &&(!term||x.label.includes(term)));
 return <>
  <div className="gh-d-hero">
    <div className="gh-d-hero-icon"><Hospital size={26}/></div>
    <p className="gh-d-eyebrow">진료과별 병원 찾기</p>
    <h1>{name} 병원 찾기</h1>
    <p>진료과·지역·진료 조건으로 병원을 찾아보세요.</p>
    <SourceCaption isData={!!doc}/>
  </div>
  <Section title="진료 조건">
    <SearchField value={term} onChange={setTerm} placeholder="지역 및 진료 조건 검색"/>
    <div className="gh-d-filters">{[["all","전체"],["area","지역별"],["weekend","주말"],["night","야간"]]
      .map(([key,label])=><button key={key} type="button"
        className={mode===key?"active":""} aria-pressed={mode===key} onClick={()=>setMode(key)}>{label}</button>)}</div>
    <LinkRows links={filtered.slice(0,60)} go={go}/>
    {!filtered.length&&<div className="gh-d-data-empty"><Hospital size={26}/>
      <p>현재 선택한 조건에 해당하는 공개 경로가 없습니다.</p></div>}
  </Section>
  <Section title="다른 진료과"><div className="gh-d-pill-links">{other.slice(0,20)
    .map(x=><button key={x.path} type="button" onClick={()=>go(x.path)}>{x.label}</button>)}</div></Section>
 </>;
}
function HospitalCollection({target,doc,go}){
 const [term,setTerm]=useState("");
 const known=doc?.links?.filter(x=>/\/hospital\/detail\?hospital_id=/.test(x.path))||[];
 const filtered=known.filter(x=>x.label.includes(term));
 const relatedNav=doc?.links?.filter(x=>validLink(x)&&!x.path.includes("detail?"))||[];
 return <>
   <div className="gh-d-hero"><div className="gh-d-hero-icon"><Hospital size={26}/></div>
     <p className="gh-d-eyebrow">진료 조건별 병원 찾기</p>
     <h1>{findLink(target)?.label||"야간·휴일 진료 병원"}</h1>
     <SourceCaption isData={!!doc}/>
   </div>
   <Section title="원본 공개 병원 목록">
     <SearchField value={term} onChange={setTerm} placeholder="병원·지역 이름으로 검색"/>
     {filtered.length?<div className="gh-d-hospital-list">
       {filtered.slice(0,45).map(x=>{
         const sep=x.label.indexOf(" 야간 진료");
         const label=sep>=0?x.label.slice(0,sep):x.label;
         const info=sep>=0?x.label.slice(sep+1):"";
         return <button type="button" key={x.path} className="gh-d-hospital-card" onClick={()=>go(x.path)}>
           <span className="gh-d-hospital-icon"><Hospital size={22}/></span>
           <span><strong>{label}</strong><small>{info}</small></span><ChevronRight size={18}/>
         </button>})}
     </div>:<div className="gh-d-data-empty"><Hospital size={26}/>
        <p>해당 검색어로 확인된 병원 정보가 없습니다.</p></div>}
   </Section>
   {!!relatedNav.length&&<Section title="지역·다른 진료 조건"><LinkRows links={relatedNav.slice(0,36)} go={go}/></Section>}
 </>;
}
function HospitalProfile({target,doc,go}){
 const [tab,setTab]=useState("info");
 const observed=findLink(target);
 const name=doc?.title?.split(" 경남")[0]?.split(" |")[0]||
   observed?.label?.split(" 야간 진료")[0]||"병원 정보";
 const relatedSites=related(target,doc,18);
 return <>
   <div className="gh-d-profile">
     <span className="gh-d-profile-symbol"><Hospital size={34}/></span>
     <h1>{name}</h1>
     {observed?.label?.includes(" 야간 진료")&&<p>{observed.label.slice(observed.label.indexOf(" 야간 진료")+1)}</p>}
     <SourceCaption isData={!!doc||!!observed}/>
   </div>
   <nav className="gh-d-segments">
     {[["info","병원 정보"],["cost","진료비"],["more","관련 병원"]].map(([key,label])=>
       <button key={key} onClick={()=>setTab(key)} aria-pressed={tab===key}
         className={tab===key?"active":""}>{label}</button>)}
   </nav>
   {tab==="info"&&<Section title="병원 소개">
      {doc?.headings?.length?
       <div className="gh-d-facts">{doc.headings.filter(x=>/위치|영업시간|진료비|진료시간/.test(x))
         .map((x,i)=><div key={i}><ShieldCheck size={18}/>{x}</div>)}</div>:
       <div className="gh-d-data-empty"><MapPin size={25}/><p>병원별 상세 주소·전화번호·진료시간은 수집된 자료에 없습니다.</p></div>}
   </Section>}
   {tab==="cost"&&<Section title="수집된 진료비">
      {doc?.tables?.length?doc.tables.map((t,i)=><DataTable key={i} table={t}/>):
       <div className="gh-d-data-empty"><Tags size={26}/><p>확인된 진료비 자료가 없습니다.</p></div>}
   </Section>}
   {tab==="more"&&<Section title="함께 찾는 병원"><LinkRows links={relatedSites.slice(0,20)} go={go}/></Section>}
 </>;
}
function PharmacyDetail({target,doc,go}){
 const [term,setTerm]=useState(""),[selected,setSelected]=useState("");
 const cards=doc?.pharmacy_cards||[];
 const region=norm(target).split("/").slice(3)[0]||"";
 const rows=cards.filter(x=>(!term||x.name.includes(term)||x.address?.includes(term))&&
   (!region||x.address?.includes(region)||x.name?.includes(region)));
 const locations=doc?.links?.filter(x=>x.path.startsWith("/pharmacy/"))||[];
 return <>
   <div className="gh-d-hero"><div className="gh-d-hero-icon"><Pill size={25}/></div>
     <p className="gh-d-eyebrow">약국 찾기</p><h1>{findLink(target)?.label||"야간 약국"}</h1>
     <SourceCaption isData={!!cards.length}/>
   </div>
   <Section title="지역별 약국">
    {!!locations.length&&<div className="gh-d-pill-links">{locations.slice(0,22).map(x=>
      <button type="button" key={x.path} onClick={()=>go(x.path)}>{x.label}</button>)}</div>}
    <SearchField value={term} onChange={setTerm} placeholder="약국명 또는 주소 검색"/>
    {rows.map((p,i)=><article className="gh-d-pharmacy-card" key={p.name+"-"+i}>
      <button type="button" aria-expanded={selected===p.name} onClick={()=>setSelected(selected===p.name?"":p.name)}>
        <span><strong>{p.name}</strong><small><MapPin size={13}/>{p.address}</small>
        {p.today_hours&&<small><Clock3 size={13}/>{p.today_hours} (수집 당시)</small>}</span>
        {selected===p.name?<ChevronDown size={18}/>:<ChevronRight size={18}/>}
      </button>
      {selected===p.name&&<div className="gh-d-pharmacy-expanded">
         <p>{p.weekly_hours||"주간 운영시간 미확인"}</p>
         {p.phone&&<a href={"tel:"+p.phone.replace(/[^0-9+]/g,"")}><Phone size={15}/>{p.phone}</a>}
       </div>}
    </article>)}
    {!rows.length&&<div className="gh-d-data-empty"><Pill size={28}/>
      <p>현재 자료에서 이 지역의 약국 목록을 확인할 수 없습니다.</p></div>}
   </Section>
 </>;
}
function KnowledgeDetail({target,doc,go}){
 const [term,setTerm]=useState("");
 const name=findLink(target)?.label||doc?.headline||titleFor(target,doc);
 const list=doc?.links?.filter(validLink)||related(target,doc,20);
 const rows=list.filter(x=>!term||x.label.includes(term)).slice(0,60);
 return <>
  <div className="gh-d-hero"><div className="gh-d-hero-icon"><FileText size={25}/></div>
    <p className="gh-d-eyebrow">건강·의약품 정보</p><h1>{name}</h1>
    <SourceCaption isData={!!doc}/>
  </div>
  {!!doc?.tables?.length&&<Section title="확인된 정보">
    {doc.tables.map((t,i)=><DataTable key={i} table={t}/>)}
  </Section>}
  {!!doc?.headings?.length&&<Section title="원본 공개 정보">
    <div className="gh-d-facts">{limit(doc.headings.filter(h=>!/^비대면진료$|^가격비교$|^병원찾기$/.test(h)),16)
      .map((h,i)=><div key={i}><FileText size={15}/>{h}</div>)}</div>
  </Section>}
  <Section title="관련 내용">
    <SearchField value={term} onChange={setTerm} placeholder="관련 항목 검색"/>
    <LinkRows links={rows} go={go}/>
    {!rows.length&&<div className="gh-d-data-empty">관련 공개 항목이 없습니다.</div>}
  </Section>
 </>;
}
function MapDetail({target,doc,go}){
 const [filter,setFilter]=useState("");
 const name=findLink(target)?.label||doc?.headline||"지도·약국 찾기";
 const links=(doc?.links||[]).filter(validLink).filter(x=>!filter||x.label.includes(filter));
 return <>
   <div className="gh-d-hero"><div className="gh-d-hero-icon"><MapPin size={26}/></div>
     <p className="gh-d-eyebrow">병원·약국 지도</p><h1>{name}</h1>
     <SourceCaption isData={!!doc}/>
   </div>
   <Section title="병원·약국 관련 검색">
      <SearchField value={filter} onChange={setFilter} placeholder="지역·병원 검색"/>
      <LinkRows links={links.slice(0,40)} go={go}/>
      {!links.length&&<div className="gh-d-data-empty"><MapPin size={25}/>
        <p>위치 좌표가 확보되지 않아 지도 표시는 연결되지 않았습니다.</p></div>}
   </Section>
 </>;
}
export default function HermesPagesDetail({target,go,back}){
  const doc=getEvidence(target);
  const known=findLink(target);
  const type=target.startsWith("/medical-cost/")?"price":
    target.startsWith("/telemedicine/doctor/")?"doctor":
    target.startsWith("/telemedicine/")?"telemedicine":
    target.startsWith("/dept-hub/")?"department":
    target.startsWith("/hospital/verified?")?"verified-hospital":
    target.startsWith("/hospital/detail?")||/^\/hospital\/\d+/.test(target)?"hospital":
    target.startsWith("/hospital/")?"hospital-collection":
    target.startsWith("/pharmacy/")?"pharmacy":
    target.startsWith("/map/")?"map":
    "knowledge";
  const title=type==="hospital"?known?.label?.split(" 야간 진료")[0]||doc?.headline||"병원 정보":
    type==="price"?"가격 비교":type==="telemedicine"?"비대면 진료":
    type==="department"?"병원 찾기":type==="pharmacy"?"약국 찾기":
    type==="doctor"?"의사 정보":type==="hospital-collection"?"진료 병원":"상세 정보";
  return <div className="gh-d-page" data-testid="pages-static-detail" data-detail-type={type} data-detail-target={target}>
    {type!=="department"&&type!=="verified-hospital"&&<DetailHead title={title} subtitle={known?.label||undefined} back={back}/>}
    {type==="price"&&<PriceDetail target={target} doc={doc} go={go}/>}
    {type==="telemedicine"&&<TelemedicineDetail target={target} doc={doc} go={go}/>}
    {type==="department"&&<DepartmentHospitalBrowser target={target} go={go}/>}
    {type==="hospital-collection"&&<HospitalCollection target={target} doc={doc} go={go}/>}
    {type==="hospital"&&<HospitalProfile target={target} doc={doc} go={go}/>}
    {type==="verified-hospital"&&<VerifiedHospitalProfile target={target} go={go}/>}
    {type==="pharmacy"&&<PharmacyDetail target={target} doc={doc} go={go}/>}
    {type==="map"&&<MapDetail target={target} doc={doc} go={go}/>}
    {(type==="knowledge"||type==="doctor")&&<KnowledgeDetail target={target} doc={doc} go={go}/>}
  </div>;
}
