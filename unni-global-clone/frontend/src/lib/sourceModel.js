import {parseDetailModel,extractArticleRich} from "./detailParser";
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
// On the original homepage, product images often sit next to the text
// <a>, inside the same card container, rather than *inside* the anchor.
// Associate media with an item only if its containing ancestor references
// that same event and no unrelated event. Do not invent a placeholder URL.
function imageForSourceItem(anchor,card,href){
  let element=card||anchor;
  for(let depth=0;depth<7&&element;depth++,element=element.parentElement){
    const links=[...element.querySelectorAll('a[href]')].map(a=>originPath(a.getAttribute("href")||""))
      .filter(x=>x&&/^\/us\/(?:events|hospitals|doctors|contents)\//.test(x));
    const unique=new Set(links.map(x=>x.split("?")[0]));
    if(unique.size>1)break;
    if(unique.size===1&&!unique.has(href.split("?")[0]))break;
    const image=bestImage(element);
    if(image)return image;
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
  const closer=type==="doctor"?(a.closest('[class*="doctorViewWrapper"],[class*="doctorIdentity"],[class*="doctor-card"]')||a):
    (a.closest("article,li,[class*=card],[class*=Card]")||a);
  const raw=text(closer);
  // A doctor link is often nested in a clinic's enclosing article. Only a
  // doctor-profile anchor or its exact doctorViewWrapper may supply its title.
  const heading=type==="doctor"
    ?(text(a.querySelector('.doctorName,h3,h2,[data-testid="doctor-name"]'))||text(closer.querySelector(".doctorName,h3"))||text(a))
    :(text(closer.querySelector("h3,h2,h4"))||text(a.querySelector("h3,h2,h4"))||text(a));
  let label=shorten(heading||a.getAttribute("aria-label")||"",180);
  let publishedDate=null,articleCategory="";
  if(type==="article"){
    const leaves=[...a.querySelectorAll("*")].filter(el=>el.children.length===0)
      .map(el=>text(el)).filter(Boolean);
    publishedDate=raw.match(/\b20\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2}\b/)?.[0]||null;
    const candidates=leaves.filter(v=>v.length>28&&!/^20\d{2}[.\/-]/.test(v))
      .map(v=>v.replace(/20\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2}\s*$/,"").trim());
    const strong=candidates.find(v=>v===text(a.querySelector("h3,h2,h4")))||
       candidates.sort((a,b)=>b.length-a.length)[0]||"";
    if(strong&&raw.includes(strong)){
      const prefix=raw.slice(0,raw.indexOf(strong)).trim();
      if(prefix&&prefix.length<=45)articleCategory=prefix;
      label=shorten(strong,220);
    }else label=shorten(label.replace(/20\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2}\s*$/,"").trim(),220);
  }
  const image=bestImage(closer)||bestImage(a)||imageForSourceItem(a,closer,href);
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
    rating:num,reviewCount:reviews,discountPercent:Number(raw.match(/(?:^|\s)(\d{1,3})\s*%/)?.[1])||null,
    publishedDate,articleCategory,summary:type==="article"?(publishedDate||articleCategory||""):brief};
}
export function collectItems(document,kind,limit=180){
  const seen=new Set(),found=[];
  for(const a of document.querySelectorAll("a[href]")){
    const obj=itemAnchor(a);
    if(!obj||obj.type!==kind)continue;
    const key=kind==="article"?obj.path.split("?")[0]:obj.sourceHref;
    if(seen.has(key))continue;
    seen.add(key);found.push(obj);
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
    for(let n=0;cur&&n<400;n++,cur=cur.nextElementSibling){
      if(/^H[1-4]$/.test(cur.tagName))break;
      raw+=" "+text(cur);
      if(raw.length>150000)break;
    }
    raw=raw.trim();
    if(raw.length>0)result.push({id:result.length,title:heading,description:raw});
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
  // Home is parsed from the real public /us homepage rather than a substitute category.
  const firstPromo=route==="/"?([...body.querySelectorAll("h1,h2")].map(text)
    .find(s=>/deals?\s+up\s+to|special\s+offers?|discounts?/i.test(s))||""):"";
  const homeSections=route==="/"?(()=>{
    const heads=[...body.querySelectorAll("h2")].filter(h=>{
      const value=text(h);
      return value.length>3&&value.length<150;
    });
    const links=[...body.querySelectorAll("a[href]")];
    return heads.map((h,i)=>{
      const after=heads[i+1]||null;
      const seen=new Set(),items=[];
      for(const a of links){
        if(!(h.compareDocumentPosition(a)&Node.DOCUMENT_POSITION_FOLLOWING))continue;
        if(after&&!(a.compareDocumentPosition(after)&Node.DOCUMENT_POSITION_FOLLOWING))continue;
        const item=itemAnchor(a);
        if(item?.type!=="event"||seen.has(item.sourceHref))continue;
        seen.add(item.sourceHref);items.push(item);
      }
      const next=h.nextElementSibling,subtitle=next&&next.tagName==="P"?text(next).slice(0,300):"";
      // Restore only source-observed wide editorial images actually inside
      // this source section; don't reinterpret thumbnails as campaign banners.
      const region=doc.createRange();
      region.setStartAfter(h);
      if(after)region.setEndBefore(after);
      else region.setEndAfter(body.lastElementChild||h);
      const fragment=region.cloneContents();
      const editorial=[...fragment.querySelectorAll("img")].map(img=>{
        const url=mediaUrl(img.getAttribute("src")||img.getAttribute("data-src")||"");
        if(!url)return null;
        const params=new URL(url).searchParams;
        const width=Number(params.get("originalImageWidth")||img.getAttribute("width")||0);
        const height=Number(params.get("originalImageHeight")||img.getAttribute("height")||0);
        return width>=700&&height>200&&height<=600&&width/height>=2.2?url:null;
      }).filter(Boolean);
      // On source editorial blocks the 1080x396 visual can precede its H2.
      // Accept a parent <section> only when it encloses exactly this heading;
      // do not attach one unrelated promotional photo to every category.
      const local=h.closest("section");
      const localImage=local&&local.querySelectorAll("h2").length===1?
         [...local.querySelectorAll("img")].map(img=>{
            const u=mediaUrl(img.getAttribute("src")||img.getAttribute("data-src")||"");
            if(!u)return null;
            const opts=new URL(u).searchParams;
            const w=Number(opts.get("originalImageWidth")||img.getAttribute("width")||0);
            const h=Number(opts.get("originalImageHeight")||img.getAttribute("height")||0);
            return w>=700&&h>200&&h<=600&&w/h>=2.2?u:null;
         }).find(Boolean):null;
      const banner=editorial[0]||localImage||null;
      return {title:text(h),subtitle,banner,events:items};
    });
  })():[];
  const homePromo=route==="/"?{
    title:firstPromo||"Treatment deals",
    subtitle:(fullText.match(/Exclusive savings[^.]*\./i)||[])[0]||""
  }:null;
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
  const rawAddress=fullText.match(/\b\d{1,4}\s+[A-Za-z][A-Za-z\d\s-]{2,85}(?:-ro|-gil|road|street)[^\n]{0,210}Republic of Korea(?:[^\n]{0,110})?/i)?.[0]||
     fullText.match(/\b\d{1,4}\s+[A-Za-z\d-]+-ro[^\n]{0,190}Republic of Korea/i)?.[0]||"";
  const clinicAddress=rawAddress.split(/(?:["{}]|priceSpecification|@type|Sign up now|Location|Popular Procedures)/)[0].trim();
  if(detailKind==="doctors"&&hospitals.length) {
    const mainTitle=pageTitle.split("|")[0].trim();
    const hospitalName=hospitals[0].title.replace(/(?:9|8)\.\d.*$/,"").trim();
    if(hospitalName&&mainTitle.toLowerCase().startsWith(hospitalName.toLowerCase()))
      pageTitle=mainTitle.slice(hospitalName.length).trim()||pageTitle;
  }

  // Ground source recommendations in the actual text of the current event.
  // Some UNNI SSR layouts expose their five recommendations as bare text nodes
  // rather than <p> or <li>. Keep an independent path that is not tied to
  // document Range, sibling structure or React hydration.
  const recMatch=fullText.match(/Recommended to\s*([\s\S]*?)(?=Procedure Steps|Expected Downtime|Precautions and Side Effects|\bDetails\b|Popular Procedures|$)/i);
  // Some source sections are hydrated into the original browser by client JS.
  // The upstream HTML sent to our DOMParser may contain these words only in
  // serialized data; retain that source text as a second, transient candidate.
  const serializedText=(html||"").replace(/\\u003[cC]/g,"<").replace(/\\u003[eE]/g,">")
       .replace(/\\n/g," ").replace(/<[^>]+>/g," ").replace(/&(?:nbsp|amp);/g," ");
  const serializedRec=serializedText.match(/Recommended to\s*([\s\S]*?)(?=Procedure Steps|Expected Downtime|Precautions and Side Effects|\bDetails\b|$)/i);
  const recRaw=(recMatch?.[1]||serializedRec?.[1]||"").trim();
  // Parse *every* source recommendation. Adjacent text nodes may join
  // "...fatFor those whose..." without whitespace; "whose" is a distinct
  // original sentence from "who" and must not be merged.
  const splitRecommendations=raw=>{
    const normalized=String(raw||"")
      .replace(/([a-z.!?])(?=For\s+those\s+wh(?:o|ose)\b)/gi,"$1 ")
      .replace(/(For)\s+(those\s+wh(?:o|ose)\b)/gi,"For $2");
    return normalized.split(/(?=For\s+those\s+wh(?:o|ose)\b)/gi)
      .map(x=>x.replace(/^\s*[•·-]\s*/,"").trim())
      .filter(x=>x.length>7&&x.length<500)
      .map(x=>/^Those\s+wh(?:o|ose)\b/i.test(x)?"For "+x:x);
  };
  const recommendedExplicit=splitRecommendations(recRaw);

  const detail=parseDetailModel(doc,route,body);
  if(detailKind==="contents")detail.articleRich=extractArticleRich(body);
  // Some links are serialized into the original source document but not exposed
  // as <a> elements in the current viewport; recover grounded IDs only.
  const serialized=doc.documentElement.outerHTML.replace(/\\u002F/gi,"/").replace(/\\\//g,"/");
  if(detail.kind==="event"&&detail.clinic&&!detail.clinic.path){
    const hid=serialized.match(/\/us\/hospitals\/(\d+)/)?.[1]||null;
    if(hid){detail.clinic.id=hid;detail.clinic.path="/hospitals/"+hid}
  }
  if(detail.kind==="hospital"&&!doctors.length){
    const physicianId=serialized.match(/\/us\/doctors\/(\d+)/)?.[1]||null;
    const physicianName=fullText.match(/All Doctors\s*\d+\s*([A-Z][A-Za-z .'-]{3,75}Dr\.)/i)?.[1]?.trim()||"";
    if(physicianId&&physicianName){
      doctors.push({id:physicianId,type:"doctor",path:"/doctors/"+physicianId,
        sourceHref:"/us/doctors/"+physicianId,title:physicianName,image:null,price:"",
        summary:"Public clinic physician",rating:"",reviewCount:""});
    }
  }

  // Preserve recommendation bullets even when the original page nests the
  // heading and the five separate paragraphs across different React wrappers.
  // The former Range/sibling parsers can silently miss these visible paragraphs.
  const recommendedHeading=[...body.querySelectorAll("h2,h3")].find(h=>/^Recommended to\b/i.test(text(h)));
  if(recommendedHeading){
    const raw=body.textContent||"";
    const key=text(recommendedHeading);
    const begin=raw.indexOf(key);
    if(begin>=0){
      let tail=raw.slice(begin+key.length);
      const end=tail.search(/Procedure Steps|Expected Downtime|Precautions and Side Effects|(?:^|\s)Details(?:\s|$)/i);
      if(end>=0)tail=tail.slice(0,end);
      const lines=tail.replace(/([.!?])(?=For those who\b)/gi,"$1 ")
        .split(/(?=For those who\b|For those whose\b|Those who\b|Those whose\b|People who\b)/gi).map(x=>x.trim()).filter(Boolean);
      if(lines.length>=2){
        detail.recommended=lines;
        detail.sections.recommended={title:"Recommended to",text:lines.join(" "),blocks:[{type:"bullet",items:lines}]};
      }
    }
  }

  const originalSectionList=extractSections(body);
  // A few source pages wrap recommendation text in extra divs; the Range
  // extractor can lose those nodes even though the older sibling parser sees them.
  if(!detail.sections.recommended?.text){
    // Some original pages embed list paragraphs in a nested container that
    // section/extractSections skip. The source's actual rendered text is used.
    const pageText=body.textContent||"";
    const begin=pageText.search(/Recommended to/i);
    if(begin>=0){
      const rest=pageText.slice(begin).replace(/^Recommended to\s*/i,"");
      const boundary=rest.search(/Procedure Steps|Expected Downtime|Precautions and Side Effects|\bDetails\b/i);
      const sectionText=(boundary>=0?rest.slice(0,boundary):rest.slice(0,900)).trim();
      if(sectionText){
        const pieces=sectionText.replace(/([a-z.,)])(?=For those)/gi,"$1 ")
          .split(/(?=For those who\b|For those whose\b|Those who\b|Those whose\b|People who\b)/gi).map(x=>x.trim()).filter(Boolean);
        detail.sections.recommended={title:"Recommended to",text:sectionText,blocks:[]};
        detail.recommended=pieces.length?pieces:[sectionText];
      }
    }
  }
  if(!detail.sections.recommended?.text){    const fallback=originalSectionList.find(x=>/^Recommended to\b/i.test(x.title));
    if(fallback?.description){
      detail.sections.recommended={title:fallback.title,text:fallback.description,blocks:[{type:"paragraph",value:fallback.description}]};
      const normalized=fallback.description.replace(/For\s*those/gi,"For those").replace(/([a-z.,)])(?=For those)/gi,"$1 ");
      detail.recommended=normalized.split(/(?=For those who\b|Those who\b|People who\b)/gi).map(x=>x.trim()).filter(Boolean);
    }
  }
  // A public physician anchor may be wrapped by a hospital card. Resolve
  // the physician's visible proper name from the original All Doctors section
  // instead of accepting the enclosing clinic title.
  if(detailKind==="hospitals"&&doctors.length){
    // Duplicate source anchor variants must not create phantom physicians.
    const ids=new Set();
    for(let i=doctors.length-1;i>=0;i--){
      const id=doctors[i].id||doctors[i].path;
      if(ids.has(id))doctors.splice(i,1);
      else ids.add(id);
    }
    const roster=fullText.match(/All Doctors\s*\d+([\s\S]{0,1400}?)(?=Clinic Hours|Address|Procedures|Reviews|$)/i)?.[1]||"";
    const verified=[...roster.matchAll(/([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})\s+Dr\./g)]
       .map(m=>m[1]+" Dr.");
    if(verified.length===doctors.length){
      doctors.forEach((doctor,i)=>{
        doctor.title=verified[i];
        doctor.summary="Public clinician";
      });
    }
  }
  const doctorSpecialties=detailKind==="doctors"?["Filler","Lifting","Body","Skin","Botox"].filter(x=>
    fullText.slice(0,Math.min(600,Math.max(0,fullText.indexOf("Reviews"))+170)).includes(x)):null;
  return {route,pageTitle,homePromo,homeSections,doctorSpecialties,detailKind,id:match?.[2]||null,
    count:countMatch?Number(countMatch[1].replace(/,/g,"")):null,
    summary:shorten(fullText,2400),rating:detail.stats.rating||rating,reviewCount:detail.stats.reviews||reviewCount,clinicAddress,
    events,hospitals,doctors,articles,sections:originalSectionList,
    options:detail.options.length?detail.options:(detailKind==="events"?extractOptions(body):[]),
    selectedOptionIndex:detail.initialOptionIndex,images:imageGallery(body),
    recommendedExplicit:recommendedExplicit.length>=2?recommendedExplicit:splitRecommendations(detail.sections.recommended?.text||""),detail,
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
 const [pathname,query=""]=route.split("?");
 const args=new URLSearchParams(query);
 // Local controls must never be forwarded to the original provider.
 args.delete("optionIndex");args.delete("viewSort");
 return "/us"+pathname+(args.toString()?"?"+args.toString():"");
}
