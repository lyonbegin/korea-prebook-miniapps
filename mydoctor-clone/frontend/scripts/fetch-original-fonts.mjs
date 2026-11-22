import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const FONT_DIR=path.join(ROOT,"src","fonts");
const CSS_OUT=path.join(ROOT,"src","source-original-fonts.css");
const SOURCE_PAGE="https://my-doctor.io/qna";
const USER_AGENT="Mozilla/5.0 (compatible; MyDoctorOriginalFontBuild/1.0)";

async function get(url){
 const response=await fetch(url,{headers:{"user-agent":USER_AGENT}});
 if(!response.ok)throw new Error("HTTP "+response.status+" fetching "+url);
 return response;
}
const html=await (await get(SOURCE_PAGE)).text();
const stylesheetUrls=[...new Set([...html.matchAll(/href=["']([^"']+\.css(?:\?[^"']*)?)["']/gi)]
 .map(x=>new URL(x[1],SOURCE_PAGE).href)
 .filter(x=>new URL(x).hostname==="my-doctor.io"))];
if(!stylesheetUrls.length)throw new Error("No original my-doctor.io CSS stylesheets found");

const declarations=[];
for(const href of stylesheetUrls){
 const css=await (await get(href)).text();
 const rules=[...css.matchAll(/@font-face\s*\{[^}]*\}/gi)].map(x=>x[0]);
 for(const rule of rules){
  if(!/font-family\s*:\s*['"]?Pretendard Variable['"]?\s*;/i.test(rule))continue;
  const src=rule.match(/url\((['"]?)([^)'"]+)\1\)/i);
  if(!src)continue;
  const remote=new URL(src[2],href);
  const filename=path.basename(remote.pathname);
  if(!filename.endsWith(".woff2"))continue;
  const localRule=rule.replace(/url\((['"]?)([^)'"]+)\1\)/i,'url("./fonts/'+filename+'")');
  declarations.push({filename,url:remote.href,rule:localRule});
 }
}
const unique=[...new Map(declarations.map(x=>[x.filename,x])).values()];
if(unique.length<70)throw new Error("Expected original Pretendard unicode subsets; found "+unique.length);
await fs.mkdir(FONT_DIR,{recursive:true});
let bytes=0,downloaded=0;
for(let i=0;i<unique.length;i+=8){
 const batch=unique.slice(i,i+8);
 const results=await Promise.all(batch.map(async item=>{
  const destination=path.join(FONT_DIR,item.filename);
  try{
   const stat=await fs.stat(destination);
   if(stat.size>1000)return {size:stat.size,downloaded:false};
  }catch{}
  const response=await get(item.url);
  const data=Buffer.from(await response.arrayBuffer());
  if(data.length<1000)throw new Error("Invalid font file "+item.url+" ("+data.length+" bytes)");
  await fs.writeFile(destination,data);
  return {size:data.length,downloaded:true};
 }));
 for(const result of results){bytes+=result.size;if(result.downloaded)downloaded++}
}
const header=[
 "/*",
 " * Exact Pretendard Variable font subsets used by my-doctor.io.",
 " * Source: "+SOURCE_PAGE,
 " * Generated at build time from the original Next.js CSS; unicode ranges retained.",
 " * Font software license: SIL Open Font License 1.1 (see fonts/OFL.txt).",
 " */"
].join("\n");
await fs.writeFile(CSS_OUT,header+"\n"+unique.map(x=>x.rule).join("\n")+"\n","utf8");
console.log("MYDOCTOR_ORIGINAL_FONT_VENDOR "+JSON.stringify({
 source:SOURCE_PAGE,stylesheets:stylesheetUrls.length,faces:unique.length,
 downloaded_files:downloaded,bytes,css:CSS_OUT
}));
