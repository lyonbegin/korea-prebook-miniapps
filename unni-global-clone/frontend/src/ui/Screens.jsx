import React,{useEffect,useState} from "react";
import {ArrowRight,ChevronRight,ExternalLink,Heart,MapPin,MessageCircle,Search,Share2,SlidersHorizontal,Star,Stethoscope,UsersRound,X} from "lucide-react";
import {CATEGORIES,CATEGORY_IDS,buildEventRoute,SORTS,shorten} from "../lib/sourceModel";
import taxonomy from "../lib/subcategories.json";
import {OfferCard,ClinicCard,ArticleCard,EmptyState,ImageGallery,Options,SourceLink,FilterSheet} from "./Components";
import {EventDetailV2,HospitalDetailV2,DoctorDetailV2,ArticleDetailV2} from "./DetailV2";

function SectionHeading({eyebrow,title,more,onMore}){return <div className="section-heading"><div>{eyebrow&&<small>{eyebrow}</small>}<h2>{title}</h2></div>{more&&<button onClick={onMore}>{more}<ChevronRight size={17}/></button>}</div>;}
const GLYPHS=["♧","✧","◡","◍","↗","◉","◇","♡","⌁","≋","✦","✚","☼","＋"];
export function HomeScreen({data,go}){
 const sections=data?.homeSections||[];
 const events=data?.events||[];
 const body=sections.length?sections:[{title:data?.homePromo?.title||"Treatment deals",subtitle:data?.homePromo?.subtitle||"",events}];
 return <>
  <div className="hero-search source-search"><button onClick={()=>go("/search")}><Search size={20}/>Search by procedure, clinic, or concern</button></div>
  <div className="source-category-strip" aria-label="Browse source categories">{CATEGORIES.map((name,i)=><button key={name} onClick={()=>go("/search?category="+encodeURIComponent(name))}><span className="source-category-icon">{GLYPHS[i]}</span>{name}</button>)}</div>
  {body.map((section,i)=>/Popular Procedures/i.test(section.title)?
    <section className="home-categories" key={i}><SectionHeading title={section.title} more="All" onMore={()=>go("/events")}/>
      <div className="categories-grid">{CATEGORIES.map((name,k)=><button key={name} onClick={()=>go("/search?category="+encodeURIComponent(name))}><span className="category-symbol">{GLYPHS[k]}</span><span>{name}</span></button>)}</div>
    </section>:
    <section className="home-section original-home-deals" key={i}>
      <SectionHeading title={section.title} more={section.events.length?"View all":null} onMore={()=>go("/events")}/>
      {section.subtitle&&<p className="d2-medical-disclaimer">{section.subtitle}</p>}
      {section.banner&&<img className="home-editorial-banner" src={section.banner} alt="" loading="lazy"/>}
      {section.events.length>0&&<div className="offer-grid">{section.events.map(e=><OfferCard key={e.sourceHref} item={e} go={go}/>)}</div>}
    </section>)}
  {(data?.articles||[]).length>0&&<section className="home-section">
    <SectionHeading title="Unni’s Column" more="View all" onMore={()=>go("/contents")}/>
    <div className="article-list">{data.articles.map(a=><ArticleCard key={a.sourceHref} item={a} go={go}/>)}</div>
  </section>}
  {sections.length===0&&!events.length&&<EmptyState title="Original homepage offers unavailable" route="/events"/>}
 </>;
}
export function SearchScreen({go,query,setQuery}){
 function submit(e){e.preventDefault();if(query.trim())go("/search?q="+encodeURIComponent(query.trim()))}
 return <section className="search-screen">
   <form className="search-box" onSubmit={submit}><Search size={20}/><input aria-label="Search" autoFocus placeholder="Search treatments or clinics" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button type="button" onClick={()=>setQuery("")}><X size={18}/></button>}<button className="search-submit">Search</button></form>
   <SectionHeading title="Browse treatments"/><div className="search-category-grid">{CATEGORIES.map(c=><button key={c} onClick={()=>go("/search?category="+encodeURIComponent(c))}>{c}<ChevronRight size={17}/></button>)}</div>
   <div className="text-note">Search results are loaded from the public unni.app/us website through the independent FastAPI service.</div>
 </section>;
}
export function SearchResultsScreen({route,data,go}){
 const params=new URLSearchParams(route.split("?")[1]||"");
 const phrase=params.get("q")||params.get("category")||"";
 const procedures=data.events||[],clinics=data.hospitals||[];
 const viewAll="/events?q="+encodeURIComponent(phrase);
 return <div className="search-results">
  <div className="search-results-top">
   <button className="source-search-again" onClick={()=>go("/search")}><Search size={20}/>{phrase||"Search procedures or clinics"}</button>
   <button className="search-results-location" onClick={()=>go("/district-filter?target=search&q="+encodeURIComponent(phrase))}><MapPin size={18}/>Location</button>
  </div>
  <h1>Results for '{phrase}'</h1>
  <section className="search-result-group">
   <SectionHeading title="Procedures" more="View all" onMore={()=>go(viewAll)}/>
   {procedures.length?<div className="offer-grid">{procedures.slice(0,8).map(o=><OfferCard key={o.sourceHref} item={o} go={go}/>)}</div>:
    <EmptyState title="No public treatments on this result page" route={route}/>}
  </section>
  <section className="search-result-group">
   <SectionHeading title="Clinics" more="View all" onMore={()=>go("/hospitals?q="+encodeURIComponent(phrase))}/>
   {clinics.length?<div className="clinic-list">{clinics.slice(0,8).map(c=><ClinicCard key={c.sourceHref} item={c} go={go}/>)}</div>:
    <p className="small-muted">No clinic preview was returned by this public search.</p>}
  </section>
  <section className="search-result-group">
   <SectionHeading title="Reviews"/>
   <p className="small-muted">Individual visitor reviews require an original UNNI account.</p>
   <SourceLink route={route}>Reviews on original search</SourceLink>
  </section>
  <section className="search-result-group"><SectionHeading title="Community"/>
   <p className="small-muted">Public community results are shown on the original source page. Login or private messages are not copied.</p>
   <SourceLink route={route}>Community on original search</SourceLink>
  </section>
 </div>;
}
function Tabs({active,go}){return <div className="listing-tabs"><button className={active==="procedures"?"active":""} onClick={()=>go("/events")}>Procedures</button><button className={active==="clinics"?"active":""} onClick={()=>go("/hospitals")}>Clinics</button><button className={active==="articles"?"active":""} onClick={()=>go("/contents")}>Columns</button></div>;}
export function ListingScreen({route,data,go,query,setQuery}){
 const isClinic=route.startsWith("/hospitals"),isArticles=route.startsWith("/contents");
 const params=new URLSearchParams(route.split("?")[1]||""),originalSort=params.get("viewSort")||params.get("s")||"",originalQuery=params.get("q")||"";
 const [modal,setModal]=useState(false),[sort,setSort]=useState(originalSort),[city,setCity]=useState("All"),[minPrice,setMinPrice]=useState(""),[maxPrice,setMaxPrice]=useState("");
 useEffect(()=>setSort(originalSort),[originalSort]);
 const items=isClinic?data.hospitals:isArticles?data.articles:data.events;
 const numericPrice=item=>Number(String(item.price||"").replace(/[^0-9.]/g,""))||0;
 const numericReviews=item=>Number(String(item.reviewCount||"").replace(/,/g,""))||0;
 const filtered=items.filter(item=>{
   const search=(item.title+" "+item.summary).toLowerCase();
   if(city!=="All"&&!search.includes(city.toLowerCase()))return false;
   const price=numericPrice(item);
   if(minPrice!==""&&(!price||price<Number(minPrice)))return false;
   if(maxPrice!==""&&(!price||price>Number(maxPrice)))return false;
   return true;
 }).sort((a,b)=>{
   switch(sort){
     case "LOWEST_DISCOUNTED_COST":return (numericPrice(a)||Infinity)-(numericPrice(b)||Infinity);
     case "HIGHEST_DISCOUNTED_COST":return numericPrice(b)-numericPrice(a);
     case "HIGHEST_DISCOUNT_RATE":return (b.discountPercent||0)-(a.discountPercent||0);
     case "HIGHEST_RATING_COUNT":return numericReviews(b)-numericReviews(a);
     case "HIGHEST_RATING_AMOUNT":return (Number(b.rating)||0)-(Number(a.rating)||0);
     default:return 0;
   }
 });
 function apply(){
   setModal(false);
   if(sort!==originalSort){
     const next=new URLSearchParams(params);
     next.delete("s");
     if(sort)next.set("viewSort",sort);else next.delete("viewSort");
     const path=route.split("?")[0];
     go(path+(next.toString()?"?"+next.toString():""));
   }
 }
 function submit(e){e.preventDefault();go(isClinic?"/hospitals?q="+encodeURIComponent(query):buildEventRoute({query:query}));}
 const heading=isArticles?"Beauty columns":isClinic?"Find clinics":originalQuery?"'"+originalQuery+"' Procedures":"All procedures";
 return <div className="listing-page">
  <Tabs active={isArticles?"articles":isClinic?"clinics":"procedures"} go={go}/>
  {!isArticles&&<form className="listing-search" onSubmit={submit}><Search size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search procedures or clinics"/><button>Search</button></form>}
  {!isClinic&&!isArticles&&<div className="category-scroll">{CATEGORIES.map(c=><button key={c} className={originalQuery===c?"active":""} onClick={()=>go(buildEventRoute({query:c,category:c}))}>{c}</button>)}</div>}
  {!isClinic&&!isArticles&&taxonomy.subcategories[originalQuery]?.length>0&&<div className="subcategory-strip"><span>Categories</span><div>{taxonomy.subcategories[originalQuery].map(s=><button key={s.id} onClick={()=>go("/events?q="+encodeURIComponent(s.name)+"&categoryId="+s.id)}>{s.name}</button>)}</div></div>}
  <div className="listing-heading"><div><span>{isArticles?"COLUMNS":isClinic?"CLINICS":"PROCEDURES"}</span><h1>{heading}</h1><small>{data.count!==null?data.count.toLocaleString()+" on original listing":items.length+" currently loaded"}</small></div>{!isArticles&&<button onClick={()=>setModal(true)}><SlidersHorizontal size={17}/>Sort / Filter</button>}</div>
  {filtered.length?(isArticles?<div className="article-list">{filtered.map(x=><ArticleCard key={x.sourceHref} item={x} go={go}/>)}</div>:isClinic?<div className="clinic-list">{filtered.map(x=><ClinicCard key={x.sourceHref} item={x} go={go}/>)}</div>:<div className="offer-grid listing-grid">{filtered.map(x=><OfferCard key={x.sourceHref} item={x} go={go}/>)}</div>):<EmptyState title="No matching public records" route={route} detail="The source did not expose entries matching this query and filter combination."/>}
  {filtered.length>0&&<div className="listing-more"><SourceLink route={route}>Continue on original listing</SourceLink></div>}
  <FilterSheet open={modal} onClose={()=>setModal(false)} sort={sort} setSort={setSort} city={city} setCity={setCity} minPrice={minPrice} setMinPrice={setMinPrice} maxPrice={maxPrice} setMaxPrice={setMaxPrice} onApply={apply}/>
 </div>;
}
export function EventScreen(props){return <EventDetailV2 {...props}/>;}
export function HospitalScreen(props){return <HospitalDetailV2 {...props}/>;}
export function DoctorScreen(props){return <DoctorDetailV2 {...props}/>;}
export function ArticleScreen(props){return <ArticleDetailV2 {...props}/>;}
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
