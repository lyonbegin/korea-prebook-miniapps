import React,{useMemo,useState}from "react";
import{Search,ChevronRight,MapPin}from "lucide-react";

/** Reusable original-fact views, grouped by distinct navigation/interaction type.
 * No synthetic doctors, appointments, prices or private records.
 * Data comes from mydoctor_clone.public_page_facts through /catalog/page.
 */
const geo=["전국","서울","경기","인천","부산","대구","대전","광주","울산","세종","강원","충남","충북","경남","경북","전남","전북","제주"];
const base=link=>{try{return decodeURIComponent(link.path).replace(/\s+/g," ")}catch{return link.path}};
const isPlace=link=>/\/(?:hospital|dept-hub|pharmacy|map)(?:\/|$)/.test(link.path);
const isMedicine=link=>link.path.startsWith("/medicine/");
const normalize=x=>String(x||"").toLocaleLowerCase("ko-KR").replace(/\s+/g," ");
function verifiedLinks(links){
 const seen=new Set();
 return (links||[]).filter(x=>x.path&&x.label&&x.path!=="/"&&!seen.has(x.path)&&seen.add(x.path));
}
export function SourceRows({links,go,kind="directory",defaultMaxHeight=null}){
 const [expanded,setExpanded]=useState(false);
 const hasMore=defaultMaxHeight!==null&&links.length>20;
 return <div className="observed-row-container">
  <div className={"observed-links observed-"+kind+(hasMore&&!expanded?" is-collapsed":"")}
    style={hasMore&&!expanded?{maxHeight:defaultMaxHeight,overflow:"hidden"}:undefined}>
  {links.map(link=><a key={link.path} href={link.path} className="observed-link"
     onClick={e=>{e.preventDefault();go(link.path)}}>
    <span>{link.label}</span><ChevronRight size={16} aria-hidden="true"/>
  </a>)}
  </div>
  {hasMore&&<button type="button" className="observed-expand" aria-expanded={expanded}
    onClick={()=>setExpanded(!expanded)}>{expanded?"접기":"전체 보기"} <ChevronRight size={15}/></button>}
 </div>;
}
function SourceTables({tables}){
 return <section className="observed-prices" aria-label="원본 가격·수치표">
 {(tables||[]).map((table,i)=><div className="observed-table" key={i}>
  <div className="table-scroll"><table className="cost-table">
  {!!table.headers?.length&&<thead><tr>{table.headers.map((h,j)=><th key={j}>{h}</th>)}</tr></thead>}
  <tbody>{table.rows.map((cells,j)=><tr key={j}>{cells.map((cell,k)=><td key={k}>{cell}</td>)}</tr>)}</tbody>
  </table></div></div>)}
 </section>;
}
function SectionHeadings({sections}){
 const skip=new Set(["비대면진료","가격비교","병원찾기","약국찾기","의약품 정보","건강 정보","나만의닥터"]);
 return <div className="observed-section-headings">{(sections||[]).filter(s=>!skip.has(s.heading)).slice(0,36).map((s,i)=>
  <h2 key={i}>{s.heading}</h2>)}</div>;
}
function getViewType(path){
 if(path==="/medicine")return "medicine-search";
 if(path.startsWith("/medicine/ingredient/")||path.startsWith("/medicine/effect/"))return "medicine-filter";
 if(path.startsWith("/medicine/"))return "medicine-detail";
 if(path==="/pharmacy")return "pharmacy-search";
 if(path.startsWith("/pharmacy/"))return "pharmacy-list";
 if(path==="/hospital")return "hospital-search";
 if(path.startsWith("/hospital/")||path.startsWith("/dept-hub/"))return "hospital-list";
 if(path==="/medical-cost")return "medical-cost-search";
 if(path.startsWith("/medical-cost/"))return "medical-cost-detail";
 if(path.startsWith("/healthLab/calculator/bmi"))return "health-calculator-bmi";
 if(path.startsWith("/telemedicine/doctor/")||path.startsWith("/hospital/")&&path.endsWith("/reviews"))return "reviews-or-doctor";
 if(path.startsWith("/telemedicine/"))return "telemedicine-list";
 if(path.startsWith("/map/"))return "map-directory";
 if(path.startsWith("/qna"))return "qna-directory";
 if(path.startsWith("/healthLab"))return "health-directory";
 return "public-directory";
}
export function VerifiedSourcePage({data,go,route}){
 const kind=getViewType(route);
 const [search,setSearch]=useState("");
 const [region,setRegion]=useState("전체");
 const [tab,setTab]=useState("전체");
 const entries=useMemo(()=>verifiedLinks(data.links),[data.links]);
 const regional=kind==="hospital-list"||kind==="pharmacy-list"||kind==="map-directory"||kind==="health-directory";
 const filterable=entries.length>=3;
 const geos=useMemo(()=>geo.filter(g=>g==="전국"||entries.some(l=>normalize(l.label+" "+base(l)).includes(g))),[entries]);
 const types=useMemo(()=>{
    if(kind==="medicine-search")return ["전체","의약품","성분","효능"];
    if(kind==="medical-cost-detail")return ["전체","병원","약국"];
    if(kind==="telemedicine-list")return ["전체","의사","병원"];
    return ["전체"];
 },[kind]);
 const shown=entries.filter(l=>{
    const label=normalize(l.label+" "+base(l));
    if(search&&!label.includes(normalize(search)))return false;
    if(regional&&region!=="전체"&&!label.includes(region))return false;
    if(tab==="성분"&&!l.path.includes("/ingredient/"))return false;
    if(tab==="효능"&&!l.path.includes("/effect/"))return false;
    if(tab==="의약품"&&!isMedicine(l))return false;
    if(tab==="병원"&&!isPlace(l))return false;
    if(tab==="약국"&&!/약국|pharmacy/.test(label))return false;
    if(tab==="의사"&&!/의사|doctor/.test(label))return false;
    return true;
 });
 return <section className={"observed-page observed-"+kind} data-source-view={kind}>
   <header className="observed-heading">
    <h1>{data.title}</h1>
    {data.address&&<p><MapPin size={15}/>{data.address}</p>}
   </header>
   {kind==="health-calculator-bmi"?<BMICalculator/>:null}
   {types.length>1&&<div className="observed-tabs" role="tablist" aria-label="자료 유형">
     {types.map(x=><button key={x} role="tab" aria-selected={tab===x}
       className={tab===x?"current":""} onClick={()=>setTab(x)}>{x}</button>)}
    </div>}
   {filterable&&<div className="observed-search"><Search size={18}/>
    <input aria-label="원본 자료 검색" value={search} onChange={e=>setSearch(e.target.value)}
      placeholder={kind.includes("medicine")?"의약품 이름·성분 검색":kind.includes("hospital")?"병원·지역 검색":kind.includes("pharmacy")?"약국·지역 검색":"항목 검색"} />
    {search&&<button onClick={()=>setSearch("")} aria-label="검색어 지우기">×</button>}
   </div>}
   {regional&&geos.length>2&&<div className="observed-region" role="group" aria-label="지역 필터">
     {geos.map(name=><button key={name} className={region===name?"current":""}
       aria-pressed={region===name} onClick={()=>setRegion(name)}>{name}</button>)}
   </div>}
   {!!data.tables?.length&&<SourceTables tables={data.tables}/>}
   {!!data.sections?.length&&<SectionHeadings sections={data.sections}/>}
   <div className="observed-count" role="status">원본에서 확인된 연결 항목 {shown.length}개</div>
   {shown.length?<SourceRows links={shown} go={go} kind={kind}/>:
    <p className="observed-empty">{entries.length?"일치하는 항목이 없습니다.":"현재 저장된 원본 연결 항목이 없습니다."}</p>}
   {data.sourceQuality&&<div className="observed-source-foot">원본 공개 사실 데이터 · {data.sourceQuality} · 전체 원본 기능 검증 전</div>}
 </section>;
}
function BMICalculator(){
 const [height,setHeight]=useState(""),[weight,setWeight]=useState("");
 const h=Number(height),w=Number(weight);
 const valid=h>50&&h<=260&&w>=2&&w<=400;
 const bmi=valid?w/(h/100)**2:null;
 return <section className="observed-bmi" aria-label="비만도 계산기">
   <h2>비만도 계산</h2><div className="observed-bmi-inputs">
    <label>키(cm)<input value={height} type="number" min="50" max="260" aria-label="키(cm)" onChange={e=>setHeight(e.target.value)}/></label>
    <label>체중(kg)<input value={weight} type="number" min="2" max="400" aria-label="체중(kg)" onChange={e=>setWeight(e.target.value)}/></label>
   </div>
   <div className="observed-bmi-result" role="status">
    {valid?<>BMI <strong>{bmi.toFixed(1)}</strong></>:"키와 몸무게를 입력하면 BMI가 계산됩니다."}
   </div>
 </section>;
}
