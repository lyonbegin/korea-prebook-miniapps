/**
 * Preserve original public-page semantics without guessing protected API schemas.
 * This module parses source HTML into typed, display-only facts.
 * It intentionally never stores no-store HTML, member data or source images.
 */
import {ORIGIN,mediaUrl,text} from "./sourceModel";

const MONEY=/\$[\d,]+(?:\.\d{1,2})?/g;
const WON=/₩\s*[\d,]+/g;
const NUMBER=/\d[\d,]*(?:\.\d+)?/;
const OUTLINE=new Set(["H1","H2","H3","H4"]);
const UNNI_HOSTS=new Set(["unni.app","image2.gnsister.com"]);
const SECTION_TITLES=/^(?:About the Procedure|Procedure Info|Recommended to|Procedure Steps|Expected Downtime|Precautions and Side Effects|Details|Reviews|Clinic Highlights|About the Clinic|Specialties|All Doctors|Clinic Hours|Address|Procedures|Location|Popular Procedures|Experience & Background|Works at)/i;
const SHORT_TAGS=new Set(["P","DIV","SPAN","STRONG","B","EM","I","DEL","S","SMALL","BR","UL","OL","LI","TABLE","THEAD","TBODY","TR","TD","TH","A"]);
const TRAIT_NAMES=["Treatment area","Product Origin","Brand","Steroid","Handpiece","Dose","Session","Treatment","Size","Area"];
function clean(s){return String(s||"").replace(/\s+/g," ").trim();}
function safeHref(href) {
  try{const u=new URL(href,ORIGIN);return u.protocol==="https:"&&["unni.app","www.youtube.com","www.instagram.com"].includes(u.hostname)?u.href:null;}
  catch{return null;}
}
function urlsFrom(images){
 return [...new Set(images.map(img=>mediaUrl(img.getAttribute("src")||img.getAttribute("data-src")||img.getAttribute("data-original")||"")).filter(Boolean))];
}
function nextElements(node,stopHeading){
 const result=[];let sibling=node.nextElementSibling;
 while(sibling&&result.length<400){
  if(stopHeading(sibling))break;
  result.push(sibling);sibling=sibling.nextElementSibling;
 }
 return result;
}
function findHeading(node,expr){
 return [...node.querySelectorAll("h2,h3,h4")].find(x=>expr.test(clean(x.textContent)));
}
function sliceSection(heading){
 if(!heading)return[];
 const tag=heading.tagName.toUpperCase();
 const rank=Number(tag.slice(1))||2;
 return nextElements(heading,n=>/^H[1-4]$/.test(n.tagName)&&(Number(n.tagName[1])<=rank||SECTION_TITLES.test(clean(n.textContent))));
}
function snapshotNode(node,depth=0){
 if(depth>15||!node)return null;
 if(node.nodeType===3){const value=node.nodeValue||"";return value.trim()?{tag:"text",value}:null;}
 if(node.nodeType!==1)return null;
 const tag=node.tagName.toUpperCase();
 if(tag==="IMG"){
  const src=mediaUrl(node.getAttribute("src")||node.getAttribute("data-src")||"");
  return src?{tag:"img",src,alt:node.getAttribute("alt")||"",width:node.getAttribute("width")||"",height:node.getAttribute("height")||""}:null;
 }
 if(!SHORT_TAGS.has(tag)) {
  const children=[...node.childNodes].map(c=>snapshotNode(c,depth+1)).filter(Boolean);
  return children.length?{tag:"fragment",children}:null;
 }
 const children=[...node.childNodes].map(c=>snapshotNode(c,depth+1)).filter(Boolean);
 if(!children.length&&tag!=="BR")return null;
 return {tag:tag.toLowerCase(),children,...(tag==="A"?{href:safeHref(node.getAttribute("href"))}:{}),...(tag==="TH"||tag==="TD"?{colSpan:node.getAttribute("colspan")||"1"}:{})};
}
function unique(list){return [...new Set(list)]}
function cleanLines(nodes){
 const lines=[];
 nodes.forEach(node=>{
  if(["UL","OL"].includes(node.tagName)){
   [...node.querySelectorAll(":scope > li")].forEach(li=>{const v=clean(li.textContent);if(v)lines.push(v)});
  }else if(["P","LI","DIV"].includes(node.tagName)){
   const nested=node.querySelectorAll("p,li").length;
   if(nested){node.querySelectorAll("p,li").forEach(p=>{const v=clean(p.textContent);if(v)lines.push(v)})}
   else {const v=clean(node.textContent);if(v)lines.push(v)}
  }else {const v=clean(node.textContent);if(v)lines.push(v)}
 });
 return unique(lines);
}
function findValue(data,re){const m=clean(data).match(re);return m?m[1]||m[0]:"";}
function priceData(raw){
 const amounts=[...raw.matchAll(MONEY)].map(m=>m[0]);
 const local=raw.match(WON)?.at(-1)||"";
 const discount=findValue(raw,/(\d{1,3}(?:\.\d+)?)\s*%/);
 let price=amounts.at(-1)||"";
 let original=amounts.length>1&&discount?amounts[0]:"";
 // Need explicit handling for source top-card format "$204.60(VAT included)20%$163.68".
 return {price,original,discount:discount?discount+"%":"",local,vat:/VAT\s*included/i.test(raw),currency:"USD"};
}
function optionProperties(raw){
 const textValue=clean(raw);
 const lines=textValue.replace(/([a-z])((?:Treatment area|Product Origin|Brand|Steroid|Handpiece):)/g,"$1 | $2");
 const obj={};
 for(const [key,rx] of [
  ["treatmentArea",/Treatment area:\s*([^|]+?)(?=\s*(?:Steroid:|Brand:|Handpiece:|Product Origin:|\d+\s*session|$))/i],
  ["brand",/Brand:\s*([A-Za-z0-9 +.-]+?)(?=\s*(?:\d+\s*session|Steroid:|Product Origin:|Handpiece:|$))/i],
  ["productOrigin",/Product Origin:\s*([A-Za-z ]+?)(?=\s*(?:Brand:|\d+\s*session|$))/i],
  ["handpiece",/Handpiece:\s*([A-Za-z0-9 -]+?)(?=\s*(?:Treatment area:|\d+\s*session|$))/i],
  ["steroid",/Steroid:\s*(Included|Not included|None)/i],
  ["sessions",/(\d+)\s*session\(s\)/i],
  ["volume",/(\d+(?:\.\d+)?\s*(?:cc|ml|Unit|units))\b/i]
 ]){
  const v=findValue(lines,rx);
  if(v)obj[key]=v;
 }
 return obj;
}
function parseOptionNodes(h3,number){
 const siblings=nextElements(h3,n=>(n.tagName==="H3"&&(!SECTION_TITLES.test(clean(n.textContent))))||n.tagName==="H2"||n.tagName==="H1");
 const raw=clean(siblings.map(x=>x.textContent).join(" "));
 const price=priceData(raw);
 const sourceId=null; // Source HTML does not expose per-option UUID; never invent one.
 return {index:number,sourceId,title:clean(h3.textContent),description:raw,priceInfo:price,properties:optionProperties(raw)};
}
function readOptions(root){
 const result=[];
 const start=findHeading(root,/^Procedure Info$/i);
 if(!start)return result;
 // Options are listed after "Procedure Info", before "Recommended to"/"Precautions"/"Details".
 let state=false;
 for(const node of [...root.querySelectorAll("h2,h3")]){
  const heading=clean(node.textContent);
  if(node===start){state=true;continue;}
  if(!state)continue;
  if(node.tagName==="H2"&&SECTION_TITLES.test(heading))break;
  if(node.tagName==="H3"&&!/^Option\s+\d+$/i.test(heading)){
   result.push(parseOptionNodes(node,result.length+1));
  }
 }
 return result.slice(0,200);
}
function splitSection(root,titleRegex){
 const heading=findHeading(root,titleRegex);
 const nodes=sliceSection(heading);
 return {heading:heading?clean(heading.textContent):"",nodes,rich:nodes.map(n=>snapshotNode(n)).filter(Boolean),lines:cleanLines(nodes)};
}
function findClinic(doc,root){
 const h2=findHeading(root,/^(?!About the)(?!Clinic Highlights)(?!Clinic Hours)(?!Popular Procedures)(?!Procedure Info)(?!Details)(?!Reviews)(?!Recommended to)(?!Procedure Steps)(?!Expected Downtime)(?!Precautions)(?!Specialties)[A-Za-z].*(?:Clinic|Hospital|Surgery)(?:\s*[-(].*)?$/i);
 const link=[...doc.querySelectorAll("a[href]")].find(a=>/^\/us\/hospitals\/\d+/.test(new URL(a.href,ORIGIN).pathname));
 const url=link?new URL(link.href,ORIGIN):null;
 const id=url?.pathname.match(/\/hospitals\/(\d+)/)?.[1]||null;
 const name=h2?clean(h2.textContent):link?clean(link.textContent):"";
 const nearby=h2?clean(nextElements(h2,n=>/^H[1-4]$/.test(n.tagName)).slice(0,3).map(n=>n.textContent).join(" ")):"";
 return {id,path:id?"/hospitals/"+id:null,name,station:findValue(nearby,/(?:Seoul|Busan|Incheon|Daegu)\s+[A-Za-z-]+(?:\s+stn\.)?/i),cctv:/\bCCTV\b/i.test(nearby),address:""};
}
function firstScore(root){
 const h=root.querySelector("h1");if(!h)return"";
 let n=h.nextElementSibling;
 for(let i=0;n&&i<5;i++,n=n.nextElementSibling){
  const value=clean(n.textContent);
  if(/^(?:10(?:\.0)?|[0-9]\.\d)$/.test(value))return value;
  if(/^Option\s+\d+/.test(value))break;
 }
 return "";
}
function detailMedia(root,kind){
 const imgs=urlsFrom([...root.querySelectorAll("img")]);
 const direct=imgs.filter(url=>url.includes("image2.gnsister.com"));
 if(kind==="hospital"){
  const gallery=direct.filter(u=>u.includes("/images/hospital/")&&!u.includes("/badge/")).slice(0,10);
  const other=direct.filter(u=>!gallery.includes(u));
  return {cover:gallery[0]||direct[0]||null,gallery,details:[],other};
 }
 const promotional=direct.filter(u=>u.includes("/images/direct/")||u.includes("/images/community/"));
 return {cover:promotional[0]||direct[0]||null,gallery:promotional.slice(0,1),details:promotional.slice(1),other:direct.filter(u=>!promotional.includes(u))};
}
function parseHours(root){
 const sec=splitSection(root,/^Clinic Hours$/i);
 const tbl=sec.nodes.find(n=>n.matches("table")||n.querySelector("table"));
 const table=tbl&&(tbl.matches("table")?tbl:tbl.querySelector("table"));
 if(table){
  const rows=[...table.querySelectorAll("tr")].map(tr=>[...tr.querySelectorAll("th,td")].map(td=>clean(td.textContent)));
  if(rows.length>=2)return {rows:rows[0].map((day,i)=>({day,time:rows[1][i]||""})),notes:sec.lines.filter(x=>x.toLowerCase().includes("closed"))};
 }
 const raw=sec.lines.join(" "),match=raw.match(/\bMon\b.*\bSun\b/);
 return {rows:[],notes:sec.lines};
}
function parseHospital(root,doc){
 const source=clean(root.textContent);
 const score=findValue(source,/^(?:U Line Clinic)?\s*(\d\.\d)\s+[\d,]+\s+Reviews/i)||findValue(source,/(\d\.\d)\s+([\d,]+)\s+Reviews/i);
 const combined=source.match(/(?:^|\D)(\d\.\d)\s*([\d,]+)\s+Reviews/);
 const reviewCount=combined?.[2]||source.match(/(\d[\d,]*)\s+Reviews/i)?.[1]||"";
 const headings=[...root.querySelectorAll("h3")];
 const highlights=splitSection(root,/^Clinic Highlights/i);
 const specialties=splitSection(root,/^Specialties$/i);
 const address=splitSection(root,/^Address$/i);
 const hours=parseHours(root);
 const intro=splitSection(root,/^About the Clinic$/i);
 const names=highlights.nodes.flatMap(x=>[...x.querySelectorAll("h3")].map(h=>clean(h.textContent)));
 const highlightNames=unique([...names,...headings.filter(h=>/operating|Non-surgical|Available after|credentials|Post-procedure/i.test(clean(h.textContent))).map(h=>clean(h.textContent))]);
 const specialRaw=specialties.lines.join(" ");
 const tags=["Body","Skin","Lifting","Botox","Filler","Dental","Eye","Hair","Breast","Rhinoplasty"].filter(s=>new RegExp("(?:^|\\W)"+s+"(?:\\W|$)","i").test(specialRaw)||specialRaw.includes(s));
 const links=[...doc.querySelectorAll("a[href]")];
 const doctorLinks=links.filter(a=>/\/us\/doctors\/\d+/.test(a.href)).map(a=>({name:clean(a.textContent),path:new URL(a.href).pathname.replace(/^\/us/,"")}));
 const eventLinks=links.filter(a=>/\/us\/events\/\d+/.test(a.href)).map(a=>({name:clean(a.textContent),path:new URL(a.href).pathname.replace(/^\/us/,"")}));
 const latlon=[...doc.querySelectorAll("img")].map(x=>x.src).find(x=>x.includes("get-generated-signed-map-url"));
 const m=latlon?.match(/[?&]center=(\d+(?:\.\d+)?)%2C(\d+(?:\.\d+)?)/i);
 return {rating:combined?.[1]||score||"",reviewCount,highlights:highlightNames,specialties:tags,
  about:intro,hours,address:address.lines.join(" "),doctors:doctorLinks,events:eventLinks,
  location:m?{lat:+m[1],lon:+m[2]}:null};
}
function parseDoctor(root){
 const src=clean(root.textContent);
 const reviewCount=src.match(/Reviews\s+([\d,]+)/i)?.[1]||"";
 const rating=src.match(/(\d\.\d)\s*・\s*Reviews/)?.[1]||"";
 return {reviewCount,rating,experience:splitSection(root,/^Experience & Background$/i),specialties:splitSection(root,/^Specialties$/i)};
}
export function parseDetailedSource(html,route){
 const doc=new DOMParser().parseFromString(html,"text/html");
 const root=doc.querySelector("main")||doc.body;
 const kind=/^\/hospitals\/\d+/.test(route)?"hospital":/^\/doctors\/\d+/.test(route)?"doctor":/^\/events\/\d+/.test(route)?"event":"other";
 const base={kind,route,title:clean(root.querySelector("h1")?.textContent)||clean(doc.title),images:detailMedia(root,kind),htmlAvailable:!!root};
 if(kind==="hospital")return {...base,...parseHospital(root,doc)};
 if(kind==="doctor")return {...base,...parseDoctor(root)};
 if(kind!=="event")return base;
 const info=splitSection(root,/^Procedure Info$/i);
 const vat=info.lines.join(" "),medicalInfo={
  vat:findValue(vat,/\bVAT\s*(Included|Not Included|Excluded|None)/i),
  anesthetic:findValue(vat,/Anesthetic Fees\s*(Included|Not Included|Excluded|None)/i),
  aftercare:findValue(vat,/Aftercare Fees\s*(Included|Not Included|Excluded|None)/i),
  disclaimer:info.lines.find(v=>/Information here is for reference only/i.test(v))||""
 };
 const selectedTitle=[...root.querySelectorAll("h3")].find(h=>/^Option\s+\d+$/.test(clean(h.textContent)))?.textContent;
 const selectedIndex=Math.max(0,Number(selectedTitle?.match(/\d+/)?.[0]||1)-1);
 const options=readOptions(root);
 const mainOptionText=clean(root.querySelector("h1")?.nextElementSibling?.textContent||"");
 const infoText=clean(root.textContent);
 const about=splitSection(root,/^About the Procedure$/i);
 const recommended=splitSection(root,/^Recommended to$/i);
 const steps=splitSection(root,/^Procedure Steps/i);
 const recovery=splitSection(root,/^Expected Downtime/i);
 const risks=splitSection(root,/^Precautions and Side Effects$/i);
 const details=splitSection(root,/^Details$/i);
 const reviews=splitSection(root,/^Reviews$/i);
 const duration=steps.heading.match(/(\d+)\s*minute/i)?.[1]||"";
 const days=recovery.heading.match(/(\d+)\s*day/i)?.[1]||"";
 const recommendedLines=recommended.lines.filter(v=>v&&!/Recommended to/i.test(v));
 const stepsLines=steps.lines.flatMap(v=>v.match(/\d+\s+[A-Z][^0-9]+/g)||[v]);
 const clinic=findClinic(doc,root);
 const detailText=clean(details.nodes.map(x=>x.textContent).join(" "));
 const fullAddress=detailText.match(/\d+\s+[^.]{10,170}Republic of Korea[^.\n]{0,95}/)?.[0]||"";
 clinic.address=fullAddress;
 const hasReview=!!reviews.heading; // Do not fabricate a review block where original lacks one.
 const selected=options[selectedIndex]||options[0]||null;
 const consultationRequired=/Consultation Required/i.test(infoText);
 const sourcePrice=selected?.priceInfo||priceData(infoText);
 return {...base,options,selectedIndex,selectedOption:selected,score:firstScore(root),
  clinic,medicalInfo,about,recommended:{...recommended,lines:recommendedLines},
  steps:{...steps,lines:stepsLines,durationMinutes:duration},
  recovery:{...recovery,days},risks,details,reviews:{...reviews,visible:hasReview},
  consultationRequired,sourcePrice,fullAddress};
}
