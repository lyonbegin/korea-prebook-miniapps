/** Parse public my-doctor.io content as originally served; no fabricated providers, prices or reviews. */
export const ORIGIN="https://my-doctor.io";
export const MAIN_LINKS=[
  {title:"비대면 진료",path:"/telemedicine/all-department"},
  {title:"병원 찾기",path:"/hospital"},
  {title:"의료비 가격 비교",path:"/medical-cost"}
];
const ALLOWED=/^\/(?:hospital|medical-cost|telemedicine|healthLab|medicine|pharmacy|dept-hub|map|qna|company|event|quiz)(?:\/|\?|$)/;
const clean=s=>String(s||"").replace(/\s+/g," ").trim();
export function localPath(href){
  try{const u=new URL(href,ORIGIN);if(u.origin!==ORIGIN)return null;
      if(u.pathname==="/")return"/";if(!ALLOWED.test(u.pathname))return null;return u.pathname+u.search;}
  catch{return null}
}
const text=node=>clean(node?.textContent);
function uniqueLinks(nodes){
  const seen=new Set(),links=[];
  for(const a of nodes){
    const path=localPath(a.getAttribute("href"));
    const label=text(a).slice(0,120);
    if(!path||!label||seen.has(path+"::"+label)||label.length>110)continue;
    seen.add(path+"::"+label);
    links.push({label,path});
  }
  return links;
}
function basicSections(root){
 const headings=[...root.querySelectorAll("h1,h2,h3")].filter(h=>text(h)&&text(h).length<150).slice(0,70);
 return headings.map((h,i)=>({level:h.tagName.toLowerCase(),heading:text(h),
   links:uniqueLinks([...((h.parentElement)||root).querySelectorAll("a[href]")]).slice(0,18)}));
}
function readTables(root){
 return [...root.querySelectorAll("table")].slice(0,12).map(table=>({
  headers:[...table.querySelectorAll("thead th")].map(text),
  rows:[...table.querySelectorAll("tbody tr")].slice(0,200).map(row=>[...row.querySelectorAll("th,td")].map(text)).filter(x=>x.length>=2)
 })).filter(t=>t.rows.length>0);
}
function priceCards(root){
 const rows=[];
 for(const a of root.querySelectorAll("a[href]")){
  const path=localPath(a.getAttribute("href"));
  if(!path||(!path.startsWith("/medical-cost")&&!path.startsWith("/hospital")))continue;
  const title=text(a).slice(0,120);
  if(!title||title.length>100)continue;
  rows.push({path,title});
 }
 const seen=new Set();
 return rows.filter(c=>{if(seen.has(c.path))return false;seen.add(c.path);return true}).slice(0,180);
}
export function parseSource(html,path){
 const doc=new DOMParser().parseFromString(html,"text/html");
 const headTitle=text(doc.querySelector("title"));
 const main=doc.querySelector("main")||doc.body;
 const title=text(main.querySelector("h1"))||headTitle;
 const description=doc.querySelector('meta[name="description"]')?.content||"";
 const links=uniqueLinks(main.querySelectorAll("a[href]")).slice(0,250);
 const categories=priceCards(main);
 const sections=basicSections(main);
 const tables=readTables(main);
 const textBody=text(main).slice(0,12000);
 const hospitalId=new URLSearchParams(path.split("?")[1]||"").get("hospital_id");
 const hours=sections.filter(s=>/진료시간|영업시간|운영시간|Clinic Hours/.test(s.heading));
 const paragraphs=[...main.querySelectorAll("p")].map(text).filter(Boolean).slice(0,70);
 return {path,title,headTitle,description,links,sections,tables,categories,
   paragraphs,hours,hospitalId,summary:textBody,
   hasSourceData:!!title&&main.querySelectorAll("h1,h2,h3,a[href],table").length>0};
}
export function routeFromLocation(){return location.pathname+location.search}

/** Adapt only observed stored factual fields into the existing React view model.
    A source-title-only cache hit is NOT full content or functional parity. */
export function parsePublicFacts(response,path){
 const f=response?.facts||{};
 const links=(f.links||[]).map(x=>({label:String(x.label||""),path:localPath(x.path||"")}))
    .filter(x=>x.label&&x.path);
 const pagination=(f.pagination||[]).map(x=>({label:String(x.label||""),path:localPath(x.path||"")}))
    .filter(x=>x.label&&x.path);
 const categories=links.filter(x=>x.path.startsWith("/medical-cost/")||x.path.startsWith("/hospital/"))
    .map(x=>({title:x.label,path:x.path}));
 const tables=(f.tables||[]).filter(t=>Array.isArray(t.rows)).map(t=>({
  headers:Array.isArray(t.headers)?t.headers:[],rows:t.rows
 }));
 const title=f.headline||f.title||"";
 return {
  path,title,headTitle:f.title||title,description:"",address:f.address||"",
  links,pagination,categories,tables,
  sections:(f.headings||[]).map(h=>({heading:h,level:"h2",links:[]})),
  hours:[],paragraphs:f.address?[f.address]:[],
  hospitalId:new URLSearchParams(path.split("?")[1]||"").get("hospital_id"),
  summary:"",reviewSummary:f.review_summary||null,pharmacyCards:Array.isArray(f.pharmacy_cards)?f.pharmacy_cards.filter(x=>x&&x.name&&x.address):[],sourceQuality:response.quality||f.quality||"unknown",
  sourceEvidence:response.source_evidence||f.source_evidence||"",
  isCompleteOriginalData:false,
  hasSourceData:!!title
 };
}
