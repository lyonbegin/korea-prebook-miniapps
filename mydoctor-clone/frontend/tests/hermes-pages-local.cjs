const {chromium}=require("playwright");
const fs=require("fs");
const path=require("path");
const BASE=process.env.PAGES_TEST_URL||"http://127.0.0.1:4173/korea-prebook-miniapps/";
const OUT=path.resolve(__dirname,"../hermes-pages-evidence");
fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,
   isMobile:true,hasTouch:true,locale:"ko-KR"});
 const page=await context.newPage();
 const errors=[];const requests=[];const consoleErrors=[];const httpErrors=[];
 page.on("console",m=>{if(m.type()==="error")consoleErrors.push(m.text())});
 page.on("requestfailed",r=>httpErrors.push({url:r.url(),reason:r.failure()?.errorText}));
 page.on("response",r=>{if(r.status()>=400)httpErrors.push({url:r.url(),status:r.status()})});
 page.on("pageerror",e=>errors.push(e.message));
 page.on("request",req=>{if(/\/native\/catalog\//.test(req.url()))requests.push(req.url())});
 const data={base:BASE,errors,consoleErrors,httpErrors,apiRequests:requests,steps:[],passed:false};
 try{
  const response=await page.goto(BASE,{waitUntil:"networkidle",timeout:35000});
  if(response.status()!==200)throw Error("GitHub Pages home HTTP "+response.status());
  await page.waitForTimeout(1400);
  data.initialPage={title:await page.title(),html:(await page.content()).slice(0,1100),scripts:await page.locator("script[src]").evaluateAll(nodes=>nodes.map(n=>n.src))};
  console.log("GITHUB_PAGES_BOOT_DIAGNOSTIC",JSON.stringify({...data.initialPage,consoleErrors,httpErrors}));
  await page.getByTestId("github-pages-hermes-app").waitFor({timeout:10000});
  await page.getByTestId("website-parity-home").waitFor();
  const hero=await page.getByTestId("website-parity-home").innerText();
  if(!hero.includes("대한민국 1위")||!hero.includes("비대면 진료 앱"))
    throw Error("Original browser website marketing hero not displayed");
  if(!(await page.locator(".owh-phone-illustration img").evaluate(img=>img.complete&&img.naturalWidth>0)))
    throw Error("Original website phone illustration is missing");
  if(!await page.getByRole("button",{name:"나만의닥터 다운로드"}).count())
    throw Error("Source website fixed download control missing");
  await page.screenshot({path:path.join(OUT,"pages-home.png"),fullPage:true});
  const height=await page.evaluate(()=>document.scrollingElement.scrollHeight);
  await page.evaluate(()=>window.scrollTo(0,document.scrollingElement.scrollHeight));
  await page.waitForTimeout(300);
  if(height<=844 || await page.evaluate(()=>window.scrollY)<200)
    throw Error("Mobile source home is not scrollable");
  data.steps.push({screen:"home",websiteMarketingHero:true,scrollable:true,scrollHeight:height});
  // Verify the actual user journey from the home navigation card, not just bottom tabs.
  await page.getByRole("button",{name:"메뉴 열기"}).click();
  await page.getByRole("button",{name:"병원찾기",exact:true}).click();
  await page.getByTestId("website-parity-hospital").waitFor();
  if(!await page.getByRole("heading",{name:"근처 병원 찾기"}).count())throw Error("Original website hospital search UI missing");
  await page.screenshot({path:path.join(OUT,"pages-hospital-search.png"),fullPage:true});
  await page.locator(".ow-hospital-link-rows").getByRole("button",{name:"피부과",exact:true}).first().click();
  await page.getByTestId("original-department-landing").waitFor();
  if(!page.url().includes("screen=detail"))throw Error("Specialty navigation did not enter detail");
  if(await page.locator("text=원본 공개 페이지 열기").count())throw Error("Old external placeholder still displayed");
  if(!await page.getByRole("heading",{name:"근처 피부과 찾기"}).count())
    throw Error("Original source specialty landing heading missing");
  if(!await page.getByRole("button",{name:"병원 조회하기"}).count())
    throw Error("Original specialty region/condition lookup missing");
  if(await page.getByTestId("verified-hospital-list").count())
    throw Error("Root specialty incorrectly shows hospital cards before selection");
  await page.screenshot({path:path.join(OUT,"pages-dermatology-landing.png"),fullPage:true});
  await page.getByRole("button",{name:"서울 피부과 병원",exact:true}).first().click();
  await page.getByTestId("verified-specialty-screen").waitFor();
  if(await page.getByTestId("verified-hospital-list").locator(".gh-h-card").count()<10)
    throw Error("Dermatology Seoul hospital records missing after original first page");
  await page.getByRole("button",{name:"일요일진료",exact:true}).click();
  const sundayCount=await page.getByTestId("verified-hospital-list").locator(".gh-h-card").count();
  if(sundayCount<1)throw Error("Dermatology actual Sunday filter missing");
  await page.getByRole("button",{name:"경기",exact:true}).click();
  await page.getByTestId("verified-hospital-list").waitFor();
  if(await page.getByTestId("verified-hospital-list").locator(".gh-h-card").count()<10)
    throw Error("Gyeonggi dermatology hospitals did not load");
  await page.screenshot({path:path.join(OUT,"pages-dermatology-department.png"),fullPage:true});
  await page.getByTestId("verified-hospital-list").locator(".gh-h-card").first().click();
  await page.getByTestId("verified-hospital-profile").waitFor();
  if(!(await page.getByTestId("verified-hospital-profile").innerText()).includes("닥터스피부과의원"))
    throw Error("Real Gyeonggi dermatology hospital profile is absent");
  await page.getByRole("button",{name:"진료 조건",exact:true}).click();
  if(!(await page.getByTestId("verified-hospital-profile").innerText()).includes("야간"))
    throw Error("Original hospital hours label not shown in detail");
  await page.screenshot({path:path.join(OUT,"pages-hospital-detail.png"),fullPage:true});
  data.steps.push({screen:"hospital-list",search:"피부과",seoulHospitals:10,gyeonggiHospitals:10,sundayCount,profile:true});
  await page.goBack({waitUntil:"domcontentloaded"});
  await page.getByTestId("verified-specialty-screen").waitFor();
  await page.getByRole("button",{name:"병원 찾기로 뒤로"}).click();
  await page.getByTestId("website-parity-hospital").waitFor();
  await page.goto(BASE+"?screen=medical-cost",{waitUntil:"domcontentloaded"});
  await page.getByTestId("website-parity-medical-cost").waitFor();
  const categoryCards=page.locator(".ow-price-grid .ow-price-category");
  if(await categoryCards.count()<20)throw Error("Original price compare grid is incomplete");
  if(!(await page.getByTestId("website-parity-medical-cost").innerText()).includes("마운자로"))
    throw Error("Original price category labels are missing");
  await categoryCards.first().click();
  await page.getByTestId("pages-static-detail").waitFor();
  if(await page.locator('[data-detail-type="price"]').count()!==1)throw Error("Price detail screen missing");
  const priceText=await page.getByTestId("pages-static-detail").innerText();
  if(!priceText.includes("269,000원"))throw Error("Verified original Mounjaro price table was not rendered");
  if(priceText.includes("원본 공개 페이지 열기"))throw Error("External page button still exists");
  await page.screenshot({path:path.join(OUT,"pages-mounjaro-price.png"),fullPage:true});
  await page.reload({waitUntil:"domcontentloaded"});
  await page.getByTestId("pages-static-detail").waitFor();
  data.steps.push({screen:"medical-cost",verifiedPrice:"269,000원",reloaded:true});
  await page.goto(BASE+"?screen=detail&target="+encodeURIComponent("/telemedicine/고혈압-비대면진료-예약"),{waitUntil:"networkidle"});
  await page.getByTestId("pages-static-detail").waitFor();
  if(await page.locator('[data-detail-type="telemedicine"]').count()!==1)throw Error("Telemedicine detail missing");
  const doctors=await page.locator(".gh-d-doctor-row").count();
  if(doctors<1)throw Error("Verified original doctor records missing");
  data.steps.push({screen:"telemedicine",doctors});
  await page.goto(BASE+"?screen=detail&target="+encodeURIComponent("/hospital/야간진료"),{waitUntil:"networkidle"});
  await page.getByTestId("website-source-original-detail").waitFor();
  if(await page.locator('[data-source-view="hospital-night"]').count()!==1)throw Error("Original-specific night hospital view missing");
  const hospitalCount=await page.locator(".original-hospital-night-card").count();
  if(hospitalCount<1)throw Error("Verified original public night-hospital cards missing");
  data.steps.push({screen:"night-hospital",count:hospitalCount,sourceLayout:true});
  await page.goto(BASE+"?screen=detail&target="+encodeURIComponent("/pharmacy/야간약국"),{waitUntil:"networkidle"});
  await page.getByTestId("website-source-original-detail").waitFor();
  if(await page.locator('[data-source-view="pharmacy-list"]').count()!==1)throw Error("Original-specific pharmacy screen missing");
  const pharmacies=await page.locator(".original-pharmacy-card").count();
  if(pharmacies<1)throw Error("Verified original public pharmacy rows missing");
  await page.locator(".original-pharmacy-card h2>button").first().click();
  if(!await page.locator(".original-pharmacy-expanded").count())throw Error("Pharmacy detail expansion failed");
  data.steps.push({screen:"night-pharmacy",count:pharmacies,expanded:true,sourceLayout:true});
  for(const specialty of ["피부과","내과","이비인후과","정형외과","안과","소아청소년과","산부인과","성형외과","치과","비뇨의학과","정신건강의학과","신경과","신경외과","외과","재활의학과","마취통증의학과","가정의학과"]){
    await page.goto(BASE+"?screen=detail&target="+encodeURIComponent("/dept-hub/"+specialty),{waitUntil:"domcontentloaded"});
    await page.getByTestId("original-department-landing").waitFor();
    await page.getByRole("button",{name:"병원 조회하기"}).click();
    await page.getByTestId("verified-specialty-screen").waitFor();
    const n=await page.getByTestId("verified-hospital-list").locator(".gh-h-card").count();
    if(n<5)throw Error(specialty+" source landing to hospital-list failed: "+n);
    data.steps.push({specialty,sourceLanding:true,verifiedHospitals:n});
  }
  if(requests.length)throw Error("Static GitHub Pages attempted to call runtime API: "+JSON.stringify(requests));
  if(errors.length)throw Error("Browser JS errors: "+errors.join("; "));
  data.passed=true;
  console.log("GITHUB_PAGES_MOBILE_PASS "+JSON.stringify(data));
 }catch(error){
  data.error=String(error.stack||error);
  console.error("GITHUB_PAGES_MOBILE_FAIL "+JSON.stringify(data));
  process.exitCode=1;
 }finally{
  fs.writeFileSync(path.join(OUT,"report.json"),JSON.stringify(data,null,2));
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
