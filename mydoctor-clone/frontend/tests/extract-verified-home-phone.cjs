/* Extracts only the observed decorative phone illustration region from the
 * original PUBLIC WEBSITE screenshot captured at HTTP 200 on 2026-11-09.
 * Never embeds an entire website screenshot as a fake functioning UI.
 * CTA overlay is removed from the illustration region and is rendered
 * separately as a real accessible button by WebsiteParityHome.jsx.
 */
const fs=require("node:fs");
const path=require("node:path");
const {PNG}=require("pngjs");
const root=path.resolve(__dirname,"..");
const src=path.join(root,"qa-original","source-full-home.png");
const dest=path.join(root,"public","website-original-phone.png");
if(!fs.existsSync(src))throw new Error("Verified original website phone source screenshot missing: "+src);
const original=PNG.sync.read(fs.readFileSync(src));
if(original.width!==390||original.height<1100)
 throw new Error("Unexpected original marketing screenshot dimensions "+original.width+"x"+original.height);
const start=525, overlayTop=782, overlayEnd=845, bottom=900;
/* The fixed original CTA hides 63 rows from 782–844. Stitch the
 * phone illustration without borrowing the NEXT SECTION's text from
 * y>900, and preserve source photo's true 375px occupied height.
 * Interpolated pixels are an explicit non-verified artwork gap, not
 * evidence that the phone's covered content is pixel-matched.
 */
const height=bottom-start;
const img=new PNG({width:390,height});
for(let y=0;y<height;y++){
 const sy=start+y;
 for(let x=0;x<390;x++){
  const outIdx=(y*390+x)*4;
  if(sy>=overlayTop&&sy<overlayEnd){
    const a=((overlayTop-1)*original.width+x)*4;
    const b=(overlayEnd*original.width+x)*4;
    const t=(sy-overlayTop+1)/(overlayEnd-overlayTop+1);
    for(let k=0;k<3;k++)
      img.data[outIdx+k]=Math.round((1-t)*original.data[a+k]+t*original.data[b+k]);
  }else{
    const inIdx=(sy*original.width+x)*4;
    img.data[outIdx]=original.data[inIdx];
    img.data[outIdx+1]=original.data[inIdx+1];
    img.data[outIdx+2]=original.data[inIdx+2];
  }
  img.data[outIdx+3]=255;
 }
}
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,PNG.sync.write(img));
console.log("SOURCE_OBSERVED_PHONE_ASSET",JSON.stringify({origin:"source-full-home.png",asset:"website-original-phone.png",size:[img.width,img.height],sourceRows:["525-781","845-899"],maskedCTA:"782-844 interpolated",status:"decorative public snapshot crop"}));

/* Copy only the small decorative laurel pictograms from the browser-verified
 * public screenshot. Text and all interactive elements remain React DOM. */
const homepagePng=PNG.sync.read(fs.readFileSync(path.join(root,"qa-original","origin-home.png")));
function saveOriginalLaurel(name,rect){
 const [left,top,right,bottom]=rect;
 const png=new PNG({width:right-left,height:bottom-top});
 for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++){
  const ii=((top+y)*homepagePng.width+left+x)*4;
  const oi=(y*png.width+x)*4;
  const red=homepagePng.data[ii],green=homepagePng.data[ii+1],blue=homepagePng.data[ii+2];
  png.data[oi]=red;png.data[oi+1]=green;png.data[oi+2]=blue;
  png.data[oi+3]=blue>red+22&&blue>green+10?255:0;
 }
 fs.writeFileSync(path.join(root,"public","website-laurel-"+name+".png"),PNG.sync.write(png));
}
saveOriginalLaurel("left",[66,291,81,315]);
saveOriginalLaurel("right",[312,291,327,315]);
console.log("SOURCE_OBSERVED_LAUREL_ASSETS_READY");


/* Decorative symptom/step pictograms cropped from the original 2026-11-09
 * HTTP-200 public browser screenshot, never a synthetic emoji substitute.
 * Source provenance is retained by QA artifact 42650015118.
 * Functional text, cards and click handlers remain live React DOM elements. */
const fullSource=PNG.sync.read(fs.readFileSync(src));
function captureIcon(file,x,y,w,h){
 const asset=new PNG({width:w,height:h});
 for(let row=0;row<h;row++){
  const begin=((y+row)*fullSource.width+x)*4;
  fullSource.data.copy(asset.data,row*w*4,begin,begin+w*4);
 }
 fs.writeFileSync(path.join(root,"public",file),PNG.sync.write(asset));
}
const observedRows=[1453,1569,1685,1821,1957,2073,2189];
for(let i=0;i<13;i++){
 const row=Math.floor(i/2), left=i%2===0?33:212;
 captureIcon("website-source-condition-"+i+".png",left,observedRows[row]+12,36,34);
}
for(const [i,y] of [1109,1200,1282].entries())
 captureIcon("website-source-step-"+i+".png",20,y,52,52);
console.log("SOURCE_OBSERVED_PUBLIC_PICTOGRAMS",JSON.stringify({
  base:"source-full-home.png",symptoms:13,steps:3,
  assetPurpose:"decorative icons only, no fake UI"}));


/* Source hospital-page brand and form pictograms, captured by the same
 * public original browser run. Extract images ONLY; text/input behavior
 * remains separately rendered and interactive, never baked into pixels. */
const hospitalOriginal=PNG.sync.read(fs.readFileSync(
 path.join(root,"qa-original","origin-hospital-search.png")));
function saveHospitalDecorativeAsset(name,x,y,width,height){
 const im=new PNG({width,height});
 for(let row=0;row<height;row++){
   const start=((row+y)*hospitalOriginal.width+x)*4;
   hospitalOriginal.data.copy(im.data,row*width*4,start,start+width*4);
 }
 fs.writeFileSync(path.join(root,"public","website-source-hospital-"+name+".png"),PNG.sync.write(im));
}
saveHospitalDecorativeAsset("brand",18,9,100,37);
saveHospitalDecorativeAsset("region",35,276,26,26);
saveHospitalDecorativeAsset("specialty",35,337,26,26);
saveHospitalDecorativeAsset("care",35,397,26,26);
console.log("SOURCE_HOSPITAL_PICTOGRAMS_READY");


/* Decorative hospital thumbnail from the independently preserved 2026-11-09
 * original public Mounjaro page, crop ONLY the actual provider photo.
 * This is not a baked-in UI or a fake hospital record. */
const originalMounjaroPng=PNG.sync.read(fs.readFileSync(
 path.join(root,"qa-original","origin-medical-cost-category.png")));
const photo=new PNG({width:73,height:49});
for(let row=0;row<49;row++){
 const start=((795+row)*originalMounjaroPng.width+281)*4;
 originalMounjaroPng.data.copy(photo.data,row*73*4,start,start+73*4);
}
fs.writeFileSync(path.join(root,"public","website-source-mounjaro-first-provider.png"),PNG.sync.write(photo));
console.log("VERIFIED_PUBLIC_MOUNJARO_PROVIDER_DECORATIVE_PHOTO_READY");


/* Extract ONLY the original health-page decorative illustrations (money icon
 * and clipboard), not headings, cards, CTAs or other interactive UI.
 * All interface content is rendered as React elements by WebsiteParityHealthLanding. */
const healthOriginal=PNG.sync.read(fs.readFileSync(
 path.join(root,"qa-original","origin-health-landing.png")));
if(healthOriginal.width!==390||healthOriginal.height!==844)
 throw new Error("Original health screenshot dimensions changed");
function saveHealthArt(name,x,y,width,height){
 const decor=new PNG({width,height});
 for(let row=0;row<height;row++){
  const begin=((y+row)*healthOriginal.width+x)*4;
  healthOriginal.data.copy(decor.data,row*width*4,begin,begin+width*4);
 }
 fs.writeFileSync(path.join(root,"public","website-source-health-"+name+".png"),PNG.sync.write(decor));
}
saveHealthArt("quiz",250,166,112,121);
saveHealthArt("test",258,469,92,135);
console.log("VERIFIED_SOURCE_HEALTH_DECORATIVE_ASSETS_READY");

/* Only the four visible doctor avatar illustrations/photographs cropped from
 * the authenticated original public website SCREENSHOT. Names, attributes
 * and links remain separate searchable interactive HTML elements. */
const hypertensionSource=PNG.sync.read(fs.readFileSync(
 path.join(root,"qa-original","origin-telemedicine-condition.png")));
if(hypertensionSource.width!==390||hypertensionSource.height!==844)
 throw Error("Unexpected hypertension source screenshot dimensions");
[326,476,592,742].forEach((top,i)=>{
 const face=new PNG({width:66,height:66});
 for(let y=0;y<66;y++){
  const begin=((top+y)*390+305)*4;
  hypertensionSource.data.copy(face.data,y*66*4,begin,begin+66*4);
 }
 fs.writeFileSync(path.join(root,"public","website-source-hypertension-avatar-"+i+".png"),PNG.sync.write(face));
});
console.log("VERIFIED_SOURCE_HYPERTENSION_DOCTOR_AVATARS_READY");
