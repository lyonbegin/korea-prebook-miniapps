import React,{useCallback,useEffect,useState} from "react";
import {ArrowLeft,Heart,Home,MapPin,Menu,Search,Stethoscope,UserRound,X,ChevronRight} from "lucide-react";
import {gatewayUrl,UNNI_SERVICES} from "./lib/originalGateway";
import {CATEGORY_IDS,createPageSource,parseSource} from "./lib/sourceModel";
import {SourceFooter,ErrorState,EmptyState} from "./ui/Components";
import {InquiryPanel,InquiriesScreen} from "./ui/InquiryPanel";
import {DistrictFilterScreen} from "./ui/DistrictFilter";
import {HomeScreen,SearchScreen,SearchResultsScreen,ListingScreen,EventScreen,HospitalScreen,DoctorScreen,ArticleScreen,SavedScreen,AccessLimitedScreen} from "./ui/Screens";

const SAVED_KEY="unni_clone_saved_pages_v2";
function readSaved(){try{const r=JSON.parse(localStorage.getItem(SAVED_KEY)||"[]");return Array.isArray(r)?r:[]}catch{return[]}}
function fullRoute(){return location.pathname+location.search;}
function useNavigation(){
 const[route,setRoute]=useState(fullRoute);
 useEffect(()=>{const f=()=>{setRoute(fullRoute());window.scrollTo(0,0)};window.addEventListener("popstate",f);return()=>window.removeEventListener("popstate",f)},[]);
 const go=useCallback(path=>{if(typeof path!=="string"||!path.startsWith("/")||path.startsWith("//"))return;history.pushState(null,"",path);setRoute(fullRoute());scrollTo(0,0)},[]);
 return[route,go];
}
async function fetchPage(source,signal){
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(gatewayUrl(UNNI_SERVICES.PUBLIC_WEB,source),{
    method:"GET",credentials:"omit",headers:{Accept:"text/html","Accept-Language":"en"},signal
   });
   if(response.ok)return response.text();
   if(response.status<500||attempt===2)throw Error("Original web service returned "+response.status);
  }catch(error){
   if(signal.aborted||attempt===2||(/returned \d{3}/.test(String(error.message))&&!/returned 5\d{2}/.test(String(error.message))))throw error;
  }
  await new Promise((resolve,reject)=>{
   const abort=()=>{clearTimeout(timer);reject(new DOMException("Aborted","AbortError"))};
   const timer=setTimeout(()=>{signal.removeEventListener("abort",abort);resolve()},300*(attempt+1));
   signal.addEventListener("abort",abort,{once:true});
  });
 }
 throw Error("Original web service unavailable");
}
function useSource(route){
 const[state,setState]=useState({data:null,loading:true,error:"",fetchedFrom:null});
 const[version,setVersion]=useState(0);
 const refresh=useCallback(()=>setVersion(x=>x+1),[]);
 const source=createPageSource(route);
 useEffect(()=>{
  if(!source||route==="/search"||route==="/inquiries"){setState({data:null,loading:false,error:"",fetchedFrom:null});return;}
  const controller=new AbortController();
  setState({data:null,loading:true,error:"",fetchedFrom:null});
  (async()=>{
   try{
    const content=await fetchPage(source,controller.signal);
    let data=parseSource(content,route),fetched=source;
    if(!controller.signal.aborted)setState({data,loading:false,error:"",fetchedFrom:fetched});
   }catch(e){if(!controller.signal.aborted)setState({data:null,loading:false,error:String(e?.message||e),fetchedFrom:source});}
  })();
  return()=>controller.abort();
 },[source,version]);
 return {...state,refresh};
}
function IconButton({label,onClick,children}){return <button type="button" className="icon-button" aria-label={label} onClick={onClick}>{children}</button>;}
export default function App(){
 const[route,go]=useNavigation(),{data,loading,error,refresh}=useSource(route);
 const[selectionRoute,setSelectionRoute]=useState(fullRoute);
 useEffect(()=>setSelectionRoute(route),[route]);
 useEffect(()=>{const sync=()=>setSelectionRoute(fullRoute());window.addEventListener("unni:optionchange",sync);return()=>window.removeEventListener("unni:optionchange",sync)},[]);
 const[saved,setSaved]=useState(readSaved),[dialog,setDialog]=useState(false),[menu,setMenu]=useState(false),[consultSelection,setConsultSelection]=useState(null);
 const[query,setQuery]=useState(""),[menuVersion,setMenuVersion]=useState(0);
 const[promo,setPromo]=useState(()=>sessionStorage.getItem("unni_promo_hide")!=="1");
 useEffect(()=>{
   // Mobile browsers and automation emulators may report a layout viewport
   // taller than the actually visible/touchable device viewport. Measure the
   // inset and apply it consistently to body-level fixed actions and dialogs.
   const update=()=>{
     const visual=window.visualViewport;
     const screenH=window.screen?.height||window.innerHeight;
     const visibleH=Math.min(window.innerHeight,screenH,visual?.height||window.innerHeight);
     const inset=Math.max(0,Math.round(window.innerHeight-visibleH));
     document.documentElement.style.setProperty("--unni-physical-bottom",inset+"px");
     document.documentElement.style.setProperty("--unni-visible-height",visibleH+"px");
   };
   update();
   window.addEventListener("resize",update);
   window.visualViewport?.addEventListener("resize",update);
   window.visualViewport?.addEventListener("scroll",update);
   return()=>{window.removeEventListener("resize",update);
     window.visualViewport?.removeEventListener("resize",update);
     window.visualViewport?.removeEventListener("scroll",update)};
 },[]);
 const parsedQuery=new URLSearchParams(route.split("?")[1]||"");
 useEffect(()=>{setDialog(false);setMenu(false);setQuery(parsedQuery.get("q")||parsedQuery.get("category")||"")},[route]);
 const title=data?.pageTitle||"";
 const toggleSave=useCallback(()=>setSaved(previous=>{const current=fullRoute();const next=previous.includes(current)?previous.filter(x=>x!==current):[...previous,current];localStorage.setItem(SAVED_KEY,JSON.stringify(next));return next;}),[]);
 const active=route==="/"?"home":route.startsWith("/hospitals")||route.startsWith("/doctors")?"clinics":
  route.startsWith("/events")||route.startsWith("/search")?"procedures":route==="/saved"?"saved":route.startsWith("/contents")?"columns":"more";
 return <div className="app-background"><div className="app-shell">
  {promo&&<div className="source-app-banner">
    <button type="button" className="source-app-dismiss" aria-label="Dismiss app banner" onClick={()=>{sessionStorage.setItem("unni_promo_hide","1");setPromo(false)}}><X size={16}/></button>
    <strong>Sign up now and enjoy exclusive benefits right away!</strong>
    <a href="https://unni.app/us/download" target="_blank" rel="noopener noreferrer">App Download</a>
  </div>}
  <header className="app-header"><div className="header-row">
    {route==="/"
      ?<button type="button" className="source-region" onClick={()=>go("/district-filter?returnToHome=true")}><span className="source-logo-mark">◢</span>Select Region<ChevronRight size={15}/></button>
      :<><IconButton label="Back" onClick={()=>history.length>1?history.back():go("/")}><ArrowLeft size={23}/></IconButton>
       <button type="button" className="source-uni-logo" onClick={()=>go("/")}><span className="source-logo-mark">◢</span><b>unni</b></button></>}
    <div className="header-spacer"/>
    {route!=="/"&&<IconButton label="Search" onClick={()=>go("/search")}><Search size={23}/></IconButton>}
    <a className="source-original-login" href="https://unni.app/us" target="_blank" rel="noopener noreferrer" title="Opens official UNNI website for sign-in">Log in/Sign-up</a>
    <IconButton label="Menu" onClick={()=>setMenu(v=>!v)}>{menu?<X size={19}/>:<Menu size={19}/>}</IconButton>
  </div></header>
  {menu&&<aside className="dropdown-menu">{[["Home","/"],["Procedures","/events"],["Clinics","/hospitals"],["Beauty columns","/contents"],["Community","/community"],["My inquiries","/inquiries"],["Saved","/saved"]].map(([label,path])=><button key={label} onClick={()=>go(path)}>{label}<ChevronRight size={16}/></button>)}</aside>}
  <main className="app-content">
   {route==="/search"?<SearchScreen go={go} query={query} setQuery={setQuery}/>
    :route==="/saved"?<SavedScreen go={go} saved={saved}/>
    :route==="/inquiries"?<InquiriesScreen/>
    :loading?<div className="loading-screen"><div className="loading-wheel"/><strong>Loading procedures…</strong><small>Reading the original public source</small></div>
    :error?<ErrorState error={error} refresh={refresh} route={route}/>
    :data&&route==="/"?<HomeScreen data={data} go={go}/>
    :data&&route.startsWith("/district-filter")?<DistrictFilterScreen route={route} data={data} go={go}/>
    :data&&route.startsWith("/search?")?<SearchResultsScreen route={route} data={data} go={go}/>
    :data?.detailKind==="events"?<EventScreen route={route} data={data} go={go} isSaved={saved.includes(selectionRoute)} onSave={toggleSave} onConsult={payload=>{setConsultSelection(payload||{});setDialog(true)}}/>
    :data?.detailKind==="hospitals"?<HospitalScreen route={route} data={data} go={go} isSaved={saved.includes(selectionRoute)} onSave={toggleSave} onConsult={payload=>{setConsultSelection(payload||{});setDialog(true)}}/>
    :data?.detailKind==="doctors"?<DoctorScreen route={route} data={data} go={go}/>
    :data?.detailKind==="contents"?<ArticleScreen route={route} data={data}/>
    :data&&(/^(\/events|\/hospitals|\/contents)/.test(route))?<ListingScreen route={route} data={data} go={go} query={query} setQuery={setQuery}/>
    :data?<AccessLimitedScreen data={data} route={route}/>
    :<EmptyState route={route}/>}
  </main>
  {(!data?.detailKind||route==="/")&&!route.startsWith("/inquiries")&&<>  <nav className="source-global-bottom" aria-label="Original site navigation">
    {[["Home",Home,"/"],["Clinics",MapPin,"/hospitals"],["Procedures",Stethoscope,"/events"],["Community",UserRound,"/community"],["Columns",Menu,"/contents"]].map(([label,Icon,destination])=>
      <button key={label} className={(destination==="/"&&route==="/")||(destination!=="/"&&route.startsWith(destination))?"active":""} onClick={()=>go(destination)}>
        <Icon size={21}/><small>{label}</small>
      </button>)}
   </nav></>}
  <SourceFooter/>
  <InquiryPanel open={dialog} onClose={()=>setDialog(false)} selection={consultSelection} title={title} route={route}/>
 </div></div>;
}
