/**
 * Public source detail data model. Extract facts without inventing absent fields.
 * The original public web HTML may be no-store and is never cached by the gateway.
 * All prices below are observations, not booking quotes.
 */
const trim=v=>(v||"").replace(/\s+/g," ").trim();
const dollars=/\$\s?[\d,]+(?:\.\d{1,2})?/g;
const localWon=/₩\s?[\d,]+/;
const episode=/(\d+)\s*session\(s\)/i;
const knownAttr=[
  ["area",/Treatment area:\s*(.+?)(?=Steroid:|Product Origin:|Brand:|\d+\s*session|$)/i],
  ["steroid",/Steroid:\s*(.+?)(?=Treatment area:|Product Origin:|Brand:|\d+\s*session|$)/i],
  ["origin",/Product Origin:\s*(.+?)(?=Brand:|\d+\s*session|$)/i],
  ["brand",/Brand:\s*(.+?)(?=\d+\s*session|$)/i],
  ["handpiece",/Handpiece:\s*(.+?)(?=Treatment area:|\d+\s*session|$)/i],
  ["energy",/Energy:\s*(.+?)(?=\d+\s*session|$)/i],
];
function findSourceUri(v){
  if(!v)return null;
  try{const url=new URL(v,"https://unni.app");return url.protocol==="https:"?url.href:null}catch{return null}
}
function getSrc(img){
  return findSourceUri(img.getAttribute("src")||img.getAttribute("data-src")||img.getAttribute("data-original")||img.getAttribute("srcset")?.split(",")[0]?.trim().split(" ")[0]);
}
function inSourceHost(url){
  return url&&/^https:\/\/(?:image2\.gnsister\.com|unni\.app|env\.gnsister\.com)\//i.test(url);
}
function readImage(img){
  const url=getSrc(img);
  if(!inSourceHost(url))return null;
  let width=Number(img.getAttribute("width"))||0,height=Number(img.getAttribute("height"))||0;
  try{const params=new URL(url).searchParams;width=Number(params.get("originalImageWidth"))||width;height=Number(params.get("originalImageHeight"))||height}catch{}
  return {url,width,height,alt:img.getAttribute("alt")||"",kind:url.includes("/images/hospital/badge/")?"badge":
    url.includes("/images/hospital/")?"hospital":url.includes("/images/direct/")?"direct":
    url.includes("get-generated-signed-map-url")?"map":url.includes("/images/community/")?"article":"other"};
}
function uniqMedia(m){const s=new Set();return m.filter(x=>{if(!x||s.has(x.url))return false;s.add(x.url);return true})}
function mediaOf(root,kind){
  const images=uniqMedia([...root.querySelectorAll("img")].map(readImage));
  const direct=images.filter(i=>i.kind==="direct"),hosp=images.filter(i=>i.kind==="hospital");
  if(kind==="event"){
    const hero=direct.find(i=>i.width>0&&i.height>0&&i.width/i.height>1.65)||direct[0]||null;
    const detail=direct.filter(i=>i.url!==hero?.url);
    return {hero,gallery:hero?[hero]:[],detail,all:direct,map:images.find(i=>i.kind==="map")||null};
  }
  if(kind==="hospital"){
    // The original carousel begins with an offscreen clone of the last slide:
    // HTML order is 9,0,1,...,8,9. Restore logical 0..9 slide order from
    // the source's own alt="Clinic_0_image" markers; never invent photos.
    const indexed=hosp.map(item=>({item,index:Number(item.alt?.match(/_(\d+)_image$/i)?.[1])}))
      .filter(x=>Number.isInteger(x.index)&&x.index>=0&&x.index<100);
    indexed.sort((a,b)=>a.index-b.index);
    const gallery=uniqMedia(indexed.map(x=>x.item)).slice(0,10);
    const fallback=gallery.length?gallery:hosp.slice(0,10);
    return {hero:fallback[0]||null,gallery:fallback,detail:[],all:images,map:images.find(i=>i.kind==="map")||null,badges:images.filter(i=>i.kind==="badge")};
  }
  const gallery=images.filter(i=>i.kind==="hospital"||i.kind==="article"||i.kind==="direct");
  return {hero:gallery[0]||null,gallery,detail:gallery.slice(1),all:images,map:images.find(i=>i.kind==="map")||null};
}

// Preserve public markup semantics as a restricted AST; no source scripts,
// handlers, forms, styles, or embedded execution enters the independent UI.
const RICH_TAGS=new Set(["div","section","article","p","span","br","strong","b","em","i","small","h3","h4","h5","ul","ol","li","table","tbody","thead","tr","th","td","blockquote","dl","dt","dd","a","img"]);
function safeRichNode(node,depth=0){
  if(depth>35)return null;
  if(node.nodeType===3)return {text:node.textContent||""};
  if(node.nodeType!==1)return null;
  const name=node.tagName.toLowerCase();
  if(["script","style","noscript","iframe","form","button","input","select","textarea","video","audio","canvas","svg"].includes(name))return null;
  const tag=RICH_TAGS.has(name)?name:"div";
  if(tag==="img"){
    const media=readImage(node);
    return media?{tag:"img",src:media.url,alt:media.alt||"",width:media.width,height:media.height}:null;
  }
  if(tag==="a"){
    const href=findSourceUri(node.getAttribute("href"));
    if(!href)return {tag:"span",children:[...node.childNodes].map(n=>safeRichNode(n,depth+1)).filter(Boolean)};
    return {tag:"a",href,children:[...node.childNodes].map(n=>safeRichNode(n,depth+1)).filter(Boolean)};
  }
  const children=[...node.childNodes].map(n=>safeRichNode(n,depth+1)).filter(Boolean);
  if(!children.length&&tag!=="br")return null;
  return {tag,children};
}

function sourceSection(root,name){
  const headings=[...root.querySelectorAll("h2,h3")];
  let current=headings.find(h=>trim(h.textContent).toLowerCase().startsWith(name.toLowerCase()));
  if(!current)return null;
  const next=headings.find(h=>!!(current.compareDocumentPosition(h)&Node.DOCUMENT_POSITION_FOLLOWING)&&h.tagName==="H2");
  const range=current.ownerDocument.createRange();
  try{
    range.setStartAfter(current);
    if(next)range.setEndBefore(next);
    else range.setEndAfter(root.lastElementChild||current);
    const fragment=range.cloneContents();
    const rich=[...fragment.childNodes].map(node=>safeRichNode(node)).filter(Boolean);
    const blocks=[];
    const seen=new Set();
    // List and paragraphs are preserved instead of flattening all text.
    for(const el of fragment.querySelectorAll("table,ol,ul,p,li")){
      if(el.tagName==="LI"&&el.closest("ol,ul"))continue;
      if(el.closest("table,ol,ul")&&el.tagName!=="TABLE"&&el.tagName!=="OL"&&el.tagName!=="UL")continue;
      const raw=trim(el.textContent);if(!raw||seen.has(raw))continue;
      seen.add(raw);
      if(el.tagName==="OL"||el.tagName==="UL"){
        const items=[...el.querySelectorAll("li")].map(x=>trim(x.textContent)).filter(Boolean);
        if(items.length)blocks.push({type:el.tagName==="OL"?"ordered":"bullet",items});
      }else if(el.tagName==="TABLE"){
        const rows=[...el.querySelectorAll("tr")].map(tr=>[...tr.querySelectorAll("th,td")].map(td=>trim(td.textContent)));
        if(rows.length)blocks.push({type:"table",rows});
      }else blocks.push({type:"paragraph",value:raw});
    }
    const rawText=trim(fragment.textContent);
    if(!blocks.length&&rawText)blocks.push({type:"paragraph",value:rawText});
    return {title:trim(current.textContent),text:rawText,blocks,rich};
  }catch{
    let text="",element=current.nextElementSibling;
    for(let i=0;i<15&&element;i++,element=element.nextElementSibling){
      if(element.tagName==="H2")break;
      text+=" "+trim(element.textContent);
    }
    return {title:trim(current.textContent),text:trim(text),blocks:[],rich:[]};
  }finally{range.detach?.()}
}
function countTextInTitle(el,root){
  const h=root.querySelector("h1");if(!h)return "";
  const next=h.nextElementSibling;
  let s=trim((next?.textContent||"").slice(0,200));
  if(!s||s.length>130){
    const title=trim(h.textContent),all=trim(root.textContent);
    s=all.slice(Math.max(0,all.indexOf(title))+title.length,Math.max(0,all.indexOf(title))+title.length+100);
  }
  return s;
}
function ratingAndReviews(root,kind){
  const heading=root.querySelector("h1");
  const full=trim(root.textContent);
  const title=trim(heading?.textContent);
  const idx=title?Math.max(0,full.indexOf(title)+title.length):0;
  let head=full.slice(idx,idx+(kind==="hospital"?700:300));
  // Original DOM can concatenate "9.7" and "10,668Reviews" without a delimiter.
  const combined=head.match(/(?:^|[^\d.])((?:10|[0-9])\.\d)(\d{1,3}(?:,\d{3})+)\s*Reviews\b/i);
  let rating=combined?.[1]||"";
  let reviews=combined?.[2]||"";
  if(!rating){
    const limit=kind==="event"?(head.search(/Option\s+\d+/i)+1||160):head.search(/Clinic Highlights|About the Clinic/i);
    const prefix=limit>0?head.slice(0,limit):head.slice(0,260);
    rating=prefix.match(/(?:^|[^\d.])((?:10|[0-9])\.\d)/)?.[1]||"";
  }
  if(!reviews){
    reviews=head.match(/([\d,]+)\s*Reviews\b/i)?.[1]||head.match(/\bReviews\s*([\d,]+)/i)?.[1]||"";
    if(reviews&&rating&&reviews.startsWith(rating.replace(".","")))
      reviews=reviews.slice(rating.replace(".","").length);
  }
  if(kind==="event"&&!reviews){
    const observed=[...root.querySelectorAll("button")].find(button=>{
       const value=trim(button.textContent);
       return /^\([\d,]+\)$/.test(value)&&!!button.querySelector("span.underline");
    });
    // The original event header emits e.g. (4,537) as a separate review
    // button, not "... Reviews"; never substitute the clinic's review total.
    if(observed)reviews=trim(observed.textContent).match(/\(([\d,]+)\)/)?.[1]||"";
  }
  if(kind==="doctor"){
    // The doctor profile publishes an independent "Reviews 9,137" value.
    // Do not copy the linked clinic's 9.7 score onto the physician.
    const profile=full.slice(idx,Math.min(full.length,idx+1200)).split(/Works at|Experience & Background/i)[0];
    reviews=profile.match(/\bReviews\s*([\d,]+)/i)?.[1]||
      full.match(/\bReviews\s*([\d,]+)/i)?.[1]||reviews||"";
    const explicit=profile.match(/(?:^|\s)((?:10|[0-9])\.\d)\s*[·・]\s*Reviews/i)?.[1];
    rating=explicit||"";
  }
  return {rating,reviews};
}

function titleOptionIndex(main){
  const h=[...main.querySelectorAll("h3,h4")].find(x=>/^Option\s+\d{1,3}\s*$/i.test(trim(x.textContent)));
  return Math.max(0,Number(h?.textContent?.match(/\d+/)?.[0]||"1")-1);
}
function extractAttributes(raw){
  const res={};
  for(const[name,pattern]of knownAttr){let m=raw.match(pattern);if(m)res[name]=trim(m[1]).slice(0,120)}
  const vol=raw.match(/(\d+(?:\.\d+)?)\s*(cc|ml|unit|shot|line|area)(?=[A-Z]|\W|$)/i);
  if(vol){res.quantity=Number(vol[1]);res.unit=vol[2]}
  const sess=raw.match(episode);if(sess)res.sessions=Number(sess[1]);
  return res;
}
function parseMoney(raw){
  const prices=[...raw.matchAll(dollars)].map(x=>x[0].replace(/\s/g,""));
  const dis=raw.match(/(\d+(?:\.\d+)?)\s*%\s*\$\s?([\d,]+(?:\.\d{1,2})?)/);
  const local=raw.match(localWon)?.[0]||"";
  const originalPrice=dis&&prices.length>=2?prices[0]:null;
  const salePrice=dis?"$"+dis[2]:prices.at(-1)||null;
  return {originalPrice,salePrice,discountPercent:dis?Number(dis[1]):null,
    localPrice:local,currency:"USD",localCurrency:local?"KRW":null,vatIncluded:/VAT included/i.test(raw)};
}
// The public page already includes the full option array in its SSR JSON.
// Never infer UUIDs from option order; bind only matching name + source ID.
function publicOptionIds(doc,options){
 const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
 const source=[...doc.querySelectorAll("script")].map(s=>s.textContent||"").join("\n");
 const candidates=[...source.matchAll(/"id":"([0-9a-f-]{36})","name":"((?:\\.|[^"\\])*)"/gi)]
   .map(m=>({id:m[1],name:m[2].replace(/\\\"/g,'"')}))
   .filter(x=>uuid.test(x.id));
 const ordered=[];
 let offset=0;
 for(const o of options){
   const normalized=trim(o.title).toLowerCase();
   const matchIndex=candidates.findIndex((v,i)=>i>=offset&&trim(v.name).toLowerCase()===normalized);
   if(matchIndex<0){ordered.push(null);continue}
   ordered.push(candidates[matchIndex].id);
   offset=matchIndex+1;
 }
 return ordered;
}
function optionNodes(main){
  const all=[...main.querySelectorAll("h3")];
  const first=all.findIndex(h=>/^Option\s+\d{1,3}\s*$/i.test(trim(h.textContent)));
  const infoHeading=[...main.querySelectorAll("h2")].find(h=>/^Procedure Info$/i.test(trim(h.textContent)));
  const infoAfter=infoHeading ? all.findIndex(h=>Boolean(infoHeading.compareDocumentPosition(h)&Node.DOCUMENT_POSITION_FOLLOWING)):-1;
  const out=[];
  for(let i=0;i<all.length;i++){
    const h=all[i],title=trim(h.textContent);
    if(!title||/^Option\s+\d+$/i.test(title))continue;
    if(!/^[A-Za-z0-9]/.test(title)||title.length>180)continue;
    if(infoAfter>=0&&i<infoAfter)continue;
    let h2=h.previousElementSibling;
    let content="",list=[];
    for(let n=h.nextElementSibling,j=0;n&&j<12;j++,n=n.nextElementSibling){
      if(/^H[1-4]$/.test(n.tagName))break;
      const a=trim(n.textContent);
      if(a){content+=" "+a;list.push(a)}
      if(content.length>2600)break;
    }
    content=trim(content);
    if(!/\$\s?[\d,]+/.test(content))continue;
    const closest=h.closest("li,article,[data-option-id],[data-option-uuid]")||h.parentElement;
    const attrId=(closest?.getAttribute("data-option-id")||closest?.getAttribute("data-option-uuid")||"");
    const anchor=closest?.querySelector('a[href*="optionId="]')?.getAttribute("href")||"";
    const fromHref=anchor.match(/[?&]optionId=([0-9a-f-]{20,})/i)?.[1];
    const raw=(title+" "+content).replace(/\s+/g," ");
    out.push({index:out.length+1,title,summary:content,attributes:extractAttributes(raw),prices:parseMoney(content),
      sourceOptionId:attrId||fromHref||null});
  }
  return out;
}
function clinicEventInfo(main,doc){
  const allH2=[...main.querySelectorAll("h2")];
  const excluded=/^(Reviews|Procedure Info|About the Procedure|Recommended to|Procedure Steps|Expected Downtime|Precautions|Details|Popular Procedures)/i;
  const clinicHeading=allH2.find(h=>/Clinic|Hospital|Plastic Surgery|Dermatology|U Line/i.test(trim(h.textContent))&&!excluded.test(trim(h.textContent)));
  const name=trim(clinicHeading?.textContent)||null;
  const link=[...doc.querySelectorAll('a[href*="/hospitals/"]')].map(a=>a.getAttribute("href")).find(Boolean)||"";
  const id=link.match(/\/hospitals\/(\d+)/)?.[1]||null;
  const headerText=clinicHeading?.parentElement?trim(clinicHeading.parentElement.textContent).slice(0,340):"";
  const station=headerText.match(/(?:Seoul|Busan|Daegu|Incheon|Gwangju|Daejeon)[^,.]{0,110}?(?:stn\.|station)/i)?.[0]||
    trim(main.textContent).match(/(?:Seoul|Busan|Daegu|Incheon|Gwangju|Daejeon)[^,.]{0,90}?(?:stn\.|station)/i)?.[0]||"";
  const hasCCTV=/\bCCTV\b/.test(trim(main.textContent));
  return {name,id,path:id?"/hospitals/"+id:null,station,hasCCTV};
}
function infoRows(section){
  const raw=section?.text||"",patterns=[
    ["VAT",/VAT\s*(Included|Not included|Excluded|None|Extra|Additional)/i],
    ["Anesthetic Fees",/Anesthetic Fees\s*(Included|Not included|Excluded|None|Extra|Additional)/i],
    ["Aftercare Fees",/Aftercare Fees\s*(Included|Not included|Excluded|None|Extra|Additional)/i]];
  return patterns.map(([label,re])=>({label,value:raw.match(re)?.[1]||""}));
}
function parseRecommended(section){
  const raw=trim(section?.text||"");
  if(!raw)return [];
  // Support source markup that joins adjacent fragments as "For" + "those who...".
  const normalized=raw.replace(/For\s*those/gi,"For those")
    .replace(/([a-z.,)])(?=For those\b)/gi,"$1 ");
  const pieces=normalized.split(/(?=For those who\b|Those who\b|People who\b)/gi).map(trim).filter(Boolean);
  if(pieces.length>1)return pieces;
  const items=section?.blocks?.flatMap(b=>b.items||[])||[];
  const rebuilt=[];
  for(let i=0;i<items.length;i++){
    const item=trim(items[i]);
    if(item.toLowerCase()==="for"&&items[i+1]?.toLowerCase().startsWith("those"))rebuilt.push("For "+items[++i]);
    else rebuilt.push(item);
  }
  return rebuilt.length>1?rebuilt:[normalized];
}
function parseSteps(section){
  const list=section?.blocks?.flatMap(b=>b.items||[])||[];
  if(list.length>=2)return list.map((s,i)=>({number:i+1,name:trim(s).replace(/^(?:\d+[.)]?\s*)+/,"")}));
  const raw=section?.text||"";
  const parts=raw.split(/(?<!\w)(?=\d+\s+[A-Z])/).map(trim).filter(Boolean);
  return parts.length>=2?parts.map((s,i)=>({number:i+1,name:s.replace(/^(?:\d+[.)]?\s*)+/,"")})):[];
}
function specialties(section){
  const raw=section?.text||"";
  const names=["Face Contour","Hair Removal","Rhinoplasty","Lifting","Filler","Botox","Skin","Body","Breast","Hair","Dental","Eye","K-Med"];
  // Preserve the order publicly displayed by the clinic (e.g. Body, Skin,
  // Lifting, Botox), not the arbitrary order of this parser's vocabulary.
  return names.filter(n=>raw.toLowerCase().includes(n.toLowerCase()))
    .sort((a,b)=>raw.toLowerCase().indexOf(a.toLowerCase())-raw.toLowerCase().indexOf(b.toLowerCase()));
}
function clinicHours(section,root){
  const rows=section?.blocks?.filter(b=>b.type==="table").flatMap(b=>b.rows)||[];
  if(rows.length)return rows;
  const first=[...root.querySelectorAll("table")].find(t=>trim(t.parentElement?.textContent||"").includes("Mon"));
  if(first)return [...first.querySelectorAll("tr")].map(tr=>[...tr.querySelectorAll("td,th")].map(td=>trim(td.textContent)));
  const m=trim(section?.text).matchAll(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*[:\s]+(Closed|\d{1,2}:\d{2}\s*[~–-]\s*\d{1,2}:\d{2})/gi);
  return [...m].map(v=>[v[1],v[2]]);
}
function hospitalMeta(main){
  const about=sourceSection(main,"About the Clinic");
  const highlights=sourceSection(main,"Clinic Highlights");
  const specialtiesSec=sourceSection(main,"Specialties");
  const hours=sourceSection(main,"Clinic Hours");
  const address=sourceSection(main,"Address");
  const all=[...main.querySelectorAll("h3")].map(h=>trim(h.textContent));
  const highlightNames=all.filter(n=>/camera-monitored|non-surgical|after-hours|name & credentials|post-procedure care/i.test(n));
  const addressText=(address?.text||"").replace(/^Address\s*/i,"").replace(/\s*Copy(?: address)?\s*$/i,"").trim();
  const closed=hours?.text?.match(/Closed on[^.]+\./i)?.[0]||"";
  const doctorCount=trim(main.textContent).match(/All Doctors\s*(\d+)/i)?.[1]||"";
  const procedureCount=trim(main.textContent).match(/Procedures\s*(\d+)/i)?.[1]||"";
  return {about,highlights,highlightNames,specialties:specialties(specialtiesSec),hours:clinicHours(hours,main),
    closed,address:addressText,doctorCount:Number(doctorCount)||null,procedureCount:Number(procedureCount)||null};
}
export function extractArticleRich(main){
 const head=main.querySelector("h1");
 if(!head)return [];
 const range=main.ownerDocument.createRange();
 try{
   range.setStartAfter(head);
   range.setEndAfter(main.lastElementChild||head);
   return [...range.cloneContents().childNodes].map(x=>safeRichNode(x)).filter(Boolean);
 }catch{return []}finally{range.detach?.()}
}
export function parseDetailModel(doc,route,main){
  const kind=/^\/events\/\d+/.test(route)?"event":/^\/hospitals\/\d+/.test(route)?"hospital":
    /^\/doctors\/\d+/.test(route)?"doctor":/^\/contents\//.test(route)?"article":"other";
  const media=mediaOf(main,kind);
  const stats=ratingAndReviews(main,kind);
  const selectedOptionIndex=titleOptionIndex(main);
  const pageOptions=kind==="event"?optionNodes(main):[];
  if(kind==="event"){
    const observed=publicOptionIds(doc,pageOptions);
    pageOptions.forEach((o,i)=>{if(observed[i])o.sourceOptionId=observed[i]});
  }
  const parsed=new URLSearchParams(route.split("?")[1]||"");
  const initial=Math.max(0,Math.min(pageOptions.length-1,
    parsed.has("optionIndex")?Math.max(0,Number(parsed.get("optionIndex"))-1):selectedOptionIndex));
  const requestedUuid=parsed.get("optionId");
  const uuidShape=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // Never label a local optionIndex override with an unrelated source UUID.
  // URL-derived IDs are observed selected-option links, not the complete original catalog.
  const visibleUuid=requestedUuid&&uuidShape.test(requestedUuid)&&initial===selectedOptionIndex
    ?requestedUuid:null;
  if(pageOptions[initial]&&visibleUuid&&!pageOptions[initial].sourceOptionId)pageOptions[initial].sourceOptionId=visibleUuid;
  const sections={
    about:sourceSection(main,"About the Procedure"),
    info:sourceSection(main,"Procedure Info"),
    recommended:sourceSection(main,"Recommended to"),
    steps:sourceSection(main,"Procedure Steps"),
    downtime:sourceSection(main,"Expected Downtime"),
    precautions:sourceSection(main,"Precautions and Side Effects"),
    details:sourceSection(main,"Details"),
    popular:sourceSection(main,"Popular Procedures"),
  };
  const rawInfo=sections.about?.text||"";
  return {kind,media,stats,initialOptionIndex:initial,options:pageOptions,
    selected:pageOptions[initial]||null,
    clinic:kind==="event"?clinicEventInfo(main,doc):null,
    sections,infoRows:infoRows(sections.info),recommended:parseRecommended(sections.recommended),
    steps:parseSteps(sections.steps),duration:sections.steps?.title.match(/(\d+)\s*minute/i)?.[1]||null,
    downtime:sections.downtime?.title.match(/(\d+)\s*day/i)?.[1]||null,
    consultationRequired:/Consultation Required/i.test(rawInfo)||/Consultation Required/i.test(trim(main.textContent).slice(0,700)),
    hospital:kind==="hospital"?hospitalMeta(main):null,
    originalReviewGate:/Log in to view all detailed reviews/i.test(trim(main.textContent)),
    originalOptionUuid:visibleUuid,sourcePageUrl:"https://unni.app/us"+route};
}
