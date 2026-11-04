import React,{useEffect,useMemo,useState} from 'react';
import {Search,ChevronLeft,MapPin,Star,Heart,Home,Stethoscope,UserRound,ExternalLink,ArrowRight,RefreshCcw} from 'lucide-react';
import {gatewayUrl,UNNI_SERVICES} from './lib/originalGateway';

const BASE='https://unni.app';
const CATEGORIES=['Lifting','Skin','Botox','Filler','Rhinoplasty','Eye','Face Contour','Breast','Body','Hair','Hair Removal','K-Med','Dental','Others'];
function absolute(href){try{const u=new URL(href,BASE);return u.hostname==='unni.app'?u.pathname+u.search:null}catch{return null}}
function imageUrl(src){try{const u=new URL(src,BASE);return u.protocol==='https:'?u.href:null}catch{return null}}
function normalize(s){return(s||'').replace(/\s+/g,' ').trim()}
function cut(s,n){return s.length>n?s.slice(0,n)+'…':s}
function pathNow(){return window.location.pathname+window.location.search}
function cards(doc,kind){
  const re=kind==='hospital'?/^\/us\/hospitals\/\d+/:/^\/us\/events\/\d+/;
  const seen=new Set(),arr=[];
  for(const a of doc.querySelectorAll('a[href]')){
    const link=absolute(a.getAttribute('href'));
    if(!link||!re.test(link)||seen.has(link))continue;
    seen.add(link);
    const parent=a.closest('article')||a;
    const title=normalize(parent.querySelector('h2,h3,h4')?.textContent)||normalize(a.querySelector('h2,h3,h4')?.textContent)||normalize(a.textContent);
    const full=normalize(parent.textContent),img=parent.querySelector('img')||a.querySelector('img');
    const src=imageUrl(img?.getAttribute('src')||img?.getAttribute('data-src')||'');
    const price=full.match(/(?:US)?\$\s?[\d,.]+/)?.[0]||'';
    const rating=full.match(/(?:^|\s)(?:[89]\.\d|10)(?:\s|$)/)?.[0]?.trim()||'';
    arr.push({id:link,route:link.replace(/^\/us/,''),title:cut(title,96),description:cut(full.replace(title,''),100),img:src,price,rating});
  }
  return arr.slice(0,120);
}
function readDoc(raw,path){
  const doc=new DOMParser().parseFromString(raw,'text/html'),main=doc.querySelector('main')||doc.body;
  const title=normalize(main.querySelector('h1')?.textContent)||normalize(doc.querySelector('title')?.textContent)||'Explore';
  const secs=[];
  for(const h of main.querySelectorAll('h2,h3')){
    const heading=normalize(h.textContent);
    if(!heading||heading.length>85)continue;
    let next=h.nextElementSibling,text='';
    for(let i=0;i<3&&next;i++,next=next.nextElementSibling){
      if(/H[1-3]/.test(next.tagName))break;
      text+=' '+normalize(next.textContent);
      if(text.length>1500)break;
    }
    secs.push({title:heading,text:cut(text.trim(),850)});
  }
  const images=Array.from(main.querySelectorAll('img')).map(el=>imageUrl(el.getAttribute('src')||el.getAttribute('data-src')||'')).filter(Boolean);
  return {title,events:cards(doc,'events'),hospitals:cards(doc,'hospital'),sections:secs.slice(0,65),images:[...new Set(images)].slice(0,30)};
}
function useRouting(){
  const[route,setRoute]=useState(pathNow());
  useEffect(()=>{const fn=()=>{setRoute(pathNow());window.scrollTo(0,0)};window.addEventListener('popstate',fn);return()=>window.removeEventListener('popstate',fn)},[]);
  function go(value){if(!value||!value.startsWith('/')||value.startsWith('//'))return;history.pushState({},'',value);setRoute(pathNow());window.scrollTo(0,0)}
  return[route,go];
}
function Card({item,go}){return <button className="item" onClick={()=>go(item.route)}>
  <div className="item-cover">{item.img?<img src={item.img} alt="" loading="lazy"/>:<span>UNNI</span>}</div>
  <div className="item-text"><strong>{item.title||'View treatment'}</strong><small>{item.description}</small>
    <div className="item-price">{item.price&&<b>{item.price}</b>}{item.rating&&<span><Star size={12} fill="currentColor"/> {item.rating}</span>}</div>
  </div></button>}

export default function App(){
  const[route,go]=useRouting(),[data,setData]=useState(null),[pending,setPending]=useState(true),[error,setError]=useState(''),[search,setSearch]=useState(''),[liked,setLiked]=useState(()=>JSON.parse(localStorage.getItem('unni_preview_saved')||'[]'));
  const p=route==='/'?'':route,source='/us'+p;
  const detail=/^\/(?:events|hospitals|doctors)\/\d+/.test(route);
  const hospital=route.startsWith('/hospitals'), listing=route.startsWith('/events')||route.startsWith('/search');
  const saved=route==='/saved';
  useEffect(()=>{
    if(saved){setPending(false);setError('');setData(null);return;}
    const controller=new AbortController();
    setPending(true);setError('');setData(null);
    fetch(gatewayUrl(UNNI_SERVICES.PUBLIC_WEB,source),{headers:{Accept:'text/html','Accept-Language':'en'},signal:controller.signal})
      .then(r=>{if(!r.ok)throw Error('Origin returned HTTP '+r.status);return r.text()})
      .then(s=>{if(!controller.signal.aborted)setData(readDoc(s,p))})
      .catch(e=>{if(!controller.signal.aborted)setError(String(e.message||e))})
      .finally(()=>{if(!controller.signal.aborted)setPending(false)});
    return()=>controller.abort();
  },[source,saved]);
  const sourceHref=BASE+source;
  const activeCategory=new URLSearchParams(route.split('?')[1]||'').get('q')||'Lifting';
  const toggle=()=>{const updated=liked.includes(route)?liked.filter(x=>x!==route):[...liked,route];setLiked(updated);localStorage.setItem('unni_preview_saved',JSON.stringify(updated))};
  const gotoCategory=c=>go('/events?q='+encodeURIComponent(c));
  const submit=e=>{e.preventDefault();go('/events?q='+encodeURIComponent(search.trim()||'Lifting'))};
  return <div className="site"><div className="phone">
    <header><div className="top">
      {route==='/'?<button className="brand" onClick={()=>go('/')}>unni<span>.</span></button>:<button className="icon-button" aria-label="Go back" onClick={()=>window.history.length>1?window.history.back():go('/')}><ChevronLeft size={23}/></button>}
      {route!=='/'&&<strong className="page-label">{detail?'Details':hospital?'Clinics':listing?'Procedures':'UNNI'}</strong>}
      <div className="space"/>
      <button className="icon-button" aria-label="Search" onClick={()=>go('/search')}><Search size={22}/></button>
      <button className="icon-button" aria-label="Saved pages" onClick={()=>go('/saved')}><Heart size={21}/></button>
    </div></header>
    {route==='/'&&<div className="hero"><small>BEAUTY IN KOREA</small><h1>Discover the<br/>beauty in you.</h1><p>Explore treatments and clinics in Korea.</p><button onClick={()=>gotoCategory('Lifting')}>Explore now <ArrowRight size={16}/></button></div>}
    {!detail&&!saved&&<><form className="searchbar" onSubmit={submit}><Search size={18}/><input aria-label="Search treatments" placeholder="Search treatments or clinics" value={search} onChange={e=>setSearch(e.target.value)}/><button>Search</button></form>
      <div className="category-strip">{CATEGORIES.map(c=><button key={c} className={listing&&c===activeCategory?'on':''} onClick={()=>gotoCategory(c)}>{c}</button>)}</div></>}
    <main>
      {pending&&<div className="message"><span className="loader"/>Loading original public data…</div>}
      {!pending&&error&&<div className="message warning"><strong>Original source unavailable</strong><p>{error}</p><p>App API request/response formats are not yet validated. No fictional products have been inserted.</p><button onClick={()=>window.location.reload()}><RefreshCcw size={14}/> Retry</button></div>}
      {!pending&&saved&&<section className="section"><h2>Saved</h2>{liked.length?liked.map(x=><button className="saved-item" key={x} onClick={()=>go(x)}>{x}</button>):<p>No saved pages.</p>}</section>}
      {!pending&&!error&&data&&(detail?<div className="detail">
        {data.images[0]&&<div className="detail-cover"><img src={data.images[1]||data.images[0]} alt="Treatment image"/></div>}
        <div className="detail-intro"><small>{hospital?'CLINIC DETAILS':'TREATMENT DETAILS'}</small><h1>{data.title}</h1><div className="buttons"><button onClick={toggle}><Heart size={16} fill={liked.includes(route)?'#ff416d':'none'}/> {liked.includes(route)?'Saved':'Save'}</button><a href={sourceHref} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Original</a></div></div>
        {data.sections.map((sec,i)=><section className="section detail-section" key={i}><h2>{sec.title}</h2>{sec.text&&<p>{sec.text}</p>}</section>)}
        {data.hospitals.length>0&&<section className="section"><h2>Related clinics</h2><div className="cards">{data.hospitals.map(x=><Card key={x.id} item={x} go={go}/>)}</div></section>}
        <div className="consult-note">Consultation and booking require the verified provider connection. <a href={sourceHref} target="_blank" rel="noreferrer">Open source <ExternalLink size={13}/></a></div>
      </div>:<section className="section">
        <div className="section-head"><div><small>{route==='/'?'EXPLORE':hospital?'CLINICS':'PROCEDURES'}</small><h2>{route==='/'?'Popular treatments':hospital?'Find clinics':'Treatments · '+activeCategory}</h2></div><button onClick={()=>go(hospital?'/hospitals':'/events')}>See all <ArrowRight size={15}/></button></div>
        {data[ hospital?'hospitals':'events'].length?<div className="cards">{data[hospital?'hospitals':'events'].map(x=><Card key={x.id} item={x} go={go}/>)}</div>:<div className="empty"><Stethoscope size={28}/><h3>No listings exposed in public page</h3><p>This page may require live app/API data. It has not been replaced with invented records.</p><a href={sourceHref} target="_blank" rel="noreferrer">Open original site</a></div>}
      </section>)}
    </main>
    <nav className="bottom" aria-label="Bottom navigation"><button className={route==='/'?'selected':''} onClick={()=>go('/')}><Home size={21}/>Home</button><button className={listing?'selected':''} onClick={()=>go('/events')}><Stethoscope size={21}/>Treatments</button><button className={hospital?'selected':''} onClick={()=>go('/hospitals')}><MapPin size={21}/>Clinics</button><button className={saved?'selected':''} onClick={()=>go('/saved')}><Heart size={21}/>Saved</button><button onClick={()=>go('/contents')}><UserRound size={21}/>More</button></nav>
    <div className="license-notice">Independent development preview • Unni trademarks, media and commercial content require permission from their owners. Not the official Unni service.</div>
  </div></div>;
}
