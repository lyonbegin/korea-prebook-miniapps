const {chromium} = require("playwright");
const fs=require("fs");
const path=require("path");
const BASE=process.env.HERMES_PREVIEW_URL||"https://mydoctor-hermes-web-preview-production.up.railway.app";
const OUT=path.resolve(__dirname,"../hermes-preview-evidence");
fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:"ko-KR"});
 const page=await context.newPage();
 const result={url:BASE,viewport:"390x844",screens:[],jsErrors:[],requests:[],passed:false};
 page.on("pageerror",e=>result.jsErrors.push(e.message));
 page.on("response",response=>{
  const pathname=new URL(response.url()).pathname;
  if(pathname.startsWith("/native/catalog/"))
   result.requests.push({resource:pathname,status:response.status()});
 });
 try{
  const home=BASE+"/native/hermes-preview?screen=home";
  const response=await page.goto(home,{waitUntil:"domcontentloaded",timeout:35000});
  await page.getByTestId("hermes-source-home-nav").waitFor({timeout:25000});
  await page.getByTestId("hermes-source-medical").waitFor({timeout:25000});
  await page.waitForTimeout(3200);
  const header=await page.locator("h1").first().innerText();
  const firstNav=await page.getByTestId("hermes-source-home-nav").innerText();
  const medical=await page.getByTestId("hermes-source-medical").innerText();
  const navCount=await page.locator('[data-testid="hermes-source-home-nav"] [role="button"]').count();
  const pageDimensions=await page.evaluate(()=>{
    const e=document.scrollingElement;
    return {scrollHeight:e.scrollHeight,clientHeight:e.clientHeight};
  });
  await page.screenshot({path:path.join(OUT,"hermes-home-top.png"),fullPage:false});
  await page.evaluate(()=>window.scrollTo(0,document.scrollingElement.scrollHeight));
  await page.waitForTimeout(450);
  const bottomPosition=await page.evaluate(()=>window.scrollY);
  await page.screenshot({path:path.join(OUT,"hermes-home-bottom.png"),fullPage:false});
  if(!medical.includes("비대면 진료"))throw new Error("The verified native medical heading is missing");
  if(!firstNav.includes("병원/약국"))throw new Error("The verified hospital navigation card is missing");
  if(!bottomPosition||pageDimensions.scrollHeight<=pageDimensions.clientHeight)
    throw new Error("Home screen did not scroll");
  result.screens.push({screen:"home",http:response.status(),header,navCount,
   originalMenuLoaded:result.requests.some(x=>x.resource==="/native/catalog/home-menu"&&x.status===200),
   scrolling:true,scrollHeight:pageDimensions.scrollHeight,bottomPosition});
  const hospital=BASE+"/native/hermes-preview?screen=hospital-list";
  const hresp=await page.goto(hospital,{waitUntil:"domcontentloaded",timeout:35000});
  await page.getByText("병원 찾기",{exact:true}).first().waitFor({timeout:20000});
  await page.waitForTimeout(2600);
  await page.screenshot({path:path.join(OUT,"hermes-hospital-list.png"),fullPage:false});
  const isHospitalScreen=await page.locator('[data-native-hospital-list="hbc96"]').count();
  const hospitalState=await page.locator('[data-native-hospital-list="hbc96"]').getAttribute("data-native-state");
  if(!isHospitalScreen)throw new Error("Original HBC96 hospital listing is not rendered");
  result.screens.push({screen:"hospital-list",http:hresp.status(),hospitalState});
  if(result.jsErrors.length)throw new Error("Browser page error: "+result.jsErrors.join("; "));
  result.passed=true;
  console.log("HERMES_PREVIEW_REAL_BROWSER_PASS",JSON.stringify(result));
 }catch(error){
  result.error=String(error.stack||error);
  console.error("HERMES_PREVIEW_REAL_BROWSER_FAIL",JSON.stringify(result));
  process.exitCode=1;
 }finally{
  fs.writeFileSync(path.join(OUT,"report.json"),JSON.stringify(result,null,2));
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
