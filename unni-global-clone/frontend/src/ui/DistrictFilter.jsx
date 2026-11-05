import React,{useState} from "react";
import {ArrowLeft,Check,MapPin,X} from "lucide-react";

/**
 * Original public district names are parsed from /us/district-filter each
 * visit. This preview can filter its loaded cards by city, but does not
 * fabricate the original provider's N#### district codes.
 */
export function DistrictFilterScreen({route,data,go}){
 const groups=data?.districtGroups||{cities:[],regions:[]};
 const [city,setCity]=useState(groups.cities[0]||"Seoul");
 const [chosen,setChosen]=useState([]);
 const region=groups.regions.find(x=>x.name===city)||null;
 const params=new URLSearchParams(route.split("?")[1]||"");
 const target=params.get("target")||"";
 const query=params.get("q")||params.get("category")||"";
 const close=()=>go(target==="search"?"/search?q="+encodeURIComponent(query):"/");
 function toggle(label){
   setChosen(old=>old.includes(label)?old.filter(x=>x!==label):[...old,label]);
 }
 function complete(){
   if(target==="search"){
     const p=new URLSearchParams({q:query});
     if(chosen.length)p.set("districtName",city);
     go("/search?"+p.toString());
   }else go("/");
 }
 return <section className="district-screen">
   <div className="district-head"><button type="button" onClick={close} aria-label="Back"><ArrowLeft size={22}/></button><h1>Location</h1><button onClick={close} aria-label="Close"><X size={21}/></button></div>
   {groups.cities.length?<div className="district-grid">
      <nav aria-label="Regions" className="district-region-list">
        {groups.cities.map(name=><button key={name} className={city===name?"active":""} aria-selected={city===name} onClick={()=>{setCity(name);setChosen([])}}>{name}</button>)}
      </nav>
      <div className="district-areas">
       <h2>In {city}</h2>
       {region?.items?.map(item=><button key={item} aria-pressed={chosen.includes(item)} className={chosen.includes(item)?"chosen":""} onClick={()=>toggle(item)}>
          <span className="district-check">{chosen.includes(item)&&<Check size={15}/>}</span><span>{item}</span>
       </button>)}
      </div>
    </div>:<p className="small-muted">The public source did not return a readable district list.</p>}
   <div className="district-bottom"><button onClick={()=>setChosen([])}>Reset</button><button className="district-complete" onClick={complete}>Complete{chosen.length?" ("+chosen.length+")":""}</button></div>
   {chosen.length>0&&<p className="district-preview-note"><MapPin size={14}/> This independent preview filters currently loaded results at city level. District-level source IDs have not been verified.</p>}
 </section>;
}
