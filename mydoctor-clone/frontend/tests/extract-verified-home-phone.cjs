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
