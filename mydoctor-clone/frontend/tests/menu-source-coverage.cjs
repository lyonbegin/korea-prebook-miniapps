/* Exact menu target coverage against versioned ORIGINAL HTTP 200 observations.
   "Link exists in menu" and "route UI renders" are not counted as source facts.
 */
const menu=require("../src/data/original-menu-20261109.json");
const original=require("../../backend/data/public_source_facts_20261109.json");
const verifiedMenu=require("../../backend/data/public_menu_facts_20261110.json");
const roots=menu.roots.flatMap(r=>r.groups.flatMap(g=>g.links.map(x=>({menu:r.label,label:x.label,path:x.href}))));
const normalize=x=>{try{const u=new URL(x,"https://my-doctor.io");return decodeURIComponent(u.pathname+u.search)}catch{return String(x)}};
const observed=new Map();
for(const r of [...original,...verifiedMenu]){
 if(!r.headline||!r.title||!r.original_url?.startsWith("https://my-doctor.io/"))continue;
 if(!/^(github-actions|origin_)/.test(r.source_evidence||""))continue;
 observed.set(normalize(r.path),r);
}
const unique=new Set(roots.map(x=>normalize(x.path)));
const covered=roots.filter(r=>observed.has(normalize(r.path)));
const missing=roots.filter(r=>!observed.has(normalize(r.path)));
const summary={menu_items:roots.length,menu_unique_paths:unique.size,verified_origin_http200:covered.length,
 unverified_destinations:missing.length,record_count:original.length+verifiedMenu.length,
 missing_by_menu:Object.fromEntries([...new Set(missing.map(r=>r.menu))].map(menu=>[menu,missing.filter(r=>r.menu===menu).map(r=>r.label)]))};
console.log("SOURCE MENU COVERAGE "+JSON.stringify(summary));
if(missing.length)console.log("SOURCE MENU PENDING "+JSON.stringify(missing));
if(roots.length!==103||covered.length<90){console.error("SOURCE MENU COVERAGE REGRESSION");process.exitCode=1;}
