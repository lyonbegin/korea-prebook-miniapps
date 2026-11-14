import React,{useEffect,useState} from "react";
import {ArrowLeft,Hospital,MapPin,Search,ChevronRight,ChevronDown,Clock3,Users,CheckCircle2,X} from "lucide-react";
import hospitalData from "./data/department-hospitals-observed.json";
import {publicLinks} from "./HermesPagesStaticData.js";
import "./hermes-department-hospitals.css";

const data=hospitalData.departments;
const safeDecode=(s)=>{try{return decodeURIComponent(s)}catch{return s}};
const entry=(target)=>{
 const parts=safeDecode(target.split("?")[0]).split("/").filter(Boolean);
 const dept=parts[1]||"피부과";
 const regions=Object.keys(data[dept]||{});
 const requested=parts[2]||"서울";
 const region=regions.includes(requested)?requested:regions[0]||"서울";
 return {dept,region,regions,requested,record:data[dept]?.[region]};
};
const filters=[
 ["all","전체"],["night","야간진료"],["sunday","일요일진료"],["specialist","전문의"]
];
function SourceInfo(){return <p className="gh-h-source">
 원본 공개 병원 표의 수집 정보 · 2026-11-14 기준 · 실시간 영업 여부는 미확인
 </p>}
function HospitalCard({hospital,dept,region,go,index}){
 const url="/hospital/verified?dept="+encodeURIComponent(dept)+"&region="+encodeURIComponent(region)+"&row="+index;
 return <button type="button" className="gh-h-card" onClick={()=>go(url)}
   aria-label={hospital.name+" 병원 상세 보기"}>
   <span className="gh-h-avatar"><Hospital size={22}/></span>
   <span className="gh-h-card-text">
     <strong>{hospital.name}</strong>
     <small><MapPin size={14}/>{hospital.address}</small>
     <small><Users size={14}/>{dept} 전문의 {hospital.specialists}명
       {hospital.station?" · "+hospital.station:""}</small>
     <span className="gh-h-badges">
       {hospital.hours.includes("야간")&&<em>야간 진료</em>}
       {hospital.hours.includes("일요일")&&<em>일요일 진료</em>}
     </span>
   </span>
   <ChevronRight size={17} color="#9ba6b8"/>
 </button>
}
export function DepartmentHospitalBrowser({target,go}){
 const {dept,region,regions,requested,record}=entry(target);
 const [search,setSearch]=useState("");
 const [condition,setCondition]=useState("all");
 const [sort,setSort]=useState("original");
 useEffect(()=>{setSearch("");setCondition("all");setSort("original")},[target]);
 const rows=(record?.rows||[]).map((h,index)=>({...h,index}));
 const results=rows.filter(h=>{
    if(condition==="night"&&!h.hours.includes("야간"))return false;
    if(condition==="sunday"&&!h.hours.includes("일요일"))return false;
    if(condition==="specialist"&&!(h.specialists>0))return false;
    if(search&&!([h.name,h.address,h.station,h.hours].join(" ").toLowerCase().includes(search.toLowerCase())))return false;
    return true;
 }).sort((a,b)=>sort==="name"?a.name.localeCompare(b.name,"ko-KR"):a.index-b.index);
 const other=publicLinks("hospital").filter(x=>x.path.startsWith("/dept-hub/")&&
  safeDecode(x.path)!=="/dept-hub/"+dept).slice(0,24);
 return <div className="gh-h-list" data-testid="verified-specialty-screen"
     data-specialty={dept} data-region={region}>
   <header className="gh-h-header">
     <button type="button" aria-label="병원 찾기로 뒤로" onClick={()=>go("/hospital")}>
       <ArrowLeft size={23}/></button>
     <span><strong>{dept} 병원 찾기</strong><small>진료과별 병원 목록</small></span>
   </header>
   <section className="gh-h-intro">
     <p className="gh-h-eyebrow">진료과별 병원 찾기</p>
     <h1>{region} {dept} 병원</h1>
     <p>확인된 병원명·주소·전문의 정보로 비교합니다.</p>
     <SourceInfo/>
   </section>
   <section className="gh-h-section">
     <h2>지역 선택</h2>
     <div className="gh-h-regions" role="group" aria-label="지역 선택">
       {regions.length?regions.map(name=><button type="button" key={name}
         aria-pressed={name===region} className={name===region?"active":""}
         onClick={()=>go("/dept-hub/"+encodeURIComponent(dept)+"/"+encodeURIComponent(name))}>{name}</button>)
         :<span className="gh-h-unavailable">해당 진료과의 지역별 공개 병원 명단은 아직 없습니다.</span>}
     </div>
     {requested!==region&&regions.length>0&&
       <p className="gh-h-incomplete">{requested} 병원 데이터가 없어 {region}의 확인된 목록만 표시합니다.</p>}
   </section>
   <section className="gh-h-section" data-testid="verified-department-hospitals">
     <div className="gh-h-list-heading">
       <h2>{region} {dept} 병원 목록</h2>
       <span>{results.length}곳 표시</span>
     </div>
     <label className="gh-h-search"><Search size={19}/>
       <input aria-label="병원명 또는 지역 검색" type="search"
         placeholder="병원명 · 지역 · 지하철역 검색" value={search}
         onChange={e=>setSearch(e.target.value)}/>
       {search&&<button type="button" aria-label="검색어 지우기"
         onClick={()=>setSearch("")}><X size={17}/></button>}
     </label>
     <div className="gh-h-filters" role="group" aria-label="진료 조건">
       {filters.map(([id,label])=><button key={id} type="button"
         className={condition===id?"active":""} aria-pressed={condition===id}
         onClick={()=>setCondition(id)}>{label}</button>)}
     </div>
     <div className="gh-h-list-heading secondary">
       <span>수집된 병원 {rows.length}곳 중 {results.length}곳</span>
       <button type="button" aria-label="병원 정렬 바꾸기"
         onClick={()=>setSort(x=>x==="original"?"name":"original")}>
         {sort==="original"?"원본 공개 순서":"이름순"} <ChevronDown size={15}/>
       </button>
     </div>
     {results.length?<div data-testid="verified-hospital-list">
        {results.map(h=><HospitalCard key={h.name+"-"+h.address} hospital={h}
          index={h.index} dept={dept} region={region} go={go}/>)}
       </div>:<div className="gh-h-empty">
        <Hospital size={30}/>
        <strong>표시할 병원 자료가 없습니다.</strong>
        <p>{rows.length?"검색어와 진료 조건을 변경해 주세요.":
          "원본 공개 병원 표가 확보되지 않아 실제 병원명을 임의 생성하지 않았습니다."}</p>
       </div>}
   </section>
   {!!other.length&&<section className="gh-h-section">
      <h2>다른 진료과</h2>
      <div className="gh-h-regions">{other.map(x=><button type="button"
        key={x.path} onClick={()=>go(x.path)}>{x.label}</button>)}</div>
    </section>}
 </div>;
}
export function VerifiedHospitalProfile({target,go}){
 const q=new URLSearchParams(target.split("?")[1]||"");
 const dept=q.get("dept")||"";
 const region=q.get("region")||"";
 const i=Number(q.get("row"));
 const valid=Number.isInteger(i)&&i>=0&&i<1000;
 const hospital=valid?data[dept]?.[region]?.rows?.[i]:null;
 const [tab,setTab]=useState("info");
 const back=()=>go("/dept-hub/"+encodeURIComponent(dept)+"/"+encodeURIComponent(region));
 return <div className="gh-h-list" data-testid="verified-hospital-profile">
   <header className="gh-h-header">
     <button type="button" onClick={back} aria-label="병원 목록으로 뒤로"><ArrowLeft size={23}/></button>
     <span><strong>병원 상세</strong><small>{dept} · {region}</small></span>
   </header>
   {hospital?<><section className="gh-h-intro gh-h-profile-intro">
     <span className="gh-h-profile-icon"><Hospital size={29}/></span>
     <h1>{hospital.name}</h1>
     <p><MapPin size={15}/>{hospital.address}</p>
     <SourceInfo/>
   </section>
   <nav className="gh-h-tabs" aria-label="병원 상세 탭">
     {[["info","병원 정보"],["hours","진료 조건"],["dept","진료과"]].map(([key,label])=>
       <button key={key} type="button" className={tab===key?"active":""}
         aria-pressed={tab===key} onClick={()=>setTab(key)}>{label}</button>)}
   </nav>
   <section className="gh-h-section">
     {tab==="info"&&<>
        <h2>기본 정보</h2>
        <dl className="gh-h-details">
         <div><dt>병원명</dt><dd>{hospital.name}</dd></div>
         <div><dt>위치</dt><dd>{hospital.address}</dd></div>
         {!!hospital.station&&<div><dt>인근 지하철</dt><dd>{hospital.station}</dd></div>}
         <div><dt>전문의</dt><dd>{dept} 전문의 {hospital.specialists}명</dd></div>
        </dl>
       </>}
     {tab==="hours"&&<>
        <h2>진료 조건</h2>
        <p className="gh-h-info-copy">{hospital.hours}</p>
        <p className="gh-h-info-copy">요일별 정확한 운영시간은 원본 정적 병원 표에 포함되지 않았습니다.</p>
       </>}
     {tab==="dept"&&<>
        <h2>진료과목</h2>
        <p className="gh-h-info-copy">{dept}</p>
        <button type="button" className="gh-h-return" onClick={back}>
          같은 지역의 다른 {dept} 병원 <ChevronRight size={16}/></button>
       </>}
   </section></>:<section className="gh-h-section">
     <h2>원본에서 확인되지 않은 병원입니다.</h2>
     <button type="button" className="gh-h-return" onClick={back}>병원 목록으로 돌아가기</button>
   </section>}
 </div>;
}
