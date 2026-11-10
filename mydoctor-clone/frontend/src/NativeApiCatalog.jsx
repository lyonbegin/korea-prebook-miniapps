import React,{useEffect,useMemo,useState} from "react";
import {ChevronRight,X,Database,Search} from "lucide-react";
import {fetchNativeCatalog} from "./lib/originalGateway.js";
import {localPath} from "./lib/sourceModel.js";
import {nativeDoctorItems} from "./nativeDataAdapters.js";

/** Display actual anonymous native API fields, never fabricated products or doctors.
 * A GET 200 and a parseable JSON body are required before anything is rendered.
 * Each card opens its observed public route, or a source-field details panel
 * if no verified app-to-web detail route is known.
 */
const LABEL_KEYS=["display_name","displayName","hospital_name","hospitalName",
 "doctor_name","doctorName","product_name","productName","title","name","label",
 "menu_name","menuName","text"];
const DESCRIPTION_KEYS=["description","subtitle","subTitle","address",
 "hospital_address","hospitalAddress","specialty","department","category_name"];
const IMAGE_KEYS=["image_url","imageUrl","icon_url","iconUrl","thumbnail_url","thumbnailUrl",
 "banner_image","bannerImage","image","thumbnail","icon"];
const PRICE_KEYS=["min_price","minPrice","lowest_price","lowestPrice","price",
 "discount_price","discountPrice"];
const ROUTE_KEYS=["web_url","webUrl","url","link_url","linkUrl","href","path","link",
 "deeplink","deepLink"];
const COLLECTION_KEYS=["data","results","result","items","list","content","menus",
 "home_menus","homeMenus","banners","doctors","hospitals","products","prices",
 "pharmacies","categories","sections","rows"];
const read=(o,keys)=>keys.find(k=>o?.[k]!==undefined&&o[k]!==null&&
 (typeof o[k]==="string"||typeof o[k]==="number"));
const valueOf=(o,keys)=>{const key=read(o,keys);return key===undefined?"":String(o[key]).trim()};
function publicRoute(obj){
 for(const key of ROUTE_KEYS){
  const url=obj?.[key];
  if(typeof url!=="string")continue;
  if(url.startsWith("/")&&!url.startsWith("//")&&!url.startsWith("/patient-api/")){
   const p=localPath(url);if(p)return p;
  }
  if(/^https:\/\/my-doctor\.io\//.test(url)){
   const p=localPath(url);if(p)return p;
  }
 }
 return null;
}
function publicImage(obj){
 for(const key of IMAGE_KEYS){
  const image=obj?.[key];
  if(typeof image==="string"&&image.length<1000&&/^https:\/\//.test(image)){
   return image;
  }
 }
 return null;
}
function publicPrice(obj){
 for(const key of PRICE_KEYS){
  if(obj?.[key]!==null&&obj?.[key]!==undefined&&
      ["number","string"].includes(typeof obj[key])){
    const n=obj[key];return typeof n==="number"?n.toLocaleString("ko-KR")+"원":String(n);
  }
 }
 return "";
}
export function normalizeNativeCards(data){
 const found=[],visited=new Set();
 function walk(node,depth){
  if(depth>10||found.length>=120||!node||typeof node!=="object")return;
  if(Array.isArray(node)){
   for(const item of node.slice(0,180))walk(item,depth+1);
   return;
  }
  const label=valueOf(node,LABEL_KEYS);
  const children=COLLECTION_KEYS.filter(k=>node[k]&&typeof node[k]==="object");
  if(label&&label.length<145){
   const subtitle=valueOf(node,DESCRIPTION_KEYS);
   const path=publicRoute(node),image=publicImage(node),price=publicPrice(node);
   const fingerprint=[label,subtitle,path,price].join("::");
   if(!visited.has(fingerprint)){
    visited.add(fingerprint);
    found.push({label,subtitle,path,image,price,raw:node});
   }
  }
  for(const key of children)walk(node[key],depth+1);
  if(!children.length){
   const rest=Object.entries(node).filter(([k,v])=>!k.startsWith("_")&&
    v&&typeof v==="object").slice(0,12);
   for(const [,value] of rest)walk(value,depth+1);
  }
 }
 walk(data,0);
 return found;
}
function DetailPanel({item,onClose}){
 return <div className="native-data-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
   <section role="dialog" aria-modal="true" aria-label="원본 앱 데이터 항목" className="native-data-dialog">
    <div className="native-data-dialog-head"><h2>{item.label}</h2>
     <button type="button" onClick={onClose} aria-label="상세 닫기"><X size={22}/></button>
    </div>
    {item.image&&<img className="native-data-detail-image" src={item.image} alt=""/>}
    {item.subtitle&&<p>{item.subtitle}</p>}
    {item.price&&<strong className="native-data-price">{item.price}</strong>}
    <h3>원본 API에서 수신한 항목</h3>
    <dl className="native-data-details">{Object.entries(item.raw).flatMap(([k,v])=>{
      if(v===null||v===undefined)return [];
      if(["string","number","boolean"].includes(typeof v))return [[k,v]];
      if(["profile","hospital"].includes(k)&&v&&typeof v==="object")
       return Object.entries(v).filter(([field,value])=>
        value!==null&&value!==undefined&&["string","number","boolean"].includes(typeof value))
        .map(([field,value])=>[k+"."+field,value]);
      return [];
     }).slice(0,30).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{String(v)}</dd></div>)}</dl>
    <p className="native-data-note">상세 API 구조가 확인되기 전에는 수신된 필드만 보여줍니다.</p>
   </section>
  </div>;
}
export default function NativeApiCatalog({resource,title,go,compact=false}){
 const [response,setResponse]=useState(null);
 const [error,setError]=useState("");
 const [detail,setDetail]=useState(null);
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  setError("");setResponse(null);
  fetchNativeCatalog(resource,{},controller.signal).then(v=>{
   if(active)setResponse(v);
  }).catch(e=>{if(active&&!controller.signal.aborted)setError(e.message)});
  return ()=>{active=false;controller.abort()};
 },[resource]);
 const items=useMemo(()=>resource==="doctor-list"?
   nativeDoctorItems(response?.data):normalizeNativeCards(response?.data),[response,resource]);
 return <section className={"native-api-section"+(compact?" compact":"")}
    data-native-resource={resource} data-native-state={response?"loaded":error?"unavailable":"loading"}>
  {!!items.length&&<>
   <div className="native-api-heading"><div><Database size={17}/><h2>{title}</h2></div>
    <span>원본 앱 API · {response.cache==="HIT"?"DB":"원본"}</span></div>
   <div className="native-api-list">{items.slice(0,resource==="doctor-list"?20:(compact?8:36)).map((item,i)=>{
    const contents=<>
       {item.image&&<img src={item.image} alt="" loading="lazy" className="native-api-row-image"/>}
       <div className="native-api-row-text"><strong>{item.label}</strong>
        {item.subtitle&&<small>{item.subtitle}</small>}
        {item.price&&<b>{item.price}</b>}
        {Number.isInteger(item.review_count)&&<small>후기 {item.review_count.toLocaleString("ko-KR")}개</small>}
       </div><ChevronRight size={17}/>
      </>;
    return item.path?
      <a key={i} className="native-api-row" href={item.path}
        onClick={e=>{e.preventDefault();go(item.path,{label:item.label})}}>{contents}</a>:
      <button key={i} type="button" className="native-api-row" onClick={()=>setDetail(item)}
       aria-label={item.label+" 데이터 상세 보기"}>{contents}</button>;
   })}</div>
  </>}
  {response&&!items.length&&<p className="native-api-no-items" role="status">
   원본 API에서 JSON을 받았으나 이 화면에 연결할 목록 필드를 아직 확인하지 못했습니다.
  </p>}
  {error&&<details className="native-api-error"><summary>원본 앱 데이터 연결 확인</summary>
   <p>{error}</p><p>기존 공개 웹 데이터와 원본 앱 API의 응답은 구분하여 표시합니다.</p>
  </details>}
  {detail&&<DetailPanel item={detail} onClose={()=>setDetail(null)}/>}
 </section>;
}
