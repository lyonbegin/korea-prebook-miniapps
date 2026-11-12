import React,{useCallback,useEffect,useRef,useState} from "react";
import {ChevronDown,ChevronRight,MapPin,RefreshCw,Clock3,Hospital,Search,X} from "lucide-react";
import {fetchNativeCatalog} from "./lib/originalGateway.js";

/**
 * Native HBC96 source provenance:
 *   #48385 HospitalListScreen => FilterContextProvider(verticalKey)
 *   #48386 HospitalListScreenComponent => TopGNB(left=backButton,center=title),
 *     useInfiniteHospitalListV2({offset:0,limit:30,vertical_key,ordering,...}),
 *     FlashList(header=sorting/count,renderItem=HospitalListItem,
 *               onEndReachedThreshold:0.01,estimatedItemSize:50,
 *               refreshControl=RefreshControl)
 *   #30064 HospitalListItem => borderBottomWidth:1,
 *     borderBottomColor:"#f1f2f4",paddingVertical:20,gap:12
 *     data: name, near_subway_name, visiting_hour, badges, image, expense_display.
 *   #48415 EmptyHospitalListScreen => "조건을 만족하는 병원이 없어요."
 *   #27143 GET /patient-api/v2/hospital/sortings?vertical_key=...
 *
 * We show only original API results. A source 401 stays an explicit restricted state;
 * we never create fake hospital names, pricing, location or result counts.
 */
const originalText=value=>typeof value==="string"?value.trim():"";
const textValue=(value,otherwise="")=>
  typeof value==="string"?value.trim():
  typeof value==="number"&&Number.isFinite(value)?String(value):otherwise;
function extractSourceList(response){
  const root=response?.data?.data??response?.data??{};
  const rows=Array.isArray(root?.results)?root.results:
    Array.isArray(root?.hospitals)?root.hospitals:
    Array.isArray(root?.items)?root.items:
    Array.isArray(root)?root:[];
  return {
    rows:rows.filter(item=>item&&typeof item==="object"),
    count:Number.isInteger(root?.count)?root.count:null
  };
}
function extractSortings(response){
  const root=response?.data?.data??response?.data??{};
  const rows=Array.isArray(root?.results)?root.results:
    Array.isArray(root?.sortings)?root.sortings:
    Array.isArray(root)?root:[];
  return rows.filter(x=>x&&typeof x==="object").map(x=>({
    key:textValue(x.value??x.key??x.ordering),
    label:textValue(x.name??x.title??x.label)
  })).filter(x=>x.key&&x.label);
}
function publicHospitalFacts(items){
  // Cached original /hospital page provides 69 verified public links:
  // 35 department hubs, 17 Sunday regional links, 17 night regional links.
  // A directory link is NOT an individual hospital and must be labelled as such.
  const uniq=new Set();
  return (Array.isArray(items)?items:[])
    .filter(x=>typeof x?.path==="string"&&
      (/^\/hospital\//.test(x.path)||/^\/dept-hub\//.test(x.path))&&
      typeof x?.label==="string"&&x.label.trim()&&
      x.evidence!=="synthetic")
    .filter(x=>{const p=decodeURIComponent(x.path);if(uniq.has(p))return false;uniq.add(p);return true})
    .slice(0,100);
}
function sourceLinkType(item){
  const p=decodeURIComponent(item.path);
  if(p.startsWith("/dept-hub/"))return "department";
  if(p.includes("일요일진료"))return "sunday";
  if(p.includes("야간진료"))return "night";
  return "other";
}
function SearchHospitalPublicDirectory({links,go}){
  const [term,setTerm]=useState("");
  const [category,setCategory]=useState("all");
  const safeTerm=term.trim().toLocaleLowerCase("ko-KR");
  const matches=links.filter(item=>{
    if(category!=="all"&&sourceLinkType(item)!==category)return false;
    if(!safeTerm)return true;
    return (item.label+" "+decodeURIComponent(item.path))
      .toLocaleLowerCase("ko-KR").includes(safeTerm);
  });
  const sections=[
    {key:"all",label:"전체"},
    {key:"department",label:"진료과"},
    {key:"night",label:"야간진료"},
    {key:"sunday",label:"일요일진료"}
  ];
  return <section className="hermes-hospital-public-search"
    data-hospital-public-search={links.length} aria-label="공개 병원 검색">
    <form className="hermes-hospital-search-form"
      onSubmit={e=>e.preventDefault()} role="search">
      <Search size={20} aria-hidden="true"/>
      <input type="search" aria-label="병원 검색" value={term}
        onChange={e=>setTerm(e.target.value)}
        placeholder="진료과 또는 지역으로 병원 찾기"/>
      {term&&<button type="button" onClick={()=>setTerm("")} aria-label="검색어 지우기"><X size={18}/></button>}
    </form>
    <div className="hermes-hospital-public-categories" role="group" aria-label="병원 검색 종류">
      {sections.map(item=><button key={item.key} type="button"
        className={category===item.key?"active":""}
        aria-pressed={category===item.key}
        onClick={()=>setCategory(item.key)}>{item.label}</button>)}
    </div>
    <div className="hermes-hospital-public-summary">
      <strong>원본 공개 병원 검색 경로 {matches.length}개</strong>
      <span>원본 사이트에서 확인된 진료과·지역별 연결</span>
    </div>
    <div className="hermes-hospital-public-results">
      {matches.map(item=><a href={item.path} key={item.path}
        className="hermes-hospital-public-row"
        onClick={e=>{e.preventDefault();go(item.path,{label:item.label})}}>
        <span className="hermes-hospital-public-icon"><Hospital size={20} aria-hidden="true"/></span>
        <span className="hermes-hospital-public-name">{item.label}</span>
        <ChevronRight size={17} aria-hidden="true"/>
      </a>)}
      {!matches.length&&<p role="status" className="hermes-hospital-public-empty">
        검색어에 해당하는 원본 공개 진료과·지역 링크가 없습니다.
      </p>}
    </div>
    <p className="hermes-hospital-public-caption">
      검색 결과는 실제 병원 수가 아니라 원본 공개 페이지의 검색 경로 수입니다.
    </p>
  </section>;
}
function HospitalCard({hospital,onSelect}){
 const image=originalText(hospital.image);
 const imageUrl=image.startsWith("https://")?image:
   originalText(hospital.image?.url);
 const location=originalText(hospital.near_subway_name);
 const visiting=originalText(hospital.visiting_hour_short_info)||
   originalText(hospital.visiting_hour?.short_info);
 const badges=Array.isArray(hospital.badges)?hospital.badges.slice(0,6):[];
 const expense=hospital.expense_display;
 const price=typeof expense==="object"&&expense!==null?
   textValue(expense.amount_text??expense.amount??expense.price_text):"";
 return <button type="button" className="hermes-hospital-row" onClick={()=>onSelect(hospital)}
   aria-label={textValue(hospital.name,"병원 정보")+" 상세"}>
   <div className="hermes-hospital-row-main">
     <span className="hermes-hospital-description">
       <strong>{textValue(hospital.name,"병원")}</strong>
       {location&&<span className="hermes-hospital-subline"><MapPin size={12}/>{location}</span>}
       {visiting&&<span className="hermes-hospital-subline"><Clock3 size={12}/>{visiting}</span>}
     </span>
     {imageUrl.startsWith("https://")&&
       <img className="hermes-hospital-thumbnail" src={imageUrl} alt="" loading="lazy"/>}
   </div>
   {!!badges.length&&<div className="hermes-hospital-badges">
     {badges.map((b,i)=>{
       const label=originalText(b?.text)||originalText(b?.label)||
         (typeof b==="string"?b:"");
       return label?<span key={String(i)+label}>{label}</span>:null;
     })}
   </div>}
   {price&&<span className="hermes-hospital-expense">{price}</span>}
   <ChevronRight className="hermes-hospital-chevron" size={17} aria-hidden="true"/>
 </button>;
}
export default function NativeHospitalListScreen({verticalKey="",go,legacyLinks=[]}){
 const [sortings,setSortings]=useState([]);
 const [ordering,setOrdering]=useState("");
 const [rows,setRows]=useState([]);
 const [count,setCount]=useState(null);
 const [state,setState]=useState("loading");
 const [errorText,setErrorText]=useState("");
 const [offset,setOffset]=useState(0);
 const [refreshId,setRefreshId]=useState(0);
 const [selected,setSelected]=useState(null);
 const [showSortings,setShowSortings]=useState(false);
 const [loadingMore,setLoadingMore]=useState(false);
 const requestRef=useRef(0);
 const pullStart=useRef(null);
 const listRef=useRef(null);
 const refresh=useCallback(()=>{
   setOffset(0);setRows([]);setCount(null);setState("loading");
   setErrorText("");setRefreshId(old=>old+1);
 },[]);
 useEffect(()=>{
   const ctrl=new AbortController();
   fetchNativeCatalog("hospital-sortings",verticalKey?{vertical_key:verticalKey}:{},ctrl.signal)
     .then(data=>{if(!ctrl.signal.aborted)setSortings(extractSortings(data))})
     .catch(()=>{if(!ctrl.signal.aborted)setSortings([])});
   return ()=>ctrl.abort();
 },[verticalKey]);
 useEffect(()=>{
   const controller=new AbortController();
   const requestId=++requestRef.current;
   if(offset===0){setRows([]);setCount(null);setState("loading")}
   else setLoadingMore(true);
   const params={offset,limit:30};
   if(verticalKey)params.vertical_key=verticalKey;
   if(ordering)params.ordering=ordering;
   fetchNativeCatalog("hospital-list",params,controller.signal).then(data=>{
     if(controller.signal.aborted||requestId!==requestRef.current)return;
     const result=extractSourceList(data);
     setRows(prev=>offset===0?result.rows:[
       ...prev,...result.rows.filter(next=>
         !prev.some(item=>item.id!==undefined&&String(item.id)===String(next.id))
       )]);
     setCount(result.count);
     setState("loaded");setErrorText("");setLoadingMore(false);
   }).catch(err=>{
     if(controller.signal.aborted||requestId!==requestRef.current)return;
     const upstream=err?.details?.origin_http_status;
     const code=err?.details?.error||"";
     setState(upstream===401||err.status===401||
       /AUTHENTICATION_REQUIRED/.test(code)?"auth":"error");
     setErrorText(err.message||"병원 데이터 조회 실패");
     setLoadingMore(false);
   });
   return ()=>controller.abort();
 },[offset,verticalKey,ordering,refreshId]);
 const onScroll=useCallback(e=>{
   if(state!=="loaded"||loadingMore||rows.length===0||rows.length<30||
     (count!==null&&rows.length>=count))return;
   const el=e.currentTarget;
   if(el.scrollHeight-el.scrollTop-el.clientHeight<=Math.max(1,el.clientHeight*.01)){
     setOffset(rows.length);
   }
 },[state,loadingMore,rows,count]);
 const sourceLinks=publicHospitalFacts(legacyLinks);
 function selectOrdering(value){
   setShowSortings(false);setOrdering(value);setOffset(0);
 }
 return <section className="hermes-hospital-list-screen"
   data-native-hospital-list="hbc96" data-native-state={state}
   data-native-limit="30" aria-label="원본 Android 6.50.0 병원 목록">
   <div className="hermes-hospital-header" data-original-component="ListHeaderComponent">
     <div className="hermes-hospital-result-bar">
       <strong>{count!==null?count.toLocaleString("ko-KR")+"개 병원":"병원 목록"}</strong>
       {sortings.length>0&&<div className="hermes-hospital-sorting">
         <button type="button" aria-expanded={showSortings}
          onClick={()=>setShowSortings(v=>!v)}>
          {sortings.find(x=>x.key===ordering)?.label||sortings[0]?.label||"정렬"}
          <ChevronDown size={16} aria-hidden="true"/>
         </button>
         {showSortings&&<div className="hermes-hospital-sort-options">
           {sortings.map(x=><button key={x.key} type="button"
             aria-pressed={x.key===ordering} onClick={()=>selectOrdering(x.key)}>{x.label}</button>)}
         </div>}
       </div>}
     </div>
   </div>
   <div ref={listRef}
     className={"hermes-hospital-flash-list"+(state==="auth"||state==="error"?" hermes-hospital-flash-restricted":"")}
     data-original-component="FlashList" data-estimated-item-size="50"
     data-on-end-reached-threshold="0.01"
     onScroll={onScroll}
     onTouchStart={e=>{pullStart.current=e.touches?.[0]?.clientY??null}}
     onTouchEnd={e=>{
       const end=e.changedTouches?.[0]?.clientY;
       if(typeof end==="number"&&pullStart.current!==null&&
         end-pullStart.current>70&&listRef.current?.scrollTop<=0)refresh();
       pullStart.current=null;
     }}>
     {rows.map((hospital,i)=><HospitalCard hospital={hospital}
       key={String(hospital.id??i)+"-"+i} onSelect={setSelected}/>)}
     {state==="loading"&&<div className="hermes-hospital-loading" role="status">
       <div className="hermes-hospital-skeleton" aria-hidden="true"/>
       <div className="hermes-hospital-skeleton" aria-hidden="true"/>
       <span>원본 병원 목록 불러오는 중</span>
     </div>}
     {state==="auth"&&<div className="hermes-hospital-locked" role="status">
       <Hospital size={48} strokeWidth={1.5} aria-hidden="true"/>
       <strong>병원 목록에 로그인이 필요합니다.</strong>
       <p>원본 Android 서버가 인증되지 않은 병원 조회에 401을 반환했습니다.</p>
       <button type="button" onClick={refresh}><RefreshCw size={16}/>다시 조회</button>
     </div>}
     {state==="error"&&<div className="hermes-hospital-locked" role="alert">
       <Hospital size={48} strokeWidth={1.5} aria-hidden="true"/>
       <strong>원본 병원 목록 조회에 실패했습니다.</strong>
       <p>{errorText}</p>
       <button type="button" onClick={refresh}><RefreshCw size={16}/>다시 조회</button>
     </div>}
     {state==="loaded"&&rows.length===0&&<div className="hermes-hospital-locked" role="status">
       <Hospital size={48} strokeWidth={1.5} aria-hidden="true"/>
       <strong>조건을 만족하는 병원이 없어요.</strong>
       <button type="button" onClick={refresh}>모든 병원 다시 보기</button>
     </div>}
     {loadingMore&&<div role="status" className="hermes-hospital-loading-more">추가 병원 목록을 불러오고 있습니다.</div>}
   </div>
   {sourceLinks.length>0&&
     <SearchHospitalPublicDirectory links={sourceLinks} go={go}/>}
   {!sourceLinks.length&&state==="auth"&&
     <p role="status" className="hermes-hospital-public-empty">
       공개 병원 검색 데이터를 불러오고 있습니다.
     </p>}
   {selected&&<div className="native-data-overlay"
     onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}>
     <section className="native-data-dialog" role="dialog" aria-modal="true"
       aria-label="원본 병원 상세 정보">
       <div className="native-data-dialog-head">
         <h2>{textValue(selected.name,"병원 상세")}</h2>
         <button type="button" aria-label="닫기" onClick={()=>setSelected(null)}>닫기</button>
       </div>
       {originalText(selected.near_subway_name)&&<p>{selected.near_subway_name}</p>}
       {originalText(selected.visiting_hour_short_info)&&<p>{selected.visiting_hour_short_info}</p>}
       <p className="native-data-note">원본 병원 목록 API가 반환한 필드만 표시합니다.</p>
     </section>
   </div>}
 </section>;
}
