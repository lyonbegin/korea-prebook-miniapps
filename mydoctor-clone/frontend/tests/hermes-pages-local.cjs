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
  await page.getByTestId("hermes-source-home-nav").waitFor();
  await page.getByTestId("hermes-source-medical").waitFor();
  const card=page.getByTestId("hermes-source-home-nav");
  for(const text of ["병원/약국","다이어트","수액"]){
    if(!(await card.innerText()).includes(text))throw Error("Missing source-derived card "+text);
  }
  if(!(await page.getByTestId("hermes-source-medical").innerText()).includes("비대면 진료"))
    throw Error("Native medical section missing");
  if(await page.locator('text=연결되지 않은 원본 데이터').count())
    throw Error("GitHub Pages unexpectedly depends on the live API");
  await page.screenshot({path:path.join(OUT,"pages-home.png"),fullPage:true});
  const height=await page.evaluate(()=>document.scrollingElement.scrollHeight);
  await page.evaluate(()=>window.scrollTo(0,document.scrollingElement.scrollHeight));
  await page.waitForTimeout(300);
  if(height<=844 || await page.evaluate(()=>window.scrollY)<200)
    throw Error("Mobile source home is not scrollable");
  data.steps.push({screen:"home",sourceCards:3,scrollable:true,scrollHeight:height});
  await page.getByRole("link",{name:"병원 찾기"}).last().click();
  await page.getByTestId("pages-static-directory").waitFor();
  await page.getByRole("searchbox",{name:"병원 찾기 검색"}).fill("피부과");
  const buttons=page.locator(".gh-directory-row");
  if(await buttons.count()<1)throw Error("Static hospital menu search did not produce result");
  await page.screenshot({path:path.join(OUT,"pages-hospital-search.png"),fullPage:true});
  await buttons.first().click();
  await page.getByTestId("verified-specialty-screen").waitFor();
  if(!page.url().includes("screen=detail"))throw Error("Specialty navigation did not enter detail");
  if(await page.locator("text=원본 공개 페이지 열기").count())throw Error("Old external placeholder still displayed");
  if(await page.getByTestId("verified-hospital-list").locator(".gh-h-card").count()<10)
    throw Error("Dermatology Seoul hospital records missing");
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
  await page.getByTestId("pages-static-directory").waitFor();
  await page.getByRole("link",{name:"가격 비교"}).last().click();
  await page.getByTestId("pages-static-directory").waitFor();
  if(!(await page.getByTestId("pages-static-directory").innerText()).includes("마운자로"))
    throw Error("Verified public price navigation is missing");
  await page.getByRole("button",{name:"마운자로 상세"}).first().click();
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
  await page.getByTestId("pages-static-detail").waitFor();
  if(await page.locator('[data-detail-type="hospital-collection"]').count()!==1)throw Error("Night hospital view missing");
  const hospitalCount=await page.locator(".gh-d-hospital-card").count();
  if(hospitalCount<1)throw Error("Verified hospital listing missing");
  data.steps.push({screen:"night-hospital",count:hospitalCount});
  await page.goto(BASE+"?screen=detail&target="+encodeURIComponent("/pharmacy/야간약국"),{waitUntil:"networkidle"});
  await page.getByTestId("pages-static-detail").waitFor();
  if(await page.locator('[data-detail-type="pharmacy"]').count()!==1)throw Error("Pharmacy detail missing");
  const pharmacies=await page.locator(".gh-d-pharmacy-card").count();
  if(pharmacies<1)throw Error("Verified original pharmacy rows missing");
  await page.locator(".gh-d-pharmacy-card>button").first().click();
  if(!await page.locator(".gh-d-pharmacy-expanded").count())throw Error("Pharmacy detail expansion failed");
  data.steps.push({screen:"night-pharmacy",count:pharmacies,expanded:true});
  for(const specialty of ["피부과","내과","이비인후과","정형외과","안과","소아청소년과","산부인과","성형외과"]){
    await page.goto(BASE+"?screen=detail&target="+encodeURIComponent("/dept-hub/"+specialty),{waitUntil:"domcontentloaded"});
    await page.getByTestId("verified-specialty-screen").waitFor();
    const n=await page.getByTestId("verified-hospital-list").locator(".gh-h-card").count();
    if(n<5)throw Error(specialty+" must show actual, source-verified hospital cards: "+n);
    data.steps.push({specialty,verifiedHospitals:n});
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
