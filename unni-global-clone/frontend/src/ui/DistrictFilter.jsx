import React,{useState} from "react";
import {ArrowLeft,Check,MapPin,X} from "lucide-react";
/** Only confirmed original public source city and vicinity IDs are submitted. */
export function DistrictFilterScreen({route,data,go}){
 const groups=data?.districtGroups||{cities:[],regions:[],originalIdsVerified:false};
 const [city,setCity]=useState(groups.cities[0]||"Seoul");
 const [chosen,setChosen]=useState([]);
 const region=groups.regions.find(x=>x.name.replace(/\u200b/g,"")===city.replace(/\u200b/g,""))||null;
 const params=new URLSearchParams(route.split("?")[1]||"");
 const target=params.get("target")||"";
 const query=params.get("q")||params.get("category")||"";
 const close=()=>go(target==="search"?"/search?q="+encodeURIComponent(query):"/");
 function toggle(id){if(!id)return;setChosen(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id])}
 function complete(){
   const codes=chosen.length?chosen:(region?.code?[region.code]:[]);
   if(!groups.originalIdsVerified||!codes.length){close();return}
   // Verified with public site: /us/events?district=N1102 and
   // /us/events?q=Lifting&district=N1102 resolve to actual filtered data.
   const next=new URLSearchParams();
   if(query)next.set("q",query);
   next.set("district",codes.join(","));
   go("/events?"+next.toString());
 }
 return <section className="district-screen">
   <div className="district-head"><button type="button" onClick={close} aria-label="Back"><ArrowLeft size={22}/></button>
     <h1>Location</h1><button onClick={close} aria-label="Close"><X size={21}/></button></div>
   {groups.cities.length?<div className="district-grid">
     <nav aria-label="Regions" className="district-region-list">
      {groups.cities.map(name=><button key={name} type="button" className={city===name?"active":""}
        aria-selected={city===name} onClick={()=>{setCity(name);setChosen([])}}>{name}</button>)}
     </nav>
     <div className="district-areas"><h2>In {city}</h2>
       {region?.items?.map(item=><button key={item.id||item.name} type="button"
         disabled={item.isPreparing||!item.id} aria-pressed={chosen.includes(item.id)}
         className={chosen.includes(item.id)?"chosen":""} onClick={()=>toggle(item.id)}>
         <span className="district-check">{chosen.includes(item.id)&&<Check size={15}/>}</span><span>{item.name}</span>
       </button>)}
     </div>
   </div>:<p className="small-muted">The original source did not expose a readable district list.</p>}
   <div className="district-bottom"><button onClick={()=>setChosen([])}>Reset</button>
     <button className="district-complete" disabled={!groups.originalIdsVerified} onClick={complete}>
       Complete{chosen.length?" ("+chosen.length+")":""}
     </button></div>
   {!groups.originalIdsVerified&&<p className="district-preview-note"><MapPin size={14}/> Original region identifiers were not available. Filtering is disabled rather than using fabricated IDs.</p>}
 </section>;
}
