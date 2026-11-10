import React,{useEffect,useMemo,useState} from "react";
import {ChevronDown,MapPin,Search,Hospital} from "lucide-react";
import NativeApiCatalog from "./NativeApiCatalog.jsx";
import {fetchNativeCatalog} from "./lib/originalGateway.js";

const trim=v=>typeof v==="string"?v.trim():"";
const unwrap=response=>response?.data?.data??response?.data??{};
function onlyList(root){
 if(Array.isArray(root))return root;
 for(const field of ["results","items","faqs","questions","faq_list","list","data"]){
  const value=root?.[field];
  if(Array.isArray(value))return value;
  if(value&&typeof value==="object"){
   const deeper=onlyList(value);if(deeper.length)return deeper;
  }
 }
 return [];
}
function publicFaqs(data){
 return onlyList(unwrap(data)).map((row,i)=>({
  id:row?.id??i,
  title:trim(row?.question)||trim(row?.title)||trim(row?.name)||trim(row?.subject),
  content:trim(row?.answer)||trim(row?.content)||trim(row?.description)||trim(row?.body),
  raw:row
 })).filter(x=>x.title);
}
export function NativePharmacyScreen({data,go}){
 const [query,setQuery]=useState("");
 return <div className="native-pharmacy-page">
  <header className="native-other-page-head">
   <MapPin size={22}/><h1>약국 찾기</h1>
   <p>원본 앱 6.50.0의 약국 조회 데이터를 이용합니다.</p>
  </header>
  <NativeApiCatalog resource="pharmacy-list" title="원본 앱 약국 목록" go={go}/>
  {(data?.links||[]).length>0&&<section className="native-pharmacy-public-links">
   <h2>공개 약국 정보 경로</h2>
   <label><Search size={16}/><input aria-label="약국 정보 찾기"
      placeholder="지역이나 약국명 검색" value={query}
      onChange={e=>setQuery(e.target.value)}/></label>
   {(data.links||[]).filter(x=>/약국|pharmacy/i.test(x.label+" "+x.path)&&
       (!query||(x.label+" "+x.path).includes(query))).slice(0,35).map((x,i)=>
     <a key={x.path+"_"+i} href={x.path}
      onClick={e=>{e.preventDefault();go(x.path,{label:x.label})}}>
       <Hospital size={17}/><span>{x.label}</span><ChevronDown size={17}/>
     </a>)}
  </section>}
 </div>;
}
export function NativeFaqScreen(){
 const [result,setResult]=useState(null);
 const [error,setError]=useState("");
 const [query,setQuery]=useState("");
 const [open,setOpen]=useState([]);
 useEffect(()=>{
  const abort=new AbortController();setError("");setResult(null);
  fetchNativeCatalog("app-faq",{},abort.signal).then(setResult)
   .catch(e=>{if(!abort.signal.aborted)setError(e.message)});
  return ()=>abort.abort();
 },[]);
 const faq=useMemo(()=>publicFaqs(result),[result]);
 const filtered=faq.filter(x=>!query||(x.title+" "+x.content).includes(query));
 return <div className="native-faq-page">
  <header className="native-other-page-head"><h1>자주 묻는 질문</h1>
   <p>원본 앱의 실제 FAQ 데이터입니다.</p></header>
  <div className="native-faq-search">
    <Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)}
     aria-label="FAQ 검색" placeholder="궁금한 내용을 검색해보세요"/>
  </div>
  {!result&&!error&&<p className="native-price-source-status" role="status">원본 FAQ를 불러오는 중입니다.</p>}
  {error&&<p className="native-price-source-status" role="alert">FAQ 데이터 연결 실패: {error}</p>}
  {result&&faq.length===0&&<p className="native-price-source-status">원본 응답에서 FAQ 목록 구조가 확인되지 않았습니다.</p>}
  {filtered.map((faq,i)=><section key={String(faq.id)+"_"+i} className="native-faq-item">
    <button type="button" aria-expanded={open.includes(i)} onClick={()=>
       setOpen(cur=>cur.includes(i)?cur.filter(x=>x!==i):[...cur,i])}>
     <strong>{faq.title}</strong><ChevronDown size={19}/>
    </button>
    {open.includes(i)&&<div className="native-faq-answer">
     {faq.content||"원본 응답에 별도 답변 본문이 없습니다."}</div>}
  </section>)}
  {result&&faq.length>0&&filtered.length===0&&<p role="status" className="native-price-source-status">
    검색어와 일치하는 FAQ가 없습니다.</p>}
 </div>;
}
