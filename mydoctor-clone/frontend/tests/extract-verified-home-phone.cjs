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
const start=525, overlayTop=782, overlayEnd=845, bottom=960;
const height=(overlayTop-start)+(bottom-overlayEnd);
const img=new PNG({width:390,height});
for(let y=0;y<height;y++){
 const sy=y<overlayTop-start?start+y:overlayEnd+y-(overlayTop-start);
 for(let x=0;x<390;x++){
  const inIdx=(sy*original.width+x)*4;
  const outIdx=(y*390+x)*4;
  img.data[outIdx]=original.data[inIdx];
  img.data[outIdx+1]=original.data[inIdx+1];
  img.data[outIdx+2]=original.data[inIdx+2];
  img.data[outIdx+3]=255;
 }
}
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,PNG.sync.write(img));
console.log("SOURCE_OBSERVED_PHONE_ASSET",JSON.stringify({origin:"source-full-home.png",asset:"website-original-phone.png",size:[img.width,img.height],sourceRows:["525-781","845-959"],status:"decorative public snapshot crop"}));
