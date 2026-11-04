import React,{useEffect,useState} from "react";
import {ArrowRight,Building2,ChevronDown,ChevronLeft,ChevronRight,ExternalLink,Heart,MapPin,MessageCircle,Search,Share2,Star,Stethoscope,X} from "lucide-react";
import {ORIGIN,CATEGORIES,CATEGORY_IDS,SORTS,shorten} from "../lib/sourceModel";
export const urlAt=route=>ORIGIN+"/us"+(route==="/ "?"":route==="/"? "":route);
export function SourceLink({route,children,className=""}){return <a href={urlAt(route)} className={className} target="_blank" rel="noopener noreferrer">{children||"View at source"} <ExternalLink size={14}/></a>;}
export function OfferCard({item,go}){return <button type="button" className="offer-card" onClick={()=>go(item.path)}>
  <div className="offer-media">{item.image?<img src={item.image} alt="" loading="lazy"/>:<div className="no-photo">Image unavailable</div>}</div>
  <div className="offer-info"><span className="offer-subtitle">{shorten(item.summary,64)}</span><strong className="offer-title">{item.title}</strong>
  <div className="offer-price-line">{item.price&&<b>{item.price}</b>}{item.rating&&<span><Star size={12} fill="currentColor"/>{item.rating}</span>}{item.reviewCount&&<small>({item.reviewCount})</small>}</div></div>
</button>;}
export function ClinicCard({item,go}){return <button type="button" className="clinic-card" onClick={()=>go(item.path)}>
  <div className="clinic-img">{item.image?<img src={item.image} alt="" loading="lazy"/>:<Building2 size={25}/>}</div>
  <div className="clinic-copy"><b>{item.title}</b><small>{shorten(item.summary,105)}</small>{item.rating&&<span className="rating-small"><Star size={12} fill="currentColor"/>{item.rating}</span>}</div>
  <ChevronRight size={18}/>
</button>;}
export function ArticleCard({item,go}){return <button type="button" className="article-card" onClick={()=>go(item.path)}>
 {item.image&&<img src={item.image} alt="" loading="lazy"/>}<div><b>{item.title}</b><small>{shorten(item.summary,120)}</small></div><ChevronRight size={17}/>
</button>;}
export function EmptyState({title="No results",detail="No public matching items are available.",route="/events"}){return <div className="empty-state"><Search size={29}/><h3>{title}</h3><p>{detail}</p><SourceLink route={route}>See original page</SourceLink></div>;}
export function ErrorState({error,refresh,route}){return <div className="empty-state error-state"><Stethoscope size={30}/><h3>Original data unavailable</h3><p>{error}</p><p>No sample products will be substituted for missing data.</p><button onClick={refresh}>Try again</button> <SourceLink route={route}/></div>;}
export function ImageGallery({images=[],title}){const[index,setIndex]=useState(0);useEffect(()=>setIndex(0),[images[0]]);
 const list=images.filter(u=>u.includes("image2.gnsister.com")).slice(0,18);
 if(!list.length)return <div className="hero-photo no-photo">No image provided</div>;
 return <div className="hero-photo"><img src={list[index]} alt={title||"Procedure"} loading="eager"/>
 {list.length>1&&<><button className="gallery-prev" onClick={()=>setIndex(v=>(v+list.length-1)%list.length)} aria-label="Previous photo"><ChevronLeft size={22}/></button><button className="gallery-next" onClick={()=>setIndex(v=>(v+1)%list.length)} aria-label="Next photo"><ChevronRight size={22}/></button><span className="gallery-position">{index+1} / {list.length}</span></>}</div>;
}
export function Options({options=[],onSelect,defaultIndex=0}){const initial=Math.max(0,Math.min(Number(defaultIndex)||0,Math.max(0,options.length-1)));const[selected,setSelected]=useState(initial),[all,setAll]=useState(false);useEffect(()=>{setSelected(initial);onSelect?.(options[initial],initial)},[initial,options[0]?.title]);const current=options[selected];
 return <section className="detail-block"><div className="block-title"><h2>Procedure options</h2><span>{options.length} options</span></div>
 {options.length?<>
 <div className="options-list">{options.slice(0,all?options.length:8).map((o,i)=><button key={i} onClick={()=>{setSelected(i);onSelect?.(o,i)}} className={selected===i?"option active":"option"}><span className="option-radio"/><span className="option-content"><b>{o.title}</b>{o.description&&<small>{shorten(o.description,190)}</small>}{o.price&&<strong>{o.price}</strong>}</span></button>)}</div>
 {options.length>8&&<button className="expand-options" onClick={()=>setAll(v=>!v)}>{all?"Show fewer":"View all "+options.length+" options"}<ChevronDown size={17}/></button>}
 {current&&<div className="selected-option"><span>Selected option</span><b>{current.title}</b>{current.price&&<strong>{current.price}</strong>}</div>}
 </>:<p className="small-muted">The original public response did not expose a complete option list.</p>}
 </section>;
}
export function ConsultDialog({open,onClose,title,route}){if(!open)return null;return <div className="modal-backdrop" onClick={onClose}><section className="modal-sheet" role="dialog" aria-modal="true" aria-label="Consultation" onClick={e=>e.stopPropagation()}>
 <div className="grab"/><div className="modal-head"><h2>Consultation</h2><button onClick={onClose} aria-label="Close"><X size={22}/></button></div><MessageCircle size={29} className="pink-icon"/>
 <h3>Ask about your treatment</h3><p className="consult-title">{title}</p><p>Consultation is not connected in this independent preview. No request has been submitted. Authentication and appointment services are available only at the original provider unless separately integrated.</p>
 <SourceLink route={route} className="modal-primary">Continue at original provider</SourceLink></section></div>;}
export function FilterSheet({open,onClose,sort,setSort,city,setCity,minPrice,setMinPrice,maxPrice,setMaxPrice,onApply}){if(!open)return null;
 const cities=["All","Seoul","Busan","Incheon","Daegu","Daejeon","Gwangju","Gyeonggi"];
 return <div className="modal-backdrop" onClick={onClose}><section className="modal-sheet filter-sheet" role="dialog" aria-label="Search filters" aria-modal="true" onClick={e=>e.stopPropagation()}>
 <div className="grab"/><div className="modal-head"><h2>Sort & filters</h2><button onClick={onClose} aria-label="Close"><X size={22}/></button></div>
 <h3>Sort by</h3><div className="sort-grid">{SORTS.map(s=><button className={sort===s.value?"on":""} onClick={()=>setSort(s.value)} key={s.value}>{s.label}</button>)}</div>
 <h3>Location (currently loaded results)</h3><div className="location-tags">{cities.map(s=><button className={city===s?"on":""} onClick={()=>setCity(s)} key={s}>{s}</button>)}</div>
 <h3>Price range (currently loaded, USD)</h3><div className="min-max"><input type="number" min="0" value={minPrice} onChange={e=>setMinPrice(e.target.value)} placeholder="Min"/><span>—</span><input type="number" min="0" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} placeholder="Max"/></div>
 <small className="filter-note">Sorting uses original website query parameters. City and price apply to currently loaded entries, not all remote results.</small>
 <div className="modal-actions"><button onClick={()=>{setSort("");setCity("All");setMinPrice("");setMaxPrice("")}}>Reset</button><button className="primary" onClick={onApply}>Apply filters</button></div>
 </section></div>;}
export function SourceFooter(){return <footer className="source-footer">Independent technical UI preview using available public information. Not affiliated with UNNI. Third-party images, brands, and copyrighted content require authorization for commercial reuse.</footer>;}
