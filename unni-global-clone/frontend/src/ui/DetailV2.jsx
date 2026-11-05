import React,{useEffect,useRef,useState} from "react";
import {ArrowRight,Check,ChevronDown,ChevronLeft,ChevronRight,Clock3,ExternalLink,Heart,MapPin,Maximize2,MessageCircle,Navigation,Share2,ShieldAlert,Star,X} from "lucide-react";
import {SourceLink,OfferCard,ClinicCard} from "./Components";
import "../detail-v2.css";
function usePublicCatalog(kind,id){
 const [facts,setFacts]=useState(null);
 useEffect(()=>{
  setFacts(null);
  if(!id)return;
  const controller=new AbortController();
  const base=(import.meta.env.VITE_GATEWAY_BASE||"").replace(/\/$/,"");
  fetch(base+"/catalog/"+kind+"/"+id,{credentials:"omit",signal:controller.signal})
   .then(r=>r.ok?r.json():null).then(v=>{if(!controller.signal.aborted)setFacts(v)}).catch(()=>{});
  return ()=>controller.abort();
 },[kind,id]);
 return facts;
}
function Header({children,sub}){return <div className="d2-heading"><h2>{children}</h2>{sub&&<small>{sub}</small>}</div>}
function Block({id,children}){return <section id={id} className="d2-block">{children}</section>}
function RichNode({node,go,omitImages=false}){
 if(!node)return null;
 if(Object.prototype.hasOwnProperty.call(node,"text"))return node.text;
 const tag=node.tag;
 if(tag==="img"&&omitImages)return null;
 if(!["div","section","article","p","span","br","strong","b","em","i","small","h3","h4","h5","ul","ol","li","table","tbody","thead","tr","th","td","blockquote","dl","dt","dd","a","img"].includes(tag))return null;
 const props={};
 if(tag==="img"){props.src=node.src;props.alt=node.alt||"";props.loading="lazy";if(node.width>0&&node.height>0)props.style={aspectRatio:node.width+"/"+node.height};}
 if(tag==="a"){
   props.href=node.href;props.rel="noopener noreferrer";props.target="_blank";
   if(go){props.onClick=e=>{try{const u=new URL(node.href);if(u.hostname==="unni.app"&&u.pathname.startsWith("/us/")){e.preventDefault();go(u.pathname.slice(3)+u.search);}}catch{}};}
 }
 return React.createElement(tag,props,...(node.children||[]).map((child,i)=><RichNode key={i} node={child} go={go} omitImages={omitImages}/>));
}
function richHasImage(nodes=[]){return nodes.some(node=>node?.tag==="img"||richHasImage(node?.children||[]));}
function richImageUrls(nodes=[],out=new Set()){for(const node of nodes){if(node?.tag==="img"&&node.src)out.add(node.src);richImageUrls(node?.children||[],out)}return out;}

function RenderBlocks({section,go,omitImages=false}){
  if(!section?.text&&!section?.rich?.length)return null;
  if(section.rich?.length)return <div className="d2-rich">{section.rich.map((node,i)=><RichNode key={i} node={node} go={go} omitImages={omitImages}/>)}</div>;
  return <div className="d2-rich">{section.blocks?.length?section.blocks.map((b,i)=>
    b.type==="bullet"?<ul key={i}>{b.items.map((x,j)=><li key={j}>{x}</li>)}</ul>:
    b.type==="ordered"?<ol key={i}>{b.items.map((x,j)=><li key={j}>{x}</li>)}</ol>:
    b.type==="table"?<div className="d2-scroll-table" key={i}><table><tbody>{b.rows.map((row,j)=><tr key={j}>{row.map((cell,k)=><td key={k}>{cell}</td>)}</tr>)}</tbody></table></div>:
    <p key={i}>{b.value}</p>):<p>{section.text}</p>}</div>;
}
function Gallery({media,label}){
  const photos=media?.gallery||[],[index,setIndex]=useState(0),[zoom,setZoom]=useState(false),start=useRef(0);
  useEffect(()=>setIndex(0),[photos[0]?.url]);
  useEffect(()=>{if(!zoom)return;const listener=e=>{if(e.key==="Escape")setZoom(false);if(e.key==="ArrowRight")setIndex(x=>(x+1)%photos.length);if(e.key==="ArrowLeft")setIndex(x=>(x+photos.length-1)%photos.length)};window.addEventListener("keydown",listener);return()=>window.removeEventListener("keydown",listener)},[zoom,photos.length]);
  const move=delta=>setIndex(i=>(i+delta+photos.length)%photos.length),photo=photos[index];
  return <div className="d2-gallery">{photo?<div className="d2-hero-photo" style={{aspectRatio:photo.width&&photo.height?photo.width/photo.height:2.2978}}
      onTouchStart={e=>start.current=e.changedTouches[0]?.clientX}
      onTouchEnd={e=>{const dx=e.changedTouches[0]?.clientX-start.current;if(photos.length>1&&Math.abs(dx)>40)move(dx>0?-1:1)}}>
      <img src={photo.url} alt={photo.alt||label} onError={e=>e.currentTarget.classList.add("d2-error-img")}/>
      <button className="d2-zoom-button" onClick={()=>setZoom(true)} aria-label="Enlarge original image"><Maximize2 size={19}/></button>
      {photos.length>1&&<><button className="d2-left" onClick={()=>move(-1)} aria-label="Previous"><ChevronLeft size={21}/></button><button className="d2-right" onClick={()=>move(1)} aria-label="Next"><ChevronRight size={21}/></button><span className="d2-photo-count">{index+1} / {photos.length}</span></>}
    </div>:<div className="d2-photo-missing">Original photo unavailable</div>}
    {zoom&&photo&&<div className="d2-zoom-dialog" role="dialog" aria-modal="true" onClick={()=>setZoom(false)}>
      <button className="d2-close-zoom" onClick={()=>setZoom(false)}><X size={24}/></button>
      <img src={photo.url} alt={label} onClick={e=>e.stopPropagation()}/></div>}</div>;
}
function Price({value}){
 if(!value)return null;
 return <div className="d2-price"><div>
   {value.originalPrice&&<del>{value.originalPrice}</del>}
   {value.discountPercent!==null&&value.discountPercent!==undefined&&<b className="d2-percent">{value.discountPercent}%</b>}
   <strong>{value.salePrice||"Price at source"}</strong></div>
   {value.localPrice&&<small>Converted to USD (local currency: {value.localPrice})</small>}
   {value.vatIncluded&&<span className="d2-tag">VAT included</span>}
 </div>;
}
const attrLabels={area:"Treatment area",steroid:"Steroid",origin:"Product origin",brand:"Brand",handpiece:"Handpiece",energy:"Energy",quantity:"Quantity",unit:"Unit",sessions:"Sessions"};
function Attributes({value}){
 const attrs=Object.entries(value||{});if(!attrs.length)return null;
 return <dl className="d2-attributes">{attrs.map(([key,val])=><div key={key}><dt>{attrLabels[key]||key}</dt><dd>{val}</dd></div>)}</dl>;
}
function OptionList({detail,selected,setSelected,resolveOption}){
 const opts=detail.options||[],[all,setAll]=useState(false),idx=Math.max(0,Number(selected?.index||1)-1);
 useEffect(()=>setAll(detail.initialOptionIndex>7),[detail.initialOptionIndex,opts[0]?.title]);
 useEffect(()=>{const expand=()=>setAll(true);window.addEventListener("unni:options:expand",expand);
   return()=>window.removeEventListener("unni:options:expand",expand)},[]);
 function choose(o,i){
   const verified=resolveOption?resolveOption(o):o;
   setSelected(verified);
   const url=new URL(location.href);
   url.searchParams.delete("optionId");url.searchParams.delete("optionIndex");
   if(verified.sourceOptionId)url.searchParams.set("optionId",verified.sourceOptionId);
   else url.searchParams.set("optionIndex",String(i+1));
   history.pushState(history.state,"",url.pathname+url.search);
   window.dispatchEvent(new Event("unni:optionchange"));
 }
 return <Block id="d2-options"><Header sub={opts.length+" options"}>Procedure options</Header>
  {opts.length?<><div className="d2-options">{opts.slice(0,all?opts.length:Math.max(8,idx+1)).map((o,i)=><button key={i+"-"+o.title}
     className={"d2-option "+(idx===i?"chosen":"")} onClick={()=>choose(o,i)}>
     <span className="d2-radio">{idx===i&&<Check size={14}/>}</span>
     <span className="d2-option-main"><small>Option {i+1}</small><b>{o.title}</b><Attributes value={o.attributes}/><Price value={o.prices}/></span>
  </button>)}</div>
  {opts.length>8&&<button className="d2-show-more" onClick={()=>setAll(!all)}>{all?"Show fewer":"View all "+opts.length+" options"}<ChevronDown size={17}/></button>}
  {selected&&<div className="d2-selected"><small>Selected option {idx+1}</small><strong>{selected.title}</strong><Price value={selected.prices}/></div>}</>:
  <p className="d2-unavailable">Complete source options could not be verified. No synthetic option has been added.</p>}
 </Block>;
}

function PriceObservationPanel({eventId,selectedIndex}){
 const [rows,setRows]=useState([]);
 const [show,setShow]=useState(false);
 useEffect(()=>{
  if(!eventId)return;
  const controller=new AbortController();
  const base=(import.meta.env.VITE_GATEWAY_BASE||"").replace(/\/$/,"");
  fetch(base+"/catalog/events/"+eventId+"/price-history",{signal:controller.signal,credentials:"omit"})
   .then(x=>x.ok?x.json():null)
   .then(data=>{if(!controller.signal.aborted)setRows(data?.price_changes||[])})
   .catch(()=>{});
  return()=>controller.abort();
 },[eventId]);
 const key=eventId+":"+String(selectedIndex+1);
 const sourceRows=rows.filter(x=>x.source_option_key===key);
 if(!sourceRows.length)return null;
 return <Block id="d2-price-history">
  <div className="d2-heading"><h2>Observed price history</h2><button className="d2-history-toggle" onClick={()=>setShow(v=>!v)} aria-expanded={show}>{show?"Hide":"View"} <ChevronDown size={17}/></button></div>
  <p className="d2-medical-disclaimer">Only prices seen when this public event was visited are recorded. This is not the original clinic's complete price history.</p>
  {show&&<div className="d2-history-rows">{sourceRows.map((row,i)=><div className="d2-history-item" key={i}>
   <span>{row.observed_at?new Date(row.observed_at).toLocaleString("en-US"):"Observed"}</span>
   <strong>{row.usd_sale_price==null?"—":"$"+Number(row.usd_sale_price).toFixed(2)}</strong>
   {row.discount_percent!=null&&<small>{Number(row.discount_percent)}% off</small>}
  </div>)}</div>}
 </Block>;
}

function MedicalInfo({detail,recommendedExplicit=[]}){
 const s=detail.sections,fees=detail.infoRows.filter(r=>r.value);
 return <>
 {s.about?.text&&<Block id="d2-about"><Header>About the Procedure</Header><RenderBlocks section={s.about}/>
    {detail.consultationRequired&&<div className="d2-consult-required"><MessageCircle size={17}/> Consultation Required</div>}</Block>}
 {s.info?.text&&<Block id="d2-info"><Header>Procedure Info</Header>
    {fees.length?<div className="d2-fees">{fees.map(r=><div key={r.label}><span>{r.label}</span><b>{r.value}</b></div>)}</div>:<RenderBlocks section={s.info}/>}
    <p className="d2-medical-disclaimer">Information here is for reference only. Details may vary based on your individual condition.</p></Block>}
 {(recommendedExplicit?.length>0||s.recommended?.text)&&<Block id="d2-recommended"><Header>Recommended to</Header>
    <ul className="d2-recommend-list">{(recommendedExplicit?.length?recommendedExplicit:(detail.recommended||[])).map((x,i)=><li key={i}>{x}</li>)}</ul></Block>}
 {s.steps?.text&&<Block id="d2-steps"><Header sub={detail.duration?detail.duration+" minute(s)":null}>Procedure Steps</Header>
    {detail.steps.length>1?<ol className="d2-steps">{detail.steps.map((x,i)=><li key={i}><span>{i+1}</span><p>{x.name}</p></li>)}</ol>:<RenderBlocks section={s.steps}/>}</Block>}
 {s.downtime?.text&&<Block id="d2-downtime"><Header>Expected Downtime</Header>
    {detail.downtime!==null&&<div className="d2-time"><Clock3 size={21}/>{detail.downtime} day(s)</div>}
    <RenderBlocks section={s.downtime}/></Block>}
 {s.precautions?.text&&<Block id="d2-precautions"><Header>Precautions and Side Effects</Header>
    <div className="d2-precautions"><ShieldAlert size={19}/><RenderBlocks section={s.precautions}/></div></Block>}
 </>;
}
function MapBlock({image,address,clinicName}){
 if(!image&&!address&&!clinicName)return null;
 return <div className="d2-map">{image?.url&&<img src={image.url} alt={"Map of "+(clinicName||address)} loading="lazy"/>}
   {address&&<p><MapPin size={17}/>{address}</p>}
   <a target="_blank" rel="noopener noreferrer" href={"https://www.openstreetmap.org/search?query="+encodeURIComponent(address||clinicName||"")}><Navigation size={17}/> Map & directions <ExternalLink size={14}/></a>
   {address&&<button type="button" className="d2-copy-address" onClick={()=>navigator.clipboard?.writeText(address)}>Copy address</button>}
 </div>;
}
function ReviewBox({detail,route}){
 const r=detail.stats;if(!detail.originalReviewGate&&(!r.rating||r.rating==="0.0"))return null;
 return <Block id="d2-reviews"><Header>Reviews</Header><div className="d2-review">
   {r.rating&&<div className="d2-ratings"><Star size={18} fill="currentColor"/><b>{r.rating}</b>{r.reviews&&<span>{r.reviews} reviews</span>}</div>}
   <p>{detail.originalReviewGate?"Log in to view all detailed reviews from real visitors.":"Public review information only."}</p>
   <SourceLink route={route}>Reviews at source</SourceLink></div></Block>;
}
function StuckBar({price,clinic=false,onClick}){
 return <div className="d2-sticky"><div><small>{clinic?"Clinic inquiry":"Selected option"}</small><b>{clinic?"Consultation":price||"Price at source"}</b></div>
   <button onClick={onClick}>{clinic?"Contact":"Consultation"} <ArrowRight size={18}/></button></div>;
}
function JumpBar({items}){return <nav className="d2-jumps">{items.filter(x=>x.active).map(x=><button key={x.id} onClick={()=>document.getElementById(x.id)?.scrollIntoView({behavior:"smooth",block:"start"})}>{x.name}</button>)}</nav>}
async function share(title){const url=location.href;if(navigator.share){try{await navigator.share({title,url});return}catch{}}try{await navigator.clipboard.writeText(url)}catch{}}
export function EventDetailV2({route,data,go,isSaved,onSave,onConsult}){
 const d=data.detail,[chosen,setChosen]=useState(d.options[d.initialOptionIndex]||null);
 const facts=usePublicCatalog("events",data.id);
 useEffect(()=>setChosen(d.options[d.initialOptionIndex]||null),[route.split("?")[0],d.initialOptionIndex,d.options[0]?.title]);
 // Reuse only source-observed UUIDs saved by the visit middleware. Never
 // manufacture an option UUID from a position or a display name alone.
 const verifiedUuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
 const resolveOption=o=>{
   if(!o)return null;
   if(o.sourceOptionId)return o;
   const rec=facts?.options?.find(x=>x.display_order===o.index&&x.public_name===o.title&&verifiedUuid.test(x.original_option_id||""));
   return rec?{...o,sourceOptionId:rec.original_option_id}:o;
 };
 const selected=resolveOption(chosen);
 const clinic=d.clinic||{},clinicPath=clinic.path||null;
 return <article className="d2-detail">
  <Gallery media={d.media} label={data.pageTitle}/>
  <div className="d2-top"><span className="d2-eyebrow">PROCEDURE</span><h1>{data.pageTitle}</h1>
   {d.stats.rating&&<div className="d2-ratings"><Star size={17} fill="currentColor"/><b>{d.stats.rating}</b>{d.stats.reviews&&<small>{d.stats.reviews} reviews</small>}</div>}
   {selected&&<div className="d2-featured d2-featured-public">
      <div className="d2-featured-head"><span>Option {selected.index||1}</span>
       <button type="button" onClick={()=>{window.dispatchEvent(new Event("unni:options:expand"));document.getElementById("d2-options")?.scrollIntoView({behavior:"smooth",block:"start"})}}>View all</button>
      </div>
      <b>{selected.title}</b>
      {selected.summary&&<small className="d2-option-summary">{selected.summary}</small>}
      <Price value={selected.prices}/>
   </div>}
   {(clinic.name||clinic.station)&&<div className="d2-clinic-summary">
      <div>{clinic.name&&<strong>{clinic.name}</strong>}{clinic.station&&<small><MapPin size={14}/>{clinic.station}</small>}{clinic.hasCCTV&&<span className="d2-tag">CCTV</span>}</div>
      {clinicPath&&<button onClick={()=>go(clinicPath)}><ChevronRight size={21}/></button>}
   </div>}
   <div className="d2-actionbar"><button onClick={onSave}><Heart size={18} fill={isSaved?"#fa4374":"none"}/>{isSaved?"Saved":"Save"}</button>
     <button onClick={()=>share(data.pageTitle)}><Share2 size={18}/> Share</button><SourceLink route={route}>Original</SourceLink></div>
  </div>
  <JumpBar items={[{id:"d2-reviews",name:"Reviews",active:d.originalReviewGate},{id:"d2-about",name:"About",active:!!d.sections.about?.text},
   {id:"d2-info",name:"Info",active:!!d.sections.info?.text},{id:"d2-options",name:"Options",active:true},
   {id:"d2-details",name:"Details",active:d.media.detail.length>0},{id:"d2-clinic",name:"Clinic",active:!!clinic.name}]}/>
  <ReviewBox detail={d} route={route}/>
  <MedicalInfo detail={d} recommendedExplicit={data.recommendedExplicit}/>
  <OptionList detail={d} selected={selected} setSelected={setChosen} resolveOption={resolveOption}/>
  <PriceObservationPanel eventId={data.id} selectedIndex={Math.max(0,Number(selected?.index||1)-1)}/>
  {(d.sections.details?.rich?.length>0||d.media.detail.length>0)&&<Block id="d2-details"><Header>Details</Header>
    <div className="d2-long-images">
      {d.sections.details?.rich?.length>0&&<RenderBlocks section={d.sections.details} go={go}/>}
      {d.media.detail.filter(img=>!richImageUrls(d.sections.details?.rich||[]).has(img.url)).map((img,i)=>
        <img key={img.url} src={img.url} loading="lazy" alt={img.alt||"Detailed procedure image "+(i+1)}
          onError={e=>e.currentTarget.classList.add("d2-error-img")}/>)}
    </div></Block>}
  {(clinic.name||data.clinicAddress)&&<Block id="d2-clinic"><Header>Clinic</Header>
    <div className="d2-clinic-name"><b>{clinic.name}</b>{clinicPath&&<button onClick={()=>go(clinicPath)}>Clinic details <ChevronRight size={18}/></button>}</div>
    <MapBlock image={d.media.map} address={data.clinicAddress} clinicName={clinic.name}/></Block>}
  {(data.events||[]).length>0&&<Block id="d2-popular"><Header>Popular Procedures</Header><div className="d2-grid">{data.events.slice(0,12).map(x=><OfferCard key={x.sourceHref} item={x} go={go}/>)}</div></Block>}
  <StuckBar price={selected?.prices?.salePrice} onClick={()=>onConsult?.({eventId:data.id,option:selected,clinic})}/>
 </article>;
}
export function HospitalDetailV2({route,data,go,isSaved,onSave,onConsult}){
 const d=data.detail,h=d.hospital||{};
 const facts=usePublicCatalog("hospitals",data.id);
 const reviews=d.stats.reviews||facts?.public_review_count||facts?.attributes?.review_count||"";
 const score=d.stats.rating||facts?.public_rating||"";
 // Reconcile physician cards using actual IDs and publicly observed names
 // already stored by the visit middleware; never use an outer clinic title.
 const doctorFacts=new Map((facts?.doctors||[]).map(x=>[String(x.original_doctor_id),x]));
 const fromPage=(data.doctors||[]).map(x=>{
   const id=String(x.id||x.path?.match(/\/doctors\/(\d+)/)?.[1]||"");
   const fact=doctorFacts.get(id);
   return fact?{...x,id,type:"doctor",path:"/doctors/"+id,sourceHref:"/us/doctors/"+id,
      title:fact.display_name||x.title,summary:"Public clinician profile"}:x;
 });
 const found=new Set(fromPage.map(x=>String(x.id)));
 // Once the public catalog resolves, the persisted source doctor ID/name is
 // authoritative. Drop hospital-wrapper cards that only masquerade as doctors.
 const candidates=facts?.doctors?.length
   ? facts.doctors.map(x=>{
       const id=String(x.original_doctor_id);
       const original=fromPage.find(a=>String(a.id)===id);
       return {...(original||{}),id,type:"doctor",path:"/doctors/"+id,
         sourceHref:"/us/doctors/"+id,title:x.display_name||original?.title||"Doctor",
         summary:"Public clinician profile",rating:original?.rating||"",reviewCount:original?.reviewCount||""};
     })
   : fromPage;
 // The public HTML may expose a wrapper clinic link and the actual doctor
 // link separately. Show only source-identified clinicians, never a clinic
 // masquerading as the doctor.
 const proper=candidates.filter(x=>/\bDr\.|\bDoctor\b/i.test(x.title)||!/(?:Clinic|Hospital)\b/i.test(x.title));
 const sourceDoctors=proper.slice(0,h.doctorCount||undefined);
 return <article className="d2-detail d2-clinic-detail"><Gallery media={d.media} label={data.pageTitle}/>
   <div className="d2-top"><span className="d2-eyebrow">CLINIC</span><h1>{data.pageTitle}</h1><div className="d2-ratings"><Star size={17} fill="currentColor"/>
   <b>{score||"—"}</b>{reviews&&<small>{Number(String(reviews).replace(/,/g,"")).toLocaleString("en-US")} Reviews</small>}</div>
   <div className="d2-actionbar"><button onClick={onSave}><Heart size={18} fill={isSaved?"#fa4374":"none"}/>{isSaved?"Saved":"Save"}</button><SourceLink route={route}/></div></div>
   <nav className="d2-clinic-tabs" aria-label="Clinic sections">
    {[["Clinic Info","d2-highlights"],["Procedures","d2-clinic-events"],["Reviews","d2-reviews"]].map(([label,id])=>
      <button key={id} onClick={()=>document.getElementById(id)?.scrollIntoView({behavior:"smooth",block:"start"})}>{label}</button>)}
   </nav>
   {h.highlightNames?.length>0&&<Block id="d2-highlights"><Header sub={h.highlightNames.length+" highlights"}>Clinic Highlights</Header>
     <p className="d2-medical-disclaimer">The presence of camera-monitored operating rooms is based on clinic-provided information. The badge does not independently confirm installation or compliance.</p>
     <div className="d2-highlights">{h.highlightNames.map((x,i)=><div key={i}>
        {d.media.badges?.[i]?.url?<img className="d2-highlight-badge" src={d.media.badges[i].url} alt="" loading="lazy"/>:<span>{i+1}</span>}{x}
      </div>)}</div></Block>}
   {h.about?.text&&<Block id="d2-about"><Header>About the Clinic</Header><RenderBlocks section={h.about}/></Block>}
   {h.specialties?.length>0&&<Block id="d2-specialties"><Header>Specialties</Header><div className="d2-specialties">{h.specialties.map(x=><span key={x}>{x}</span>)}</div></Block>}
   {sourceDoctors.length>0&&<Block id="d2-doctors"><Header sub={h.doctorCount?h.doctorCount+" doctors":null}>All Doctors</Header>
     {sourceDoctors.map(x=><ClinicCard key={x.sourceHref} item={x} go={go}/>)}</Block>}
   {(h.hours?.length>0||h.closed)&&<Block id="d2-hours"><Header>Clinic Hours</Header>
     {h.hours?.length>0&&<div className="d2-scroll-table"><table><tbody>{h.hours.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table></div>}
     {h.closed&&<p className="d2-medical-disclaimer">{h.closed}</p>}</Block>}
   {(h.address||d.media.map)&&<Block id="d2-address"><Header>Address</Header>
     <MapBlock image={d.media.map} address={h.address} clinicName={data.pageTitle}/></Block>}
   {data.events?.length>0&&<Block id="d2-clinic-events"><Header sub={h.procedureCount?h.procedureCount+" procedures":null}>Procedures</Header>
     <div className="d2-grid">{data.events.map(x=><OfferCard item={x} go={go} key={x.sourceHref}/>)}</div></Block>}
   <ReviewBox detail={d} route={route}/>
   <StuckBar clinic onClick={()=>onConsult?.({clinic:{id:data.id,name:data.pageTitle}})}/>
 </article>;
}
export function DoctorDetailV2({route,data,go}){
 const d=data.detail;
 const facts=usePublicCatalog("doctors",data.id);
 const reviews=d.stats.reviews||facts?.public_attributes?.reviews||"";
 const reviewsText=reviews?Number(String(reviews).replace(/,/g,"")).toLocaleString("en-US"):"";
 const clinicId=facts?.original_hospital_id||data.hospitals?.[0]?.id||null;
 const clinicPath=clinicId?"/hospitals/"+clinicId:(data.hospitals?.[0]?.path||"/hospitals");
 const clinicName=data.hospitals?.find(x=>String(x.id)===String(clinicId))?.title||
   data.hospitals?.[0]?.title||"Clinic";
 const portrait=d.media.all?.find(x=>String(x.alt||"").toLowerCase().includes(data.pageTitle.split(" ")[0].toLowerCase()))||
   d.media.hero;
 return <article className="d2-detail d2-doctor-detail">
  <nav className="d2-doctor-breadcrumb" aria-label="Doctor breadcrumb">
   <button onClick={()=>go("/hospitals")}>Clinic</button><ChevronRight size={14}/>
   <button onClick={()=>go(clinicPath)}>{clinicName}</button><ChevronRight size={14}/>
   <span>About this Doctor</span>
  </nav>
  <section className="d2-doctor-identity">
   <div className="d2-doctor-portrait">{portrait?.url?<img src={portrait.url} alt={data.pageTitle} loading="eager"/>:null}</div>
   <div className="d2-doctor-id-content"><h1>{data.pageTitle}</h1>
    <button onClick={()=>go(clinicPath)}>{clinicName}</button>
    {reviewsText&&<div className="d2-doctor-count">Reviews <strong>{reviewsText}</strong></div>}
    {data.doctorSpecialties?.length>0&&<div className="d2-doctor-categories">{data.doctorSpecialties.join(", ")}</div>}
   </div>
  </section>
  <Block id="d2-doctor-reviews">
   <Header>Reviews {reviewsText}</Header>
   <div className="d2-doctor-review-notice">
     <img className="d2-source-review-illustration"
       src="https://unni.app/images/review-login/us.webp"
       alt="Original UNNI review access illustration" loading="lazy"/>
     <p>Log in to view all detailed reviews<br/>from real visitors</p>
     <a className="d2-source-review-login" href={"https://unni.app/us/doctors/"+encodeURIComponent(data.id)}
       target="_blank" rel="noopener noreferrer" title="Sign in on the official UNNI website">
       Sign in in 3 seconds
     </a>
   </div>
  </Block>
  {data.sections.filter(x=>/experience|background|special/i.test(x.title)).map((s,i)=>
   <Block key={i}><Header>{s.title}</Header><p className="d2-para">{s.description}</p></Block>)}
  {data.hospitals?.length>0&&<Block><Header>Works at</Header>{data.hospitals.map(x=><ClinicCard item={x} go={go} key={x.sourceHref}/>)}</Block>}
  <Block><SourceLink route={route}>Doctor at source</SourceLink></Block>
 </article>;
}
export function ArticleDetailV2({route,data,go}){
 const d=data.detail,rich=d.articleRich||[];
 return <article className="d2-detail">
   <div className="d2-top"><span className="d2-eyebrow">BEAUTY COLUMN</span><h1>{data.pageTitle}</h1></div>
   {rich.length?<Block id="d2-article-body"><RenderBlocks section={{text:data.summary,rich}} go={go}/></Block>:
     data.sections.filter(x=>x.description).map((s,i)=><Block key={i}><Header>{s.title}</Header><p className="d2-para">{s.description}</p></Block>)}
   <Block><SourceLink route={route}>Complete original article</SourceLink></Block>
 </article>;
}
