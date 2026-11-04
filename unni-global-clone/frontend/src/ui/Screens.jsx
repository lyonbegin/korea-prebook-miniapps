import React,{useEffect,useState} from "react";
import {ArrowRight,ChevronRight,ExternalLink,Heart,MapPin,MessageCircle,Search,Share2,SlidersHorizontal,Star,Stethoscope,UsersRound,X} from "lucide-react";
import {CATEGORIES,CATEGORY_IDS,buildEventRoute,SORTS,shorten} from "../lib/sourceModel";
import {OfferCard,ClinicCard,ArticleCard,EmptyState,ImageGallery,Options,SourceLink,FilterSheet} from "./Components";

function SectionHeading({eyebrow,title,more,onMore}){return <div className="section-heading"><div>{eyebrow&&<small>{eyebrow}</small>}<h2>{title}</h2></div>{more&&<button onClick={onMore}>{more}<ChevronRight size={17}/></button>}</div>;}
const GLYPHS=["♧","✧","◡","◍","↗","◉","◇","♡","⌁","≋","✦","✚","☼","＋"];
export function HomeScreen({data,go}){
 const events=data?.events||[],hospitals=data?.hospitals||[];
 return <>
  <div className="hero-search"><button onClick={()=>go("/search")}><Search size={19}/>Search procedures or clinics <span>⌕</span></button></div>
  <div className="home-hero"><div className="hero-kicker">THE BEAUTY OF KOREA</div><h1>Discover the beauty<br/>in you.</h1><p>Explore trusted Korean treatment information and clinics.</p><button onClick={()=>go("/events")}>Explore procedures <ArrowRight size={17}/></button></div>
  <section className="home-categories"><SectionHeading title="Find your treatment" more="All" onMore={()=>go("/events")}/><div className="categories-grid">{CATEGORIES.map((name,i)=><button key={name} onClick={()=>go(buildEventRoute({query:name,category:name}))}><span className="category-symbol">{GLYPHS[i]}</span><span>{name}</span></button>)}</div></section>
  <section className="home-section"><SectionHeading eyebrow="POPULAR" title="Trending treatment deals" more="View all" onMore={()=>go("/events")}/>{events.length?<div className="offer-grid">{events.slice(0,16).map(e=><OfferCard key={e.sourceHref} item={e} go={go}/>)}</div>:<EmptyState title="No public deals loaded" route="/events"/>}</section>
  {hospitals.length>0&&<section className="home-section"><SectionHeading eyebrow="CLINICS" title="Recommended clinics" more="View all" onMore={()=>go("/hospitals")}/><div className="clinic-list">{hospitals.slice(0,6).map(c=><ClinicCard key={c.sourceHref} item={c} go={go}/>)}</div></section>}
  <div className="home-link-panel"><div><h3>Clinics in Korea</h3><p>Hospital profiles, medical staff, specialties and public pricing.</p></div><button onClick={()=>go("/hospitals")}>Find clinics <ArrowRight size={17}/></button></div>
  <div className="home-link-panel muted-panel"><div><h3>Beauty columns</h3><p>Learn more about skin care, aesthetic treatments and recovery.</p></div><button onClick={()=>go("/contents")}>Read articles <ArrowRight size={17}/></button></div>
 </>;
}
export function SearchScreen({go,query,setQuery}){
 function submit(e){e.preventDefault();if(query.trim())go(buildEventRoute({query:query.trim()}))}
 return <section className="search-screen">
   <form className="search-box" onSubmit={submit}><Search size={20}/><input aria-label="Search" autoFocus placeholder="Search treatments or clinics" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button type="button" onClick={()=>setQuery("")}><X size={18}/></button>}<button className="search-submit">Search</button></form>
   <SectionHeading title="Browse treatments"/><div className="search-category-grid">{CATEGORIES.map(c=><button key={c} onClick={()=>go(buildEventRoute({query:c,category:c}))}>{c}<ChevronRight size={17}/></button>)}</div>
   <div className="text-note">Search results are loaded from the public unni.app/us website through the independent FastAPI service.</div>
 </section>;
}
function Tabs({active,go}){return <div className="listing-tabs"><button className={active==="procedures"?"active":""} onClick={()=>go("/events")}>Procedures</button><button className={active==="clinics"?"active":""} onClick={()=>go("/hospitals")}>Clinics</button><button className={active==="articles"?"active":""} onClick={()=>go("/contents")}>Columns</button></div>;}
export function ListingScreen({route,data,go,query,setQuery}){
 const isClinic=route.startsWith("/hospitals"),isArticles=route.startsWith("/contents");
 const params=new URLSearchParams(route.split("?")[1]||""),originalSort=params.get("s")||"",originalQuery=params.get("q")||"";
 const [modal,setModal]=useState(false),[sort,setSort]=useState(originalSort),[city,setCity]=useState("All"),[minPrice,setMinPrice]=useState(""),[maxPrice,setMaxPrice]=useState("");
 useEffect(()=>setSort(originalSort),[originalSort]);
 const items=isClinic?data.hospitals:isArticles?data.articles:data.events;
 const filtered=items.filter(item=>{
   const search=(item.title+" "+item.summary).toLowerCase();
   if(city!=="All"&&!search.includes(city.toLowerCase()))return false;
   const price=Number((item.price||"").replace(/[^0-9.]/g,""));
   if(minPrice!==""&&(!price||price<Number(minPrice)))return false;
   if(maxPrice!==""&&(!price||price>Number(maxPrice)))return false;
   return true;
 });
 function apply(){setModal(false);if(isClinic||isArticles)return;
   const cat=CATEGORIES.find(x=>x.toLowerCase()===originalQuery.toLowerCase())||"";
   go(buildEventRoute({query:originalQuery,category:cat,sort}));
 }
 function submit(e){e.preventDefault();go(isClinic?"/hospitals?q="+encodeURIComponent(query):buildEventRoute({query:query}));}
 const heading=isArticles?"Beauty columns":isClinic?"Find clinics":originalQuery?"'"+originalQuery+"' Procedures":"All procedures";
 return <div className="listing-page">
  <Tabs active={isArticles?"articles":isClinic?"clinics":"procedures"} go={go}/>
  {!isArticles&&<form className="listing-search" onSubmit={submit}><Search size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search procedures or clinics"/><button>Search</button></form>}
  {!isClinic&&!isArticles&&<div className="category-scroll">{CATEGORIES.map(c=><button key={c} className={originalQuery===c?"active":""} onClick={()=>go(buildEventRoute({query:c,category:c}))}>{c}</button>)}</div>}
  <div className="listing-heading"><div><span>{isArticles?"COLUMNS":isClinic?"CLINICS":"PROCEDURES"}</span><h1>{heading}</h1><small>{data.count!==null?data.count.toLocaleString()+" on original listing":items.length+" currently loaded"}</small></div>{!isArticles&&<button onClick={()=>setModal(true)}><SlidersHorizontal size={17}/>Sort / Filter</button>}</div>
  {filtered.length?(isArticles?<div className="article-list">{filtered.map(x=><ArticleCard key={x.sourceHref} item={x} go={go}/>)}</div>:isClinic?<div className="clinic-list">{filtered.map(x=><ClinicCard key={x.sourceHref} item={x} go={go}/>)}</div>:<div className="offer-grid listing-grid">{filtered.map(x=><OfferCard key={x.sourceHref} item={x} go={go}/>)}</div>):<EmptyState title="No matching public records" route={route} detail="The source did not expose entries matching this query and filter combination."/>}
  {filtered.length>0&&<div className="listing-more"><SourceLink route={route}>Continue on original listing</SourceLink></div>}
  <FilterSheet open={modal} onClose={()=>setModal(false)} sort={sort} setSort={setSort} city={city} setCity={setCity} minPrice={minPrice} setMinPrice={setMinPrice} maxPrice={maxPrice} setMaxPrice={setMaxPrice} onApply={apply}/>
 </div>;
}
export function EventScreen({route,data,go,isSaved,onSave,onConsult}){
 const blocks=data.sections.filter(x=>/about the procedure|procedure info|recommended to|procedure steps|downtime|precautions|side effects|details/i.test(x.title));
 return <div className="detail-page">
  <ImageGallery images={data.images} title={data.pageTitle}/>
  <div className="detail-intro"><span className="label-eyebrow">PROCEDURE DEAL</span><h1>{data.pageTitle}</h1><div className="ratings-row">{data.rating&&<><Star size={16} fill="currentColor"/><b>{data.rating}</b></>}<small>Price and information from source</small></div>
   <div className="detail-actions"><button onClick={onSave}><Heart size={18} fill={isSaved?"#fa486e":"none"}/>{isSaved?"Saved":"Save"}</button><SourceLink route={route}/></div>
  </div><div className="section-divider"/>
  {data.hospitals.length>0&&<section className="detail-block"><SectionHeading title="Clinic"/>{data.hospitals.map(x=><ClinicCard item={x} key={x.sourceHref} go={go}/>)}</section>}
  <Options options={data.options}/><div className="section-divider"/>
  <section className="detail-block"><SectionHeading title="Reviews"/><div className="review-locked"><Star size={20} fill="currentColor"/><strong>Reviews from real visitors</strong><p>Detailed reviews require login on the original platform. This preview does not access private reviews.</p><SourceLink route={route}>Reviews at source</SourceLink></div></section>
  {blocks.map((s,i)=><section key={i} className="detail-block detail-copy"><h2>{s.title}</h2><p>{s.description}</p></section>)}
  {data.events.length>0&&<section className="detail-block"><SectionHeading title="Other procedures"/><div className="offer-grid">{data.events.slice(0,8).map(e=><OfferCard key={e.sourceHref} item={e} go={go}/>)}</div></section>}
  <div className="floating-cta"><div><small>Consult about this procedure</small><strong>{data.options[0]?.price||"Check original price"}</strong></div><button onClick={onConsult}>Consultation <ArrowRight size={18}/></button></div>
 </div>;
}
export function HospitalScreen({route,data,go,isSaved,onSave,onConsult}){
 const sections=data.sections.filter(x=>/about|clinic highlight|specialt|hours|address|location/i.test(x.title));
 return <div className="detail-page">
  <ImageGallery images={data.images} title={data.pageTitle}/>
  <div className="detail-intro"><span className="label-eyebrow">KOREAN CLINIC</span><h1>{data.pageTitle}</h1>
   <div className="ratings-row"><Star size={16} fill="currentColor"/><b>{data.rating||"—"}</b><small>{data.reviewCount?data.reviewCount+" reviews": "Clinic information"}</small></div>
   <div className="detail-actions"><button onClick={onSave}><Heart size={18} fill={isSaved?"#fa486e":"none"}/>{isSaved?"Saved":"Save"}</button><SourceLink route={route}/></div>
  </div><div className="section-divider"/>
  {sections.map((s,i)=><section className="detail-block detail-copy" key={i}><h2>{s.title}</h2><p>{s.description}</p></section>)}
  {data.doctors.length>0&&<section className="detail-block"><SectionHeading title="Doctors"/><div className="clinic-list">{data.doctors.map(d=><ClinicCard key={d.sourceHref} item={d} go={go}/>)}</div></section>}
  {data.events.length>0&&<section className="detail-block"><SectionHeading title="Clinic procedures"/><div className="offer-grid">{data.events.map(d=><OfferCard key={d.sourceHref} item={d} go={go}/>)}</div></section>}
  <section className="detail-block"><h2>Reviews</h2><p className="small-muted">Detailed individual patient reviews require access authorization on the original site.</p><SourceLink route={route}>Read clinic reviews</SourceLink></section>
  <div className="floating-cta"><div><small>Ask this clinic</small><strong>Consultation</strong></div><button onClick={onConsult}>Contact <ArrowRight size={18}/></button></div>
 </div>;
}
export function DoctorScreen({route,data,go}){
 return <div className="detail-page">
  <ImageGallery images={data.images} title={data.pageTitle}/>
  <div className="detail-intro"><span className="label-eyebrow">MEDICAL PROFESSIONAL</span><h1>{data.pageTitle}</h1><div className="ratings-row"><Star size={16} fill="currentColor"/><small>{data.reviewCount||"Public"} reviews</small></div></div>
  {data.sections.filter(s=>/experience|background|special|work/i.test(s.title)).map((s,i)=><section className="detail-block detail-copy" key={i}><h2>{s.title}</h2><p>{s.description}</p></section>)}
  {data.hospitals.length>0&&<section className="detail-block"><h2>Works at</h2>{data.hospitals.map(x=><ClinicCard item={x} go={go} key={x.sourceHref}/>)}</section>}
  <div className="detail-block"><SourceLink route={route}>View doctor at original source</SourceLink></div>
 </div>;
}
export function ArticleScreen({route,data}){
 return <div className="detail-page"><ImageGallery images={data.images} title={data.pageTitle}/>
  <div className="detail-intro"><span className="label-eyebrow">UNNI'S COLUMN</span><h1>{data.pageTitle}</h1></div>
  {data.sections.filter(x=>x.description).map((s,i)=><section className="detail-block detail-copy" key={i}><h2>{s.title}</h2><p>{s.description}</p></section>)}
  <div className="detail-block"><SourceLink route={route}>Read article at source</SourceLink></div>
 </div>;
}
export function SavedScreen({saved,go}){
 return <section className="listing-page saved-page"><div className="listing-heading"><div><span>YOUR FAVORITES</span><h1>Saved items</h1><small>Saved on this device, without a user account</small></div></div>
  {saved.length?<div className="saved-list">{saved.map(route=><button key={route} onClick={()=>go(route)}><Heart size={18} fill="#fb4773"/>{route}<ChevronRight size={17}/></button>)}</div>:<EmptyState route="/events" title="No saved pages" detail="Save a treatment or clinic using the heart icon."/>}
 </section>;
}
export function AccessLimitedScreen({route,data}){
 const community=route.startsWith("/community"),reviews=route.startsWith("/reviews");
 return <section className="listing-page"><div className="listing-heading"><div><span>{reviews?"REVIEWS":community?"COMMUNITY":"MORE"}</span><h1>{community?"Community":reviews?"Visitor reviews":data?.pageTitle||"More"}</h1></div></div>
  <div className="review-locked"><UsersRound size={30}/><strong>{reviews?"Access to individual reviews is restricted":"Original community and user features"}</strong><p>Personal accounts, private reviews and member posts are not copied or generated by this independent preview. Public pages remain accessible on the original service.</p><SourceLink route={route}>Continue at source</SourceLink></div>
 </section>;
}
