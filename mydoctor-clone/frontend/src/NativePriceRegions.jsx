import React,{useEffect,useState} from "react";
import {ChevronRight,MapPin,X} from "lucide-react";
import {fetchNativeCatalog} from "./lib/originalGateway.js";

/**
 * Source-proven 6.50.0 MyDoctor price category -> region workflow.
 * Hermes: getLowestPriceCategories() GET /lowest-price/categories?vertical_key=...
 *         getRegionLowestPricesV2() GET /lowest-price/v2/regions?category_id=...
 * Original anonymous HTTP 200 confirmed in Railway diagnostic audit.
 * No invented category identifiers, prices, addresses or provider names.
 */
const text=value=>typeof value==="string"?value.trim():"";
const amount=value=>typeof value==="number"&&Number.isFinite(value)?
 value.toLocaleString("ko-KR")+"원":typeof value==="string"&&value.trim()?value.trim():"";
const pickCategory=body=>{
 const root=body?.data?.data||body?.data||{};
 return Array.isArray(root.categories)?root.categories.filter(c=>
   c&&((typeof c.id==="number"&&Number.isFinite(c.id))||
       (typeof c.id==="string"&&/^\d+$/.test(c.id)))):[];
};
const pickRegionBody=body=>body?.data?.data||body?.data||{};
export default function NativePriceRegions({verticalKey="mounjaro"}){
 const[categories,setCategories]=useState([]);
 const[selected,setSelected]=useState(null);
 const[categoryError,setCategoryError]=useState("");
 const[regionBody,setRegionBody]=useState(null);
 const[priceError,setPriceError]=useState("");
 const[chosenRegion,setChosenRegion]=useState(null);
 useEffect(()=>{
   const c=new AbortController();
   setCategoryError("");setCategories([]);setSelected(null);
   fetchNativeCatalog("lowest-price-categories",{vertical_key:verticalKey},c.signal)
    .then(response=>{
      const rows=pickCategory(response);
      setCategories(rows);
      if(rows.length)setSelected(rows[0].id);
    }).catch(err=>{if(!c.signal.aborted)setCategoryError(err.message)});
   return ()=>c.abort();
 },[verticalKey]);
 useEffect(()=>{
   if(selected===null)return;
   const c=new AbortController();setRegionBody(null);setPriceError("");
   fetchNativeCatalog("lowest-price",{category_id:selected},c.signal).then(response=>
     setRegionBody(pickRegionBody(response))).catch(err=>{
       if(!c.signal.aborted)setPriceError(err.message);
     });
   return ()=>c.abort();
 },[selected]);
 const regions=Array.isArray(regionBody?.regions)?regionBody.regions:[];
 return <section className="native-price-regions" data-native-vertical={verticalKey}>
    <h2>원본 앱 지역별 최저가</h2>
    <p className="native-price-subtitle">나만의닥터 6.50.0 원본 API의 카테고리·지역 가격입니다.</p>
    {!!categories.length&&<>
      <div className="native-price-categories" role="group" aria-label="원본 앱 가격 카테고리">
       {categories.map((category,i)=><button type="button"
         key={String(category.id)+"-"+i}
         className={String(selected)===String(category.id)?"active":""}
         aria-pressed={String(selected)===String(category.id)}
         onClick={()=>setSelected(category.id)}>
         {text(category.name)||"카테고리 "+String(category.id)}
       </button>)}
      </div>
    </>}
    {categoryError&&<p className="native-price-source-status" role="alert">
      카테고리 API 연결 실패: {categoryError}
    </p>}
    {!!categories.length&&!regionBody&&!priceError&&
     <p className="native-price-source-status" role="status">원본 지역별 가격을 불러오고 있습니다.</p>}
    {priceError&&<p className="native-price-source-status" role="alert">
      지역 가격 API 연결 실패: {priceError}
    </p>}
    {regionBody&&<>
      {regionBody.national_lowest_price!==null&&regionBody.national_lowest_price!==undefined&&
      <div className="native-national-price"><span>전국 최저가</span>
       <strong>{amount(regionBody.national_lowest_price)}</strong></div>}
      <div className="native-region-price-list" data-real-region-count={regions.length}>
       {regions.map((region,i)=>{
         const title=text(region.display_name)||text(region.region?.name)||"지역 "+(i+1);
         const price=amount(region.lowest_price);
         return <button key={String(region.region?.id??region.region??i)+"-"+i}
          type="button" className="native-region-price-row" onClick={()=>setChosenRegion(region)}>
          <MapPin size={18}/><span>{title}</span><strong>{price||"가격 미확인"}</strong>
          <ChevronRight size={16}/>
         </button>;
       })}
      </div>
      {!regions.length&&<p className="native-price-source-status">해당 카테고리에 제공된 지역 가격이 없습니다.</p>}
    </>}
    {chosenRegion&&<div className="native-data-overlay"
       onMouseDown={e=>{if(e.target===e.currentTarget)setChosenRegion(null)}}>
      <section className="native-data-dialog" role="dialog" aria-modal="true" aria-label="원본 지역 가격 상세">
       <div className="native-data-dialog-head">
        <h2>{text(chosenRegion.display_name)||"지역 가격 상세"}</h2>
        <button type="button" aria-label="닫기" onClick={()=>setChosenRegion(null)}><X size={21}/></button>
       </div>
       <div className="native-national-price"><span>지역 최저가</span>
        <strong>{amount(chosenRegion.lowest_price)||"정보 미확인"}</strong></div>
       {chosenRegion.facility&&typeof chosenRegion.facility==="object"&&
        <dl className="native-data-details">{Object.entries(chosenRegion.facility)
          .filter(([,v])=>v!==null&&["string","number"].includes(typeof v))
          .slice(0,15).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl>}
       <p className="native-data-note">원본 API의 확인된 필드만 표시합니다.</p>
      </section>
     </div>}
  </section>;
}
