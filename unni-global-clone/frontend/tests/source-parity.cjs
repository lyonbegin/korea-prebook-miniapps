/* Source-vs-clone screenshot audit. Public pages only, GET-only.
 * Report mismatches; NEVER mark visually different screens as passed.
 */
const {chromium}=require("playwright");
const {PNG}=require("pngjs");
const fs=require("node:fs");
const path=require("node:path");
const base=process.env.UNNI_URL||"http://127.0.0.1:5173";
const pairs=[
 {name:"home",original:"https://unni.app/us",clone:"/"},
 {name:"event-70809",original:"https://unni.app/us/events/70809?optionId=d195122c-ee11-4090-94c1-29a439508bdd",clone:"/events/70809?optionId=d195122c-ee11-4090-94c1-29a439508bdd"},
 {name:"clinic-826",original:"https://unni.app/us/hospitals/826",clone:"/hospitals/826"},
 {name:"doctor-1502",original:"https://unni.app/us/doctors/1502",clone:"/doctors/1502"}
];
// GitHub-hosted browsers receive HTTP 403 from the public site's edge.
// Route anonymous, GET-only unni.app resources through the already deployed
// independent gateway to inspect the same unmodified public representation.
// This is NOT an authenticated source session or a claim of pixel parity.
const gateway=process.env.UNNI_ORIGIN_GATEWAY||"https://unni-mobile-api-production.up.railway.app";
async function sourceThroughPublicGateway(page){
 const metrics={requests:0,successful:0,failed:0,assets:0};
 await page.route(/^https:\/\/(?:www\.)?unni\.app\//,async route=>{
   const req=route.request();
   if(req.method()!=="GET"){await route.abort();return}
   const u=new URL(req.url());
   // Only anonymous original global pages and their own public assets.
   if(!u.pathname.startsWith("/us")&&!u.pathname.startsWith("/_next/")&&!/\.(?:css|js|woff2?|svg|png|jpg|jpeg|webp|ico)$/.test(u.pathname)){
     await route.abort();return;
   }
   metrics.requests++;
   try{
     const resp=await fetch(gateway+"/gateway/public-web"+u.pathname+u.search,{
       headers:{Accept:req.headers().accept||"*/*","Accept-Language":"en"},
       signal:AbortSignal.timeout(18000)
     });
     if(resp.ok)metrics.successful++;else metrics.failed++;
     if(u.pathname.includes("/_next/"))metrics.assets++;
     const contentType=resp.headers.get("content-type")||"application/octet-stream";
     await route.fulfill({status:resp.status,headers:{"content-type":contentType},
       body:Buffer.from(await resp.arrayBuffer())});
   }catch{metrics.failed++;await route.abort()}
 });
 return metrics;
}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function compare(a,b){
 const l=PNG.sync.read(a),r=PNG.sync.read(b);
 const width=Math.min(l.width,r.width),height=Math.min(l.height,r.height);
 const diff=new PNG({width,height}),count=width*height;
 let changed=0,sum=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const o=(y*l.width+x)*4,p=(y*r.width+x)*4,d=(y*width+x)*4;
   const v=(Math.abs(l.data[o]-r.data[p])+Math.abs(l.data[o+1]-r.data[p+1])+Math.abs(l.data[o+2]-r.data[p+2]))/3;
   sum+=v;if(v>24)changed++;
   diff.data[d]=Math.min(255,Math.round(v*3));diff.data[d+1]=0;diff.data[d+2]=0;diff.data[d+3]=255;
 }
 return {changed_ratio:Math.round(changed/count*10000)/100,mean_pixel_delta:Math.round(sum/count*100)/100,compared_pixels:count,heatmap:PNG.sync.write(diff)};
}
(async()=>{
 fs.mkdirSync("qa-artifacts",{recursive:true});
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const result=[];
 try{
   for(const pair of pairs){
     const source=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
     const clone=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
     try{
       const gatewayMetrics=await sourceThroughPublicGateway(source);
       const response=await source.goto(pair.original,{waitUntil:"domcontentloaded",timeout:30000});
       if(!response?.ok())throw Error("Original HTTP "+response?.status());
       await clone.goto(base+pair.clone,{waitUntil:"domcontentloaded",timeout:25000});
       await clone.locator(".loading-screen").waitFor({state:"hidden",timeout:20000}).catch(()=>{});
       await Promise.all([source.evaluate(()=>document.fonts?.ready).catch(()=>{}),clone.evaluate(()=>document.fonts?.ready).catch(()=>{})]);
       await delay(1200);
       const s=await source.screenshot({path:path.join("qa-artifacts","original-"+pair.name+".png")});
       const c=await clone.screenshot({path:path.join("qa-artifacts","clone-"+pair.name+".png")});
       const x=compare(s,c);
       const heatmapFile="diff-"+pair.name+".png";
       fs.writeFileSync(path.join("qa-artifacts",heatmapFile),x.heatmap);
       const headings=async p=>p.locator("main h1, main h2, main h3").allTextContents();
       const row={page:pair.name,source_url:pair.original,clone_url:base+pair.clone,source_headings:(await headings(source)).slice(0,100),clone_headings:(await headings(clone)).slice(0,100),
          changed_ratio_percent:x.changed_ratio,mean_pixel_delta:x.mean_pixel_delta,compared_pixels:x.compared_pixels,heatmap:heatmapFile,visual_parity_verified:x.changed_ratio===0,
          source_mode:"anonymous-original-via-public-gateway",gateway_metrics:gatewayMetrics};
       result.push(row);
       console.log("VISUAL AUDIT",pair.name,"mismatch",row.changed_ratio_percent+"%","(not a parity pass)");
     }catch(e){const row={page:pair.name,status:"UNVERIFIED",reason:String(e.message||e)};result.push(row);console.error("VISUAL AUDIT unavailable",pair.name,row.reason)}
     finally{await source.close();await clone.close()}
   }
 }finally{await browser.close();fs.writeFileSync("qa-artifacts/source-visual-parity.json",JSON.stringify({captured_at:new Date().toISOString(),viewport:{width:390,height:844},pages:result,meaning:"Comparison is anonymous original SSR/assets served through public read-only gateway; initial viewport 390x844 only. Not proof of full page, logged-in, Android app, or real booking parity."},null,2))}
})();
