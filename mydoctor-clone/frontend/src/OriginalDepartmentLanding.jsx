import React,{useMemo,useState} from "react";
import {Menu,X,ChevronRight,ChevronDown,MapPin,Hospital,Stethoscope} from "lucide-react";
import menuFacts from "./data/verified-public-menu-facts-72.json";
import hospitalData from "./data/department-hospitals-observed.json";
import "./original-department-landing.css";

const areas=["서울","경기","인천","부산","대구","대전","전남광주","울산","세종","강원","경남","경북","전북","충남","충북","제주"];
const careOptions=[["all","모든 진료"],["specialist","전문의"],["sunday","일요일 진료"],["weekend","주말 진료"],["night","야간 진료"]];
const encode=(s)=>encodeURIComponent(s);
const decoded=(s)=>{try{return decodeURIComponent(s)}catch{return s}};
const sourceFor=(dept)=>menuFacts.find(x=>decoded(x.path)==="/dept-hub/"+dept);
const localPath=(dept,region,care)=>"/dept-hub/"+encode(dept)+"/"+(care!=="all"?encode({
 specialist:"전문의",sunday:"일요일진료",weekend:"주말진료",night:"야간진료"
}[care])+"/":"")+encode(region);
export default function OriginalDepartmentLanding({department,go}){
 const [menu,setMenu]=useState(false);
 const [selectedArea,setSelectedArea]=useState("");
 const [selectedCare,setSelectedCare]=useState("all");
 const origin=sourceFor(department);
 const otherRegions=useMemo(()=>areas.map(region=>({
  region,
  sourceLinks:(origin?.links||[]).filter(x=>decoded(x.path).startsWith("/dept-hub/"+department+"/"+region)),
  hasRows:!!hospitalData.departments[department]?.[region]?.rows?.length
 })),[department,origin]);
 const ask=(target)=>go(target);
 const viewList=(area=selectedArea,care=selectedCare)=>{
  const region=area||"서울";
  // Resolve exact source directory route for each condition, preserve its input.
  go(localPath(department,region,care));
 };
 const qna=(origin?.links||[]).filter(x=>
   /\/qna\//.test(x.path)||/^Q\s/.test(x.label)).slice(0,4);
 return <div className="original-dept-root" data-testid="original-department-landing">
   <header className="owh-header">
     <button type="button" className="owh-brand" aria-label="나만의닥터 홈" onClick={()=>go("/")}>
       <img src={(import.meta.env.BASE_URL||"/")+"website-source-hospital-brand.png"} alt="나만의닥터"/>
     </button>
     <button type="button" className="owh-menu-btn" aria-label={menu?"메뉴 닫기":"메뉴 열기"}
       aria-expanded={menu} onClick={()=>setMenu(x=>!x)}>{menu?<X size={22}/>:<Menu size={22}/>}</button>
     {menu&&<nav className="owh-dropdown">
       {[["비대면진료","/telemedicine"],["가격비교","/medical-cost"],["병원찾기","/hospital"],["약국찾기","/pharmacy"]]
        .map(([label,path])=><button key={path} type="button" onClick={()=>{setMenu(false);go(path)}}>
          {label}<ChevronRight size={17}/></button>)}
     </nav>}
   </header>
   <nav className="ow-hospital-breadcrumb" aria-label="현재 위치">
     <button type="button" onClick={()=>go("/")}>홈</button><span>›</span>
     <button type="button" onClick={()=>go("/hospital")}>병원찾기</button><span>›</span>
     <strong>{department}</strong>
   </nav>
   <section className="original-dept-hero">
     <h1>근처 {department} 찾기</h1>
     <p>내 주변 {department}를 지역별로 찾아보세요. 야간·일요일·주말 진료, 전문의 병원과 영업시간, 후기 정보를 나만의닥터에서 확인할 수 있어요.</p>
   </section>
   <form className="original-dept-lookup" onSubmit={e=>{e.preventDefault();viewList()}}>
     <label><MapPin size={18} aria-hidden="true"/>
       <select aria-label="지역" value={selectedArea} onChange={e=>setSelectedArea(e.target.value)}>
         <option value="">지역</option>{areas.map(r=><option value={r} key={r}>{r}</option>)}
       </select><ChevronDown size={16} aria-hidden="true"/></label>
     <label><Hospital size={18} aria-hidden="true"/>
       <select aria-label="진료과" defaultValue={department}>
         <option value={department}>{department}</option>
       </select><ChevronDown size={16} aria-hidden="true"/></label>
     <label><Stethoscope size={18} aria-hidden="true"/>
       <select aria-label="진료 조건" value={selectedCare} onChange={e=>setSelectedCare(e.target.value)}>
         {careOptions.map(([v,label])=><option value={v} key={v}>{label}</option>)}
       </select><ChevronDown size={16} aria-hidden="true"/></label>
     <button type="submit" className="original-dept-cta">병원 조회하기</button>
   </form>
   <div className="original-dept-near"><button type="button" onClick={()=>viewList("서울")}>
     내 주변 {department} 보기 <ChevronRight size={18}/></button></div>
   <section className="original-dept-regional">
     <h2>지역별 {department} 병원 찾기</h2>
     {otherRegions.map(({region,sourceLinks})=><div key={region} className="original-dept-region">
       <button type="button" className="original-dept-main-region"
         onClick={()=>viewList(region)} aria-label={region+" "+department+" 병원"}>
         <span>{region} {department} 병원</span><ChevronRight size={17}/></button>
       <div className="original-dept-region-options">
         {[
           ["specialist","전문의 병원"],
           ["sunday","일요일 진료 "+department+" 병원"],
           ["weekend","주말(토요일·일요일) 진료 "+department+" 병원"],
           ["night","야간 진료 "+department+" 병원"]
         ].map(([key,label])=><button key={key} type="button"
             onClick={()=>viewList(region,key)}>{region} {department==="피부과"&&key==="specialist"?"피부과 ": ""}
               {label}<ChevronRight size={14}/></button>)}
       </div>
     </div>)}
   </section>
   {qna.length>0&&<section className="original-dept-qna">
     <h2>{department} 의료진 Q&A</h2>
     {qna.map((x,i)=><button key={i} type="button" onClick={()=>ask(x.path)}>
       {x.label}<ChevronRight size={16}/></button>)}
   </section>}
 </div>;
}
