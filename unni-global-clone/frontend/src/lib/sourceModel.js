import {parseDetailModel} from "./detailParser";
/**
 * Browser-side source adapter for the publicly accessible unni.app/us web UI.
 * Never fabricate a product, hospital, rating, price, option or original ID.
 * HTML is fetched in real time through FastAPI, which respects no-store.
 */
export const ORIGIN = "https://unni.app";
export const CATEGORY_IDS = Object.freeze({
  Lifting:419,Skin:411,Botox:415,Filler:416,Rhinoplasty:412,Eye:413,
  "Face Contour":414,Breast:421,Body:422,Hair:418,"Hair Removal":537,
  "K-Med":417,Dental:420,Others:423
});
export const CATEGORIES = Object.keys(CATEGORY_IDS);
export const SORTS = Object.freeze([
  {label:"Recommended",value:""},
  {label:"Newest",value:"LATEST_STARTS_AT"},
  {label:"Lowest Price",value:"LOWEST_DISCOUNTED_COST"},
  {label:"Highest Discount",value:"HIGHEST_DISCOUNT_RATE"},
  {label:"Highest Price",value:"HIGHEST_DISCOUNTED_COST"},
  {label:"Most reviewed",value:"HIGHEST_RATING_COUNT"},
  {label:"Ending Soon",value:"EARLIEST_ENDS_AT"},
  {label:"Most Popular",value:"HIGHEST_POPULARITY"},
  {label:"Highest Rating",value:"HIGHEST_RATING_AMOUNT"}
]);
export const text = e => (e?.textContent||"").replace(/\s+/g," ").trim();
export const shorten=(s,n=150)=>!s?"":s.length>n?s.slice(0,n).trimEnd()+"…":s;
export function originPath(href) {
  try {const url=new URL(href,ORIGIN);if(url.hostname!=="unni.app"||!url.pathname.startsWith("/us"))return null;
    return url.pathname+url.search;
  }catch{return null;}
}
export function mediaUrl(src) {
  try {if(!src)return null;const url=new URL(src,ORIGIN);
    if(url.protocol!=="https:")return null;
    if(!["unni.app","image2.gnsister.com"].includes(url.hostname))return null;
    return url.href;
  }catch{return null;}
}
const max=150, E=/^\/us\/events\/(\d+)(?:\?|$)/, H=/^\/us\/hospitals\/(\d+)(?:\?|$)/,
      D=/^\/us\/doctors\/(\d+)(?:\?|$)/, C=/^\/us\/contents\/([a-f0-9-]{24,})(?:\?|$)/;
function bestImage(el){
  const imgs=[...el.querySelectorAll("img")];
  for (const img of imgs) {
    const variants=[img.getAttribute("src"),img.getAttribute("data-src"),img.getAttribute("data-original"),img.getAttribute("srcset")?.split(",")[0]?.trim().split(" ")[0]];
    for(const source of variants){const uri=mediaUrl(source);if(uri&&!/\/images\/(?:icon|splash|review-login)\//.test(uri))return uri;}
  }
  return null;
}
function typeOfPath(url){
  if(E.test(url))return "event";
  if(H.test(url))return "hospital";
  if(D.test(url))return "doctor";
  if(C.test(url))return "article";
  return null;
}
function itemAnchor(a){
  const href=originPath(a.getAttribute("href")||"");
  const type=href&&typeOfPath(href);
  if(!type)return null;
  const closer=a.closest("article,li,[class*=card],[class*=Card]")||a;
  const raw=text(closer);
  const heading=text(closer.querySelector("h3,h2,h4"))||text(a.querySelector("h3,h2,h4"))||text(a);
  const label=shorten(heading||a.getAttribute("aria-label")||"",120);
  const image=bestImage(closer)||bestImage(a);
  const amounts=[...raw.matchAll(/(?:US)?\$\s?[\d,]+(?:\.\d{1,2})?/g)].map(m=>m[0]);
  // Original listing can append a parenthesized unit price after the actual offer.
  // Do not mistake "($81.84 per 50Unit)" for the product's $163.68 price.
  const prices=[...raw.matchAll(/(?:US)?\$\s?[\d,]+(?:\.\d{1,2})?/g)].filter(m=>{
    const before=raw.slice(Math.max(0,m.index-2),m.index);
    const after=raw.slice(m.index+m[0].length,m.index+m[0].length+20);
    return !(before.endsWith("(")&&/\bper\b/i.test(after));
  });
  const lastPrice=(prices.length?prices.at(-1)[0]:amounts.at(-1))||"";
  const num=raw.match(/(?:^|\s)(9(?:\.\d)?|8(?:\.\d)?|10(?:\.0)?)(?=\s|$|\()/)?.[1]||"";
  const reviews=raw.match(/\(([\d,]+)\)/)?.[1]||"";
  const brief=shorten(raw.replace(label,"").replace(/\s+/g," "),160);
  const id=href.match(E)?.[1]||href.match(H)?.[1]||href.match(D)?.[1]||href.match(C)?.[1]||"";
  return {id,sourceHref:href,path:href.replace(/^\/us/,""),type,
    title:label||"Open original item",image,price:lastPrice,originalPrices:amounts,
    rating:num,reviewCount:reviews,summary:brief};
}
export function collectItems(document,kind,limit=180){
  const seen=new Set(),found=[];
  for(const a of document.querySelectorAll("a[href]")){
    const obj=itemAnchor(a);
    if(!obj||obj.type!==kind||seen.has(obj.sourceHref))continue;
    seen.add(obj.sourceHref);found.push(obj);
    if(found.length>=limit)break;
  }
  return found;
}
function extractSections(parent){
  const heads=[...parent.querySelectorAll("h2,h3,h4")],result=[];
  for(const h of heads){
    const heading=text(h);
    if(!heading||heading.length>170||/^\d+\.?$/.test(heading))continue;
    let cur=h.nextElementSibling,raw="";
    for(let n=0;cur&&n<4;n++,cur=cur.nextElementSibling){
      if(/^H[1-4]$/.test(cur.tagName))break;
      raw+=" "+text(cur);
      if(raw.length>1900)break;
    }
    raw=raw.trim();
    if(raw.length>0)result.push({id:result.length,title:heading,description:shorten(raw,1800)});
  }
  return result.slice(0,90);
}
function extractOptions(parent){
  const headers=[...parent.querySelectorAll("h3")],results=[],blockWords=/^(option\s*\d+|reviews|details|hospital|doctor|procedure info|procedure steps|about|recommended|sign up|login|rating|consultation)/i;
  for(const h of headers){
    const title=text(h);
    if(!title||title.length>155||blockWords.test(title))continue;
    const candidates=[];
    let cur=h.nextElementSibling;
    for(let i=0;cur&&i<4;i++,cur=cur.nextElementSibling){
      if(/^H[1-4]$/.test(cur.tagName))break;
      candidates.push(text(cur));
    }
    const rest=candidates.join(" "),nearby=text(h.parentElement);
    const matches=[...(rest||nearby).matchAll(/(?:US)?\$\s?[\d,]+(?:\.\d{1,2})?/g)].map(m=>m[0]);
    if(matches.length===0&&/^[A-Z][a-z]/.test(title)===false)continue;
    if(!matches.length&&!/botox|filler|lifting|injection|laser|surgery|treatment|ulther|onda|shurink|contour|skin|cut/i.test(title))continue;
    // Identically named items can be distinct original options (different areas/amounts).
    // Never collapse options by title; their position carries distinct semantics.
    results.push({index:results.length+1,title,description:shorten(rest,350),price:matches.at(-1)||"",sourceOptionId:null});
  }
  return results.slice(0,100);
}
function imageGallery(main){
  const imgs=[];
  for(const img of main.querySelectorAll("img")){
    const src=mediaUrl(img.getAttribute("src")||img.getAttribute("data-src")||"");
    if(!src||/\/images\/(?:icon|splash|review-login)\//.test(src))continue;
    if(!imgs.includes(src))imgs.push(src);
  }
  return imgs.slice(0,50);
}
export function parseSource(html,route){
  const doc=new DOMParser().parseFromString(html,"text/html");
  const body=doc.querySelector("main")||doc.body;
  let pageTitle=text(body.querySelector("h1"))||text(doc.querySelector("title"))||"UNNI";
  const events=collectItems(doc,"event"),hospitals=collectItems(doc,"hospital"),
        doctors=collectItems(doc,"doctor"),articles=collectItems(doc,"article");
  const match=route.match(/^\/(events|hospitals|doctors|contents)\/([^/?]+)/);
  const detailKind=match?.[1]||null;
  const fullText=text(body);
  const titleText=text(doc.querySelector("title"));
  const countMatch=titleText.match(/(?:Compare|Find)\s+([\d,]+)/i)||
     titleText.match(/([\d,]+)\s+deals/i)||
     (route.startsWith("/events")?fullText.match(/Procedures\s+([\d,]+)/i):null);
  // The source sometimes runs the public score and review count together
  // without whitespace, e.g. "9.710,668Reviews": rating=9.7, reviews=10,668.
  const fused=fullText.match(/(?:^|[^\d.])(9\.\d|8\.\d|10\.0)\s*(\d{1,3}(?:,\d{3})+)\s*Reviews\b/i);
  const rating=fused?.[1]||fullText.match(/(?:^|\s)(9(?:\.\d)?|8(?:\.\d)?|10(?:\.0)?)(?=\s|$|\()/)?.[1]||"";
  const reviewCount=fused?.[2]||fullText.match(/(?:^|\D)(\d{1,3}(?:,\d{3})+)\s*Reviews\b/i)?.[1]||"";
  const selectedOptionHeading=[...body.querySelectorAll("h3,h4")].map(x=>text(x)).find(x=>/^Option\s+\d{1,3}$/i.test(x));
  const selectedOptionIndex=Math.max(0,(Number((selectedOptionHeading||"").match(/Option\s+(\d{1,3})/i)?.[1]||fullText.match(/Option\s+(\d{1,3})\b/i)?.[1]||"1")-1));
  const clinicAddress=fullText.match(/\b\d{1,4}\s+[A-Za-z][A-Za-z\d\s-]{2,85}(?:-ro|-gil|road|street)[^.;\n]{0,180}Republic of Korea(?:[^.;\n]{0,110})?/i)?.[0]||
    fullText.match(/\b\d{1,4}\s+[A-Za-z\d-]+-ro[^.;\n]{0,190}Republic of Korea/i)?.[0]||"";
  if(detailKind==="doctors"&&hospitals.length) {
    const mainTitle=pageTitle.split("|")[0].trim();
    const hospitalName=hospitals[0].title.replace(/(?:9|8)\.\d.*$/,"").trim();
    if(hospitalName&&mainTitle.toLowerCase().startsWith(hospitalName.toLowerCase()))
      pageTitle=mainTitle.slice(hospitalName.length).trim()||pageTitle;
  }
  const detail=parseDetailModel(doc,route,body);
  const originalSectionList=extractSections(body);
  // A few source pages wrap recommendation text in extra divs; the Range
  // extractor can lose those nodes even though the older sibling parser sees them.
  if(!detail.sections.recommended?.text){
    const fallback=originalSectionList.find(x=>/^Recommended to\b/i.test(x.title));
    if(fallback?.description){
      detail.sections.recommended={title:fallback.title,text:fallback.description,blocks:[{type:"paragraph",value:fallback.description}]};
      const normalized=fallback.description.replace(/For\s*those/gi,"For those").replace(/([a-z.,)])(?=For those)/gi,"$1 ");
      detail.recommended=normalized.split(/(?=For those who\b|Those who\b|People who\b)/gi).map(x=>x.trim()).filter(Boolean);
    }
  }
  return {route,pageTitle,detailKind,id:match?.[2]||null,
    count:countMatch?Number(countMatch[1].replace(/,/g,"")):null,
    summary:shorten(fullText,2400),rating:detail.stats.rating||rating,reviewCount:detail.stats.reviews||reviewCount,clinicAddress,
    events,hospitals,doctors,articles,sections:originalSectionList,
    options:detail.options.length?detail.options:(detailKind==="events"?extractOptions(body):[]),
    selectedOptionIndex:detail.initialOptionIndex,images:imageGallery(body),detail,
    hasSourceData:events.length+hospitals.length+doctors.length+articles.length>0||!!match};
}
export function buildEventRoute({query="",category="",sort=""}={}){
  const args=new URLSearchParams();
  if(query)args.set("q",query);
  const catId=CATEGORY_IDS[category];
  if(catId)args.set("categoryId",String(catId));
  if(sort)args.set("s",sort);
  const str=args.toString();
  return "/events"+(str?"?"+str:"");
}
export function createPageSource(route){
  if(route==="/")return"/us";
  if(route==="/saved"||route==="/settings")return null;
  if(!/^\/(?:events|hospitals|doctors|contents|community|search|reviews)(?:\/|\?|$)/.test(route))return"/us";
  // optionIndex is local-only until the origin publishes an optionId UUID.
  // Do not send an invented optionIndex parameter to the original server.
  if(route.includes("optionIndex=")){
    const [pathname,query=""]=route.split("?");
    const args=new URLSearchParams(query);
    args.delete("optionIndex");
    return "/us"+pathname+(args.toString()?"?"+args.toString():"");
  }
  return"/us"+route;
}
