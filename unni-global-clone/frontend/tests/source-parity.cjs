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
       const response=await source.goto(pair.original,{waitUntil:"domcontentloaded",timeout:25000});
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
          changed_ratio_percent:x.changed_ratio,mean_pixel_delta:x.mean_pixel_delta,compared_pixels:x.compared_pixels,heatmap:heatmapFile,visual_parity_verified:x.changed_ratio===0};
       result.push(row);
       console.log("VISUAL AUDIT",pair.name,"mismatch",row.changed_ratio_percent+"%","(not a parity pass)");
     }catch(e){const row={page:pair.name,status:"UNVERIFIED",reason:String(e.message||e)};result.push(row);console.error("VISUAL AUDIT unavailable",pair.name,row.reason)}
     finally{await source.close();await clone.close()}
   }
 }finally{await browser.close();fs.writeFileSync("qa-artifacts/source-visual-parity.json",JSON.stringify({captured_at:new Date().toISOString(),viewport:{width:390,height:844},pages:result,meaning:"Pixel difference is for same-size initial viewport only; no claim of full-page, original-app or functional parity."},null,2))}
})();
