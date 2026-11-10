import React,{useMemo,useState}from "react";
import{Search,ChevronRight,MapPin,Clock3,CalendarDays,Phone,CheckCircle2}from "lucide-react";
import ReviewsSummary from "./ReviewsSummary.jsx";

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


/** Original medicine search landing: a two-column search form, quick drug cards,
    and grouped genuine original links. Full source index remains searchable. */
function MedicineLandingPage({data,go}){
 const [query,setQuery]=useState("");
 const links=useMemo(()=>verifiedLinks(data.links),[data.links]);
 const filtered=links.filter(x=>!query||normalize(x.label).includes(normalize(query)));
 const immediate=links.filter(x=>x.path.startsWith("/medicine/")&&!/\/(?:effect|ingredient)\//.test(x.path)).slice(0,8);
 const featured=immediate.filter(x=>!query||normalize(x.label).includes(normalize(query)));
 const effects=links.filter(x=>x.path.startsWith("/medicine/effect/"));
 return <div className="original-medicine" data-source-view="medicine-search">
  <section className="original-medicine-intro">
   <h1>의약품 정보 검색</h1>
   <p>찾는 약의 효능·복용법·주의사항·부작용을 확인하세요.</p>
   <form className="original-medicine-search" onSubmit={e=>e.preventDefault()}>
    <input type="text" aria-label="원본 자료 검색" placeholder="약 이름 · 성분으로 검색"
      value={query} onChange={e=>setQuery(e.target.value)}/>
    <button type="submit">검색</button>
   </form>
   {query&&<button className="original-medicine-clear" type="button" aria-label="검색어 지우기"
      onClick={()=>setQuery("")}>검색어 지우기</button>}
  </section>
  <div className="original-medicine-divider"/>
  <section className="original-medicine-quick">
    <h2>지금 바로 볼 수 있어요</h2>
    <div className="original-medicine-cards">
      {featured.map(x=><a href={x.path} key={x.path} onClick={e=>{e.preventDefault();go(x.path)}}>{x.label}</a>)}
    </div>
  </section>
  <section className="original-medicine-categories">
   <h2>약 상세에서 볼 수 있는 정보</h2>
   <h2>효능별로 찾기</h2>
   <div className="original-medicine-effect-links">
     {effects.slice(0,12).map(x=><a key={x.path} href={x.path}
       onClick={e=>{e.preventDefault();go(x.path)}}>{x.label}</a>)}
   </div>
  </section>
  <details className="original-medicine-directory">
   <summary>의약품 원본 공개 목록 전체 보기</summary>
   <SourceRows links={filtered} go={go} kind="medicine-directory"/>
  </details>
 </div>;
}

/** Original FAQ uses a dedicated search + question list; paths come from DB facts. */
function FAQIndexPage({data,go}){
 const [query,setQuery]=useState("");
 const items=useMemo(()=>verifiedLinks(data.links).filter(x=>x.path.startsWith("/healthLab/FAQ/")&&!/[?&]page=/.test(x.path)),[data.links]);
 const filtered=items.filter(x=>normalize(x.label).includes(normalize(query)));
 const pages=data.pagination?.length?data.pagination:data.links.filter(x=>/^[1-9]\d*$/.test(x.label.trim())&&x.path.startsWith("/healthLab/FAQ"));
 return <section className="original-faq" data-source-view="health-faq">
   <h1>건강 FAQ</h1>
   <label className="original-faq-search"><Search size={19} aria-hidden="true"/>
     <input type="search" placeholder="궁금한 내용 검색하기" aria-label="건강 FAQ 검색"
       value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <div className="original-faq-list">{filtered.map(link=>{
     const end=link.label.indexOf("?");
     const label=end>=0?link.label.slice(0,end+1):link.label;
     const tags=end>=0?link.label.slice(end+1).trim():"";
     return <a href={link.path} key={link.path} className="original-faq-item"
       onClick={e=>{e.preventDefault();go(link.path)}}>
       <span className="original-faq-item-text"><strong>{label}</strong>
         {tags&&<small>{tags}</small>}</span><ChevronRight size={20} aria-hidden="true"/>
     </a>;
   })}</div>
   {!filtered.length&&<p className="observed-empty">일치하는 건강 FAQ 항목이 없습니다.</p>}
   {!!pages.length&&<nav className="original-faq-pagination" aria-label="건강 FAQ 페이지">
     {pages.map(x=><a href={x.path} key={x.path}
       aria-current={decodeURIComponent(x.path)==="/healthLab/FAQ"?"page":undefined}
       onClick={e=>{e.preventDefault();go(x.path)}}>{x.label}</a>)}
   </nav>}
 </section>;
}



const PHARMACY_WEEK=["일","월","화","수","목","금","토"];
function isPharmacyOpenNow(hours,day,minute){
 const findRange=dayText=>{
   const row=hours?.match(new RegExp("\\("+dayText+"\\)\\s*([^,]+)"))?.[1]||"";
   const m=row.match(/(\d{1,2}):(\d{2})\s*~\s*(익일\s*)?(\d{1,2}):(\d{2})/);
   if(!m)return null;
   const start=Number(m[1])*60+Number(m[2]),until=Number(m[4])*60+Number(m[5]);
   return [start,until+((m[3]||until<start)?1440:0)];
 };
 const current=findRange(day);
 if(current&&minute>=current[0]&&minute<=current[1])return true;
 const prev=PHARMACY_WEEK[(PHARMACY_WEEK.indexOf(day)+6)%7];
 const yesterday=findRange(prev);
 return !!(yesterday&&yesterday[1]>1440&&minute+1440<=yesterday[1]);
}

const KOREAN_REGIONS=new Set(["전국","강원","경기","경남","경북","대구","대전","부산","서울","세종","울산","인천","전남광주","전북","제주","충남","충북"]);
/** The original has opening-hour, weekly schedule, address and telephone cards. */
function NightPharmacyPage({data,go}){
 const [regionOpen,setRegionOpen]=useState(false);
 const [kindOpen,setKindOpen]=useState(false);
 const [selected,setSelected]=useState(null);
 const [openOnly,setOpenOnly]=useState(false);
 const today=new Intl.DateTimeFormat("ko-KR",{weekday:"short",timeZone:"Asia/Seoul"}).format(new Date()).replace("요일","");
 const regions=verifiedLinks(data.links).filter(x=>KOREAN_REGIONS.has(x.label)&&decodeURIComponent(x.path).startsWith("/pharmacy/야간약국"));
 const mapLink=data.links.find(x=>x.label==="지도 보기")?.path;
 const sundayLink=data.links.find(x=>x.label==="일요일약국")?.path;
 const pages=data.pagination?.length?data.pagination:data.links.filter(x=>/^[2-9]\d*$/.test(x.label.trim())&&/[?&]page=\d+/.test(x.path));
 const count=data.title.match(/([\d,]+)곳/)?.[1]||"";
 const allCards=data.pharmacyCards||[];
 const localClock=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date());
 const clockParts=localClock.match(/\d+/g)||["0","0"];
 const minute=Number(clockParts[0])*60+Number(clockParts[1]);
 const cards=openOnly?allCards.filter(c=>isPharmacyOpenNow(c.weekly_hours,today,minute)):allCards;
 const sourceTitle=data.title.includes("목록")?data.title:data.title.replace("전국 야간 약국 ","전국 야간 약국 목록 - ");
 return <section className="original-pharmacy" data-source-view="pharmacy-list">
   <div className="original-pharmacy-heading"><h1>{sourceTitle}</h1>
     <p>나만의닥터에서 조회한 {count}개 전국 야간 문 연 약국의 위치, 영업시간을 알려드릴게요.</p>
   </div>
   <div className="original-pharmacy-controls">
     <button className="original-pharmacy-select" type="button" aria-expanded={regionOpen}
       onClick={()=>{setRegionOpen(!regionOpen);setKindOpen(false)}}><MapPin size={20}/>전국 <ChevronRight size={18}/></button>
     {regionOpen&&<nav className="original-pharmacy-options" aria-label="지역 선택">
       {regions.map(x=><a key={x.path} href={x.path} onClick={e=>{e.preventDefault();setRegionOpen(false);go(x.path)}}>{x.label}</a>)}
     </nav>}
     <button className="original-pharmacy-select" type="button" aria-expanded={kindOpen}
       onClick={()=>{setKindOpen(!kindOpen);setRegionOpen(false)}}>야간약국 <ChevronRight size={18}/></button>
     {kindOpen&&<div className="original-pharmacy-options" role="group" aria-label="약국 종류 선택">
       {sundayLink&&<a href={sundayLink} onClick={e=>{e.preventDefault();go(sundayLink)}}>일요일약국</a>}
       <span aria-current="true">야간약국</span>
     </div>}
     <div className="original-pharmacy-actions">
       <button type="button" className="original-pharmacy-open" aria-pressed={openOnly}
         onClick={()=>setOpenOnly(!openOnly)}><CheckCircle2 size={16} aria-hidden="true"/>영업 중</button>
       {mapLink&&<a className="original-pharmacy-map" href={mapLink}
         onClick={e=>{e.preventDefault();go(mapLink)}}>지도 보기</a>}
     </div>
   </div>
   <div className="original-pharmacy-list">{cards.map((card,i)=>{
     const exp=new RegExp("\\("+today+"\\)\\s*([^,]+)");
     const day=card.weekly_hours?.match(exp)?.[1]||card.today_hours?.replace(/^\([^)]+\)\s*/,"");
     return <article className="original-pharmacy-card" key={card.name+"-"+i}>
       <h2><button type="button" aria-expanded={selected===i}
         onClick={()=>setSelected(selected===i?null:i)}>{card.name}</button></h2>
       {day&&<p className="original-pharmacy-cardline"><Clock3 size={16} className="pharmacy-time-icon" aria-hidden="true"/>({today}) {day}</p>}
       {card.weekly_hours&&<p className="original-pharmacy-cardline"><CalendarDays size={16} aria-hidden="true"/>
         <span><b>야간 영업</b> {card.weekly_hours}</span></p>}
       {card.address&&<p className="original-pharmacy-cardline"><MapPin size={16}/><span>{card.address}</span></p>}
       {card.phone&&<p className="original-pharmacy-cardline"><Phone size={16} aria-hidden="true"/>
         <a href={"tel:"+card.phone}>{card.phone}</a></p>}
       {selected===i&&<div className="original-pharmacy-expanded" role="region" aria-label={card.name+" 정보"}>
         <strong>{card.name}</strong><p>{card.address}</p>
         {card.phone&&<a href={"tel:"+card.phone}>전화 걸기</a>}
       </div>}
     </article>;
   })}</div>
   {openOnly&&!cards.length&&<p className="observed-empty">현재 영업 중인 것으로 확인되는 약국이 없습니다.</p>}
   {!!pages.length&&<nav className="observed-pages" aria-label="야간 약국 목록 페이지">
     {pages.map(x=><a href={x.path} key={x.path} onClick={e=>{e.preventDefault();go(x.path)}}>{x.label}</a>)}
   </nav>}
   <details className="md-hidden-links original-pharmacy-directory">
     <summary>지역별 약국·관련 정보 전체 보기</summary>
     <SourceRows links={data.links} go={go} kind="pharmacy-directory"/>
   </details>
 </section>;
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
 const pageLinks=data.pagination?.length?data.pagination:entries.filter(l=>/[?&]page=\d+/.test(l.path));
 const primary=entries.filter(l=>!/[?&]page=\d+/.test(l.path));
 const shown=primary.filter(l=>{
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
 if(route.split("?")[0]==="/medicine")return <MedicineLandingPage data={data} go={go}/>;
 if(route.split("?")[0]==="/healthLab/FAQ")return <FAQIndexPage data={data} go={go}/>;
 if(decodeURIComponent(route.split("?")[0])==="/pharmacy/야간약국"&&data.pharmacyCards?.length)return <NightPharmacyPage data={data} go={go}/>;
 if(route.endsWith("/reviews")&&data.reviewSummary)return <ReviewsSummary data={data} go={go}/>;
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
   {!!pageLinks.length&&<nav className="observed-pages" aria-label="원본 목록 페이지">
     {pageLinks.map(link=><a href={link.path} key={link.path}
       onClick={e=>{e.preventDefault();go(link.path)}}>{link.label}</a>)}
   </nav>}
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
