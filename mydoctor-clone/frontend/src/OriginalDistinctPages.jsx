import React,{useState} from "react";
import {ChevronRight,ChevronDown,Search,ArrowLeft,Clock3,MapPin,Phone,Navigation,Check,Info,X} from "lucide-react";
import "./OriginalDistinctPages.css";
const ORIGINAL="https://my-doctor.io";
const DOCTOR_IMG="https://d2z2hg32ezl0nv.cloudfront.net/prod/doctor_image/5f62616f-4490-4ac7-8ddf-74c7d5973d44.png?Expires=1794299700&Signature=PyvfHBTmEBpNG7ONoMiICUoYyP6mTWEaxp0MBjCkfv1-VuFHcKmNCbdkkcGcdgyRj3yoREQNhA2Gyb~mJtySmlDrQQaivbcv2whLDyA~aObbNyruhNVUG-Up-4F1~d~u36pOwD~-dqsFSMBNq2WtlqvdEfgkAyN0VCAhHS4IGMyMIJFdzFMmGKZX31Wq3MHBEVeTZJJEZ1emaraVnYjgHwuDRhe3J0RpXFok2zrHoiqFfR-XaIECwtTU2tVDDEtO1iseve9LeQOTVpsfDbHf3wtBKeVr43jQggX9wdXyzNCSjXPyMQ2HIgc~RwCGd3NrbgjfHfrrX6SHdmjCL6GWSA__&Key-Pair-Id=K1KBD7YCR39R8N";
const HOSPITAL_IMAGES={"더셀피부과의원":"https://img.my-doctor.io/_/czM6Ly9teWRvY3Rvci1wdWJsaWMvcHJvZC9ob3NwaXRhbF9pbWFnZS84ODkwNjQ4Zi03YzIzLTRmYjUtYTRmMC01ODgxNDc1MjcxYmQuanBn.webp","365평택연세정형외과의원":"https://img.my-doctor.io/_/czM6Ly9teWRvY3Rvci1wdWJsaWMvcHJvZC9ob3NwaXRhbF9pbWFnZS80ZjgwOGQ4NS1iNmU3LTQ4NGItYmRlMy00ODRiNWNhMzljNjcuanBn.webp","약손한의원":"https://img.my-doctor.io/_/czM6Ly9teWRvY3Rvci1wdWJsaWMvcHJvZC9ob3NwaXRhbF9pbWFnZS9jNmExYTU0YS0xMGU2LTQ3MTctOWFkNy05OTM3NjVkYmJjMjcuanBn.webp","삼성 톡스앤필의원":"https://img.my-doctor.io/_/czM6Ly9teWRvY3Rvci1wdWJsaWMvcHJvZC9ob3NwaXRhbF9pbWFnZS9lOWNiMjlmNi0xZDBhLTQ5MDctODJiZi02OTk5YTFiZWNjN2IuanBn.webp","유어힐의원":"https://img.my-doctor.io/_/czM6Ly9teWRvY3Rvci1wdWJsaWMvcHJvZC9ob3NwaXRhbF9pbWFnZS81ZWE2ZTFlOC1hMTcyLTQ5YmUtYmQ5Yy1iNmFiZGZlOWRiZjAuanBn.webp","더베스트삼성정형외과의원":"https://img.my-doctor.io/_/czM6Ly9teWRvY3Rvci1wdWJsaWMvcHJvZC9ob3NwaXRhbF9pbWFnZS9mYWQzZjdiYy00YTA0LTQ2ZGUtOTBmZi04MTc2MTAxZjBmOGYuanBn.webp","아르의원":"https://img.my-doctor.io/_/czM6Ly9teWRvY3Rvci1wdWJsaWMvcHJvZC9ob3NwaXRhbF9pbWFnZS9jNDkwMmYzYy00ZjJkLTQ4YzEtYWFhZC1jNGNiNzY1MmI1YjYuanBn.webp","연세리더스마취통증의학과의원":"https://img.my-doctor.io/_/czM6Ly9teWRvY3Rvci1wdWJsaWMvcHJvZC9ob3NwaXRhbF9pbWFnZS9kZjAwODc0Mi0xMTgyLTQ2MDQtOGEyOS0xZmJhNzdlYWQ3ZmYuanBn.webp","365부천튼튼재활의학과의원":"https://img.my-doctor.io/_/czM6Ly9teWRvY3Rvci1wdWJsaWMvcHJvZC9ob3NwaXRhbF9pbWFnZS83MjRmNmFiMi1kNmVkLTQ2NjMtOTBhYi1hYmQ3YmU5ZmRhNTIuanBn.webp","리에의원":"https://img.my-doctor.io/_/czM6Ly9teWRvY3Rvci1wdWJsaWMvcHJvZC9ob3NwaXRhbF9pbWFnZS82NmI5MTI5Zi0wNmYwLTRiNmUtYmVhMS1mOWQ0NjE3ZTY3YTkuanBn.webp","시흥배곧 닥터에버스의원":"https://img.my-doctor.io/_/czM6Ly9teWRvY3Rvci1wdWJsaWMvcHJvZC9ob3NwaXRhbF9pbWFnZS85Yjg2ZTlmNC1kMGViLTQ1ZGYtYmY1Ni04ODNmMGQzMzA2ODIuanBn.webp","대실대나무정형외과의원":"https://img.my-doctor.io/_/czM6Ly9teWRvY3Rvci1wdWJsaWMvcHJvZC9ob3NwaXRhbF9pbWFnZS80NTliZmRhOC1jODI4LTQwMDAtOTZmZS0yYzc1MGZmZDQ0ZjguanBn.webp"};
const QNA_CHIPS=[{"path":"/qna/%EC%A0%95%ED%98%95%EC%99%B8%EA%B3%BC","label":"정형외과"},{"path":"/qna/%EB%82%B4%EA%B3%BC","label":"내과"},{"path":"/qna/%EC%86%8C%ED%99%94%EA%B8%B0%EB%82%B4%EA%B3%BC","label":"소화기내과"},{"path":"/qna/%ED%94%BC%EB%B6%80%EA%B3%BC","label":"피부과"},{"path":"/qna/%EC%8B%A0%EA%B2%BD%EA%B3%BC","label":"신경과"},{"path":"/qna/%EC%9D%B4%EB%B9%84%EC%9D%B8%ED%9B%84%EA%B3%BC","label":"이비인후과"},{"path":"/qna/%EB%B9%84%EB%87%A8%EC%9D%98%ED%95%99%EA%B3%BC","label":"비뇨의학과"},{"path":"/qna/%EC%82%B0%EB%B6%80%EC%9D%B8%EA%B3%BC","label":"산부인과"},{"path":"/qna/%EA%B0%80%EC%A0%95%EC%9D%98%ED%95%99%EA%B3%BC","label":"가정의학과"},{"path":"/qna/%EC%A0%95%EC%8B%A0%EA%B1%B4%EA%B0%95%EC%9D%98%ED%95%99%EA%B3%BC","label":"정신건강의학과"},{"path":"/qna/%EC%95%88%EA%B3%BC","label":"안과"},{"path":"/qna/%EC%99%B8%EA%B3%BC","label":"외과"},{"path":"/qna/%EB%8C%80%EC%9E%A5%ED%95%AD%EB%AC%B8%EC%99%B8%EA%B3%BC","label":"대장항문외과"},{"path":"/qna/%EC%8B%A0%EA%B2%BD%EC%99%B8%EA%B3%BC","label":"신경외과"},{"path":"/qna/%EC%B9%98%EA%B3%BC","label":"치과"},{"path":"/qna/%ED%98%B8%ED%9D%A1%EA%B8%B0%EB%82%B4%EA%B3%BC","label":"호흡기내과"},{"path":"/qna/%EC%98%81%EC%83%81%EC%9D%98%ED%95%99%EA%B3%BC","label":"영상의학과"},{"path":"/qna/%EA%B5%AC%EA%B0%95%EB%82%B4%EA%B3%BC","label":"구강내과"},{"path":"/qna/%EC%A7%81%EC%97%85%ED%99%98%EA%B2%BD%EC%9D%98%ED%95%99%EA%B3%BC","label":"직업환경의학과"},{"path":"/qna/%EB%A7%88%EC%B7%A8%ED%86%B5%EC%A6%9D%EC%9D%98%ED%95%99%EA%B3%BC","label":"마취통증의학과"},{"path":"/qna/%EC%9E%AC%ED%99%9C%EC%9D%98%ED%95%99%EA%B3%BC","label":"재활의학과"},{"path":"/qna/%EA%B5%AC%EA%B0%95%EC%95%85%EC%95%88%EB%A9%B4%EC%99%B8%EA%B3%BC","label":"구강악안면외과"},{"path":"/qna/%EC%8B%A0%EC%9E%A5%EB%82%B4%EA%B3%BC","label":"신장내과"},{"path":"/qna/%EC%86%8C%EC%95%84%EC%B2%AD%EC%86%8C%EB%85%84%EA%B3%BC","label":"소아청소년과"},{"path":"/qna/%EC%86%8C%EC%95%84%EC%A0%95%EC%8B%A0%EA%B0%80%EC%A0%95%EC%9D%98%ED%95%99%EA%B3%BC","label":"소아정신가정의학과"},{"path":"/qna/%ED%9D%89%EB%B6%80%EC%99%B8%EA%B3%BC","label":"흉부외과"},{"path":"/qna/%EC%A7%84%EB%8B%A8%EA%B2%80%EC%82%AC%EC%9D%98%ED%95%99%EA%B3%BC","label":"진단검사의학과"},{"path":"/qna/%ED%95%B5%EC%9D%98%ED%95%99%EA%B3%BC","label":"핵의학과"},{"path":"/qna/%EC%B9%98%EA%B3%BC%EB%B3%B4%EC%B2%A0%EA%B3%BC","label":"치과보철과"},{"path":"/qna/%EC%B9%98%EA%B3%BC%EA%B5%90%EC%A0%95%EA%B3%BC","label":"치과교정과"},{"path":"/qna/%EC%86%8C%EC%95%84%EC%B9%98%EA%B3%BC","label":"소아치과"},{"path":"/qna/%EC%B9%98%EC%A3%BC%EA%B3%BC","label":"치주과"},{"path":"/qna/%ED%95%9C%EB%B0%A9%EB%82%B4%EA%B3%BC","label":"한방내과"},{"path":"/qna/%ED%95%9C%EB%B0%A9%EC%9E%AC%ED%99%9C%EC%9D%98%ED%95%99%EA%B3%BC","label":"한방재활의학과"},{"path":"/qna/%EC%A2%85%EC%96%91%ED%95%99%EA%B3%BC","label":"종양학과"}];

/** Dedicated mobile layouts copied from inspected public originals, never generated
 * from generic search rows. All record prices, patient-safe links and exact headings
 * arrive from the persisted original facts database. */
const digits=n=>String(n||"").replace(/,/g,"");
function Anchor({path,go,children,className=""}) {
 return <a className={className} href={path} onClick={e=>{e.preventDefault();go(path)}}>{children}</a>;
}
function Archive({data,go}) {
 return <details className="original-record-archive">
  <summary>원본 공개 자료·관련 경로 전체 보기</summary>
  <div className="original-record-headings">{data.sections?.map((s,i)=><h2 key={i}>{s.heading}</h2>)}</div>
  {data.links?.map((x,i)=><Anchor path={x.path} go={go} key={x.path+"-"+i}>{x.label}</Anchor>)}
  {data.tables?.map((t,i)=><table key={i}><thead><tr>{t.headers?.map((v,j)=><th key={j}>{v}</th>)}</tr></thead><tbody>{t.rows.map((row,j)=><tr key={j}>{row.map((v,k)=><td key={k}>{v}</td>)}</tr>)}</tbody></table>)}
 </details>;
}
function DoctorDetail({data,go}) {
 const [tab,setTab]=useState("의사 정보");
 const hospitalLink=data.links?.find(x=>x.path.includes("hospital/detail"))?.path;
 const sections=["허훈 의사 진료과목","허훈 의사 비대면 진료시간","허훈 의사 약력","허훈 의사 소개"];
 return <div className="original-doctor-profile" data-source-view="doctor-detail">
  <div className="original-doctor-portrait"><img alt="허훈 의사" src={DOCTOR_IMG}/>
   <button type="button" className="original-doctor-back" onClick={()=>go("/telemedicine/all-department")} aria-label="이전 화면"><ArrowLeft size={22}/></button>
  </div>
  <div className="original-doctor-head"><p>한사랑패밀리의원</p><h1>{data.title}</h1><small>준비 중 <span aria-label="진료 상태">◉</span></small></div>
  <nav className="original-doctor-tabs" aria-label="의사 정보 탭">{["의사 정보","진료비","리뷰 (22)"].map(x=><button type="button" className={x===tab?"current":""} onClick={()=>setTab(x)} key={x}>{x}</button>)}</nav>
  {tab==="의사 정보"?<div className="original-doctor-information">
   <h2>{sections[0]}</h2><p>산부인과, 내과, 이비인후과, 비뇨의학과</p>
   <h2>{sections[1]}</h2><div className="original-doctor-week">{["월","화","수","목","금","토","일"].map(day=><div key={day}>{day} <span>정기 휴진일</span></div>)}</div>
   <h2>{sections[2]}</h2><p>현)한사랑패밀리의원 원장</p>
   <h2>{sections[3]}</h2><p>안녕하세요 한사랑패밀리의원의 허훈의사입니다</p>
   {hospitalLink&&<Anchor path={hospitalLink} go={go} className="original-doctor-hospital">한사랑패밀리의원 병원 상세 보기 <ChevronRight size={18}/></Anchor>}
  </div>:tab==="리뷰 (22)"?<section className="original-doctor-information"><h2>허훈 리뷰</h2><p>후기 22건</p>{hospitalLink&&<Anchor go={go} path={hospitalLink}>원본 병원 정보 보기</Anchor>}</section>:<section className="original-doctor-information"><h2>허훈 의사 진료비</h2><h3>산부인과 진료비</h3></section>}
  <div className="original-doctor-booking"><p>안전한 예약을 위해 카카오 3초 로그인이 필요해요.</p><a href={ORIGINAL+"/telemedicine/doctor/한사랑패밀리의원-허훈-10"} target="_blank" rel="noreferrer">예약하기</a></div>
  <Archive data={data} go={go}/>
 </div>;
}
function HospitalNight({data,go}) {
 const [search,setSearch]=useState(""),[region,setRegion]=useState("전국");
 const source=(data.links||[]).filter(x=>x.path.includes("/hospital/detail?hospital_id="));
 const cards=source.map(x=>{
  const m=x.label.match(/^(.+?) 야간 진료 \(([^)]+)\) (\d{2}:\d{2} ~ \d{2}:\d{2}) (.*)$/);
  return {path:x.path,name:m?.[1]||x.label.split(" 야간 진료")[0],time:m?.[3]||"",day:m?.[2]||"",details:m?.[4]||"",label:x.label};
 }).filter(c=>(!search||c.label.includes(search))&&(region==="전국"||c.label.includes(region)));
 return <div className="original-hospital-night" data-source-view="hospital-night">
   <header><h1>{data.title}</h1><p>나만의닥터에서 조회한 18361개 전국 야간 문 연 진료 병원의 위치, 영업시간, 전문의 여부를 알려드릴게요.</p></header>
   <label className="original-hospital-night-search"><Search size={20}/><input value={search} onChange={e=>setSearch(e.target.value)} aria-label="병원·지역 검색" placeholder="병원·지역 검색"/></label>
   <div className="original-hospital-night-regions">{["전국","서울","경기","인천","부산","대구"].map(x=><button key={x} className={region===x?"current":""} onClick={()=>setRegion(x)}>{x}</button>)}</div>
   <div className="original-hospital-night-list">{cards.map(c=><Anchor go={go} path={c.path} className="original-hospital-night-card" key={c.path}>
     <div><h2>{c.name}</h2><p className="original-hospital-night-time"><Clock3 size={14}/>야간 진료 ({c.day}) {c.time}</p>
       <p className="original-hospital-night-location"><MapPin size={14}/>{c.details.replace(/토요일 진료.*$/,"").replace(/일요일 진료.*$/,"").replace(/야간 진료.*$/,"").trim()}</p>
       <div className="original-hospital-night-tags">{["토요일 진료","일요일 진료","야간 진료"].filter(z=>c.details.includes(z)).map(z=><span key={z}>{z}</span>)}</div>
     </div>{HOSPITAL_IMAGES[c.name]&&<img src={HOSPITAL_IMAGES[c.name]} alt={c.name}/>}
   </Anchor>)}</div>
   {data.tables?.length>0&&<section className="original-hospital-night-fees"><h2>야간 진료비</h2><div className="original-price-tables"><PriceTable table={data.tables[0]}/></div></section>}
   <Archive data={data} go={go}/>
  </div>;
}
function PriceTable({table}) {return <table className="original-source-pricetable"><thead><tr>{table.headers.map((c,i)=><th key={i}>{c}</th>)}</tr></thead><tbody>{table.rows.map((cells,j)=><tr key={j}>{cells.map((c,k)=><td key={k}>{c}</td>)}</tr>)}</tbody></table>}
function PriceCompare({data,go,route}) {
 const isAcne=route.includes("/여드름약/"),spec=isAcne?"여드름약(이소티논, 니메겐 등 이소트레티노인)":"마운자로";
 const [region,setRegion]=useState("전국"),[type,setType]=useState(isAcne?"여드름약":"마운자로/젭바운드 등"),[dose,setDose]=useState(isAcne?"이소트레티노인":"2.5mg"),[amount,setAmount]=useState(isAcne?"1개월":"1팩"),[tab,setTab]=useState("처방 병원");
 const clinic=data.tables?.[0]?.rows||[],pharma=data.tables?.[1]?.rows||[];
 const price=(xs,i,j)=>xs[i]?.[j]||"";
 const first=price(pharma,0,1),avg=price(pharma,1,1),consult=price(clinic,1,1),consultMin=price(clinic,0,1);
 const count=isAcne?"2,390":"2,567";
 const summary=isAcne?"나만의닥터에서 수집한 전국 여드름약(이소티논, 니메겐 등 이소트레티노인) 1개월 가격("+count+"곳 기준, 2026-11-09)은 약국 약제비 평균 "+avg+", 최저 "+first+"이며, 병원 처방비 평균 "+consult+", 최저 "+consultMin+"입니다.":
 "나만의닥터에서 수집한 전국 마운자로 1팩 가격("+count+"곳 기준, 2026-11-09)은 약국 약제비 평균 "+avg+", 최저 "+first+"이며, 병원 처방비 평균 "+consult+", 최저 "+consultMin+"입니다.";
 const destinations=data.links?.filter(x=>x.path.includes("/hospital/detail"))||[];
 const mapLink=data.links?.find(x=>x.path.startsWith("/map/"))?.path;
 return <div className="original-price-compare" data-source-view="price-comparison">
  <section className="original-price-intro"><h1>{data.title}</h1><p>{summary}</p></section>
  <div className="original-price-form">
   <label className="original-price-region">지역<select value={region} onChange={e=>setRegion(e.target.value)} aria-label="가격 비교 지역">{["전국","서울","경기","인천","부산","대구","대전","광주"].map(x=><option key={x}>{x}</option>)}</select></label>
   <div className="original-price-twocol">
    <label>카테고리<select value={type} onChange={e=>setType(e.target.value)} aria-label="약품 카테고리">{(isAcne?["여드름약"]:["마운자로/젭바운드 등","위고비"]).map(x=><option key={x}>{x}</option>)}</select></label>
    <label>{isAcne?"성분":"용량"}<select value={dose} onChange={e=>setDose(e.target.value)} aria-label="약품 용량">{(isAcne?["이소트레티노인","니메겐"]:["2.5mg","5mg","7.5mg","10mg"]).map(x=><option key={x}>{x}</option>)}</select></label>
   </div>
   <label>용량<select value={amount} onChange={e=>setAmount(e.target.value)} aria-label="처방 수량">{(isAcne?["1개월","2개월","3개월"]:["1팩","2팩","3팩"]).map(x=><option key={x}>{x}</option>)}</select></label>
   <button type="button" className="original-price-submit" onClick={()=>{document.querySelector("#source-price-results")?.scrollIntoView({behavior:"smooth",block:"start"})}}>병원/약국 가격 조회하기</button>
  </div>
  <section id="source-price-results" className="original-price-results">
   <div className="original-price-mode">{["처방 병원","최저가 약국"].map(x=><button type="button" className={tab===x?"selected":""} onClick={()=>setTab(x)} key={x}>{x}</button>)}</div>
   <h2>전국 {spec} 처방 병원 저렴한 곳</h2>
   <div>{destinations.slice(0,15).map(x=><Anchor path={x.path} go={go} key={x.path} className="original-price-hospital-entry">{x.label}<ChevronRight size={16}/></Anchor>)}</div>
   {data.tables?.map((t,i)=><div className="original-price-tablewrap" key={i}><h2>{i===0?"병원 처방비":"약국 약제비"}</h2><PriceTable table={t}/></div>)}
   {mapLink&&<Anchor go={go} path={mapLink} className="original-price-maplink">가격 지도 보기</Anchor>}
  </section>
  <Archive data={data} go={go}/>
 </div>;
}
function MedicineDetail({data,go}) {
 const name="0.9% 엔에이시엘.케이40주";
 const [open,setOpen]=useState(false);
 return <div className="original-drug-detail" data-source-view="drug-detail">
  <section className="original-drug-intro">
   <div className="original-drug-manufacturer">전문의약품 · 제이더블유생명과학(주)</div>
   <h1>{data.title}</h1>
   <p className="original-drug-reviewed">나만의닥터 검수 · 최종 검토일 2026-10-16</p>
   <p>{name}는 염화나트륨과 염화칼륨을 함유하여 수분과 전해질을 보급하는 주사제입니다.</p>
   <p>허가 품목명 &nbsp; 0.9%엔에이시엘.케이40주</p>
  </section>
  <section className="original-drug-symptoms">
   <h2>{name} 관련 증상이 있으신가요?</h2>
   <span>전문의약품</span>
   <p>비대면 진료는 향정신성의약품, 사후피임약, 발기부전제, 마약성 의약품 처방, 다이어트 의약품을 제외한 의약품의 처방이 가능해요. 단, 응급실 방문이 필요하거나, 반드시 대면에서 의료진의 처치가 필요한 경우 비대면 진료는 보조 장치로 사용하고 서둘러 인근 병원에 방문해주세요.</p>
   <p>나만의닥터에서 진료를 받고 약 정보를 찾아보세요.</p>
   <a href={ORIGINAL+"/medicine/0.9-엔에이시엘.케이40주-200710605"} target="_blank" rel="noreferrer">나만의닥터 앱 열기</a>
  </section>
  <section className="original-drug-content">
   <h2>{name} 효능</h2><p>{name}는 탈수증이 있거나 수술 전후에 수분과 전해질을 보급하는 데 사용합니다.</p>
   <h2>{name} 복용법</h2><p>{name}는 정맥주사로 투여합니다. 투여량과 투여 속도는 환자의 상태에 따라 의사가 결정합니다.</p>
   <h2>{name} 부작용</h2><p>발열, 주사 부위 감염, 정맥염, 혈관 밖 유출, 국소 통증, 구역, 구토, 복통, 설사 등이 나타날 수 있습니다.</p>
   <button type="button" onClick={()=>setOpen(!open)} aria-expanded={open}>그 외 성분·효능 보기 <ChevronDown size={16}/></button>
   {open&&<div>{data.links?.map(x=><Anchor path={x.path} go={go} key={x.path}>{x.label}</Anchor>)}</div>}
   {data.tables?.map((t,i)=><PriceTable key={i} table={t}/>)}
  </section>
  <Archive data={data} go={go}/>
 </div>;
}
function HealthArticle({data,go}) {
 return <article className="original-health-article" data-source-view="health-article">
  <h1>{data.title}</h1>
  <div className="original-health-author"><img src="https://d15q6xcjx71x0s.cloudfront.net/ic_launcher_round_294bf5451c.png" alt=""/><div><b>나만의닥터 에디터 <span>나만의닥터</span></b><small>2024.10.24 &nbsp; ◷ 2분</small></div></div>
  <p>만성 소화기 질환은 시간이 지남에 따라 악화될 수 있으며, 조기에 발견하고 관리하는 것이 중요합니다.</p>
  <p>이번 글에서는 <strong>‘만성 소화기 질환의 초기 증상을 살펴보고, 효과적인 관리 방법을 소개하여 소화기 건강을 유지하는 방법’</strong>에 대해 알아보겠습니다.</p>
  <nav className="original-health-toc" aria-label="목차"><b>목차</b><a href="#article-symptoms">1. 만성 소화기 질환의 초기 증상</a><a href="#article-care">2. 만성 소화기 질환 관리 방법</a></nav>
  <section id="article-symptoms"><h2>만성 소화기 질환의 초기 증상</h2><img src="https://d15q6xcjx71x0s.cloudfront.net/_ccec3f8536.jpg" alt="복통"/><p>만성 소화기 질환은 다양한 초기 증상을 나타낼 수 있으며, 이를 조기에 인지하는 것이 중요합니다.</p></section>
  <section id="article-care"><h2>만성 소화기 질환 관리 방법</h2><p>만성 소화기 질환은 조기 진단과 관리가 중요하며, 초기 증상을 인지하고 적절한 대처를 통해 소화기 건강을 유지할 수 있습니다.</p></section>
  <Archive data={data} go={go}/>
  <div className="original-health-fixed-action"><span>지금 비대면 진료로 약 처방 받을 수 있어요!</span>{data.links?.find(x=>x.path.startsWith("/telemedicine/"))? <Anchor path={data.links.find(x=>x.path.startsWith("/telemedicine/")).path} go={go}>기다리지 않고 전화로 진료 받기</Anchor>:null}</div>
 </article>;
}
function QnaIndex({data,go}) {
 const [filter,setFilter]=useState(""),[query,setQuery]=useState("");
 const questions=data.links?.filter(x=>/^\/qna\/\d+\//.test(x.path))||[];
 const selected=questions.filter(x=>!query||x.label.toLowerCase().includes(query.toLowerCase()));
 const parseLabel=v=>{
   const label=v.replace(/^Q\s*/,""),pos=label.indexOf("?");
   return {q:pos<0?label:label.slice(0,pos+1),a:pos<0?"":label.slice(pos+1).trim()};
 };
 return <div className="original-qna-index" data-source-view="qna-index">
   <header><h1>{data.title}</h1><a href="https://web.my-doctor.io/qna/write?utm_source=qna_seo" target="_blank" rel="noreferrer">질문하기</a></header>
   <nav className="original-qna-chips" aria-label="진료과">{QNA_CHIPS.map(x=><a href={ORIGINAL+x.path} target="_blank" rel="noreferrer" key={x.path}>{x.label}</a>)}</nav>
   <label className="original-qna-search"><Search size={16}/><input placeholder="의료진 Q&A 검색" value={query} onChange={e=>setQuery(e.target.value)} aria-label="의료진 Q&A 검색"/></label>
   <div className="original-qna-questions">{selected.map(x=>{const p=parseLabel(x.label);return <Anchor go={go} path={x.path} key={x.path} className="original-qna-item">
     <strong><span>Q</span>{p.q}</strong>{p.a&&<p>{p.a}</p>}{data.qnaMetadata?.[x.path.match(/^\/qna\/(\d+)\//)?.[1]]&&<small className="original-qna-card-meta">{data.qnaMetadata[x.path.match(/^\/qna\/(\d+)\//)[1]]}</small>}<ChevronRight size={16}/>
   </Anchor>})}</div>
   <Archive data={data} go={go}/>
 </div>;
}
function BabyEmergencyMap({data,go}) {
 const [dialog,setDialog]=useState(true),[tab,setTab]=useState("응급실"),[pediatric,setPediatric]=useState(true);
 return <div className="original-baby119" data-source-view="baby-emergency-map">
  <div className="original-baby119-gap"/>
  <header><div><small>나만의닥터</small><h1>{data.title}</h1></div><button type="button" onClick={()=>setDialog(true)}>공유 ●</button></header>
  <nav>{["응급실","병원","약국","비대면 진료"].map(x=><button type="button" className={tab===x?"current":""} onClick={()=>setTab(x)} key={x}>{x}</button>)}</nav>
  <div className="original-baby119-map">
    <div className="original-baby119-filters"><button type="button" onClick={()=>setPediatric(!pediatric)} className={pediatric?"current":""}>🌡 소아 응급실</button><button type="button" className={!pediatric?"current":""} onClick={()=>setPediatric(false)}>모든 응급실</button></div>
    <div className="original-baby119-mapgrid"><span>종로구</span><span>마포구</span><span>중구</span><span>용산구</span></div>
  </div>
  <div className="original-baby119-list"><h2>아래의 경우에 해당한다면 응급실에 가는 것이 좋아요.</h2><h2>병원·약국 찾기</h2>{data.links?.slice(0,6).map(x=><Anchor path={x.path} go={go} key={x.path}>{x.label}</Anchor>)}</div>
  {dialog&&<div className="original-baby119-overlay" role="presentation"><div className="original-baby119-dialog" role="dialog" aria-modal="true" aria-label="소아과 119 지도 소장">
    <p>위급한 순간 언제든 사용할 수 있도록</p><h2>소아과 119지도를<br/>무료로 소장해보세요!</h2>
    <div className="original-baby119-phone"><div className="original-baby119-phone-screen"><i></i><span>●</span><span>●</span><span>●</span></div><div className="original-baby119-hand"></div></div>
    <a href="https://abr.ge/zskg4p" target="_blank" rel="noreferrer">나만의닥터 앱 다운로드</a>
    <button type="button" onClick={()=>setDialog(false)}>다음에 소장하기</button>
   </div></div>}
  <Archive data={data} go={go}/>
 </div>;
}
function CompanyPage({data,go}) {
 const icons=["📱","🩺","🏥","💉","📖","🎁"];
 const paths=["https://abr.ge/zskg4p",...data.links.map(x=>x.path)];
 const labels=[["앱 설치하고 혜택 받기","신규 가입 시 3,000원 적립금 즉시 지급"],["비대면 진료 바로가기","24시간 전화 한 통으로 진료부터 약 수령까지"],["우리 동네 병원 찾기","야간·주말 진료 병원, 전문의 병원 검색"],["위고비 최저가 병원·약국","다이어트 주사제 가격을 한눈에 비교"],["건강 꿀팁 · 질환백과","전문의가 검수한 신뢰할 수 있는 건강 정보"],["매일 돈 버는 건강 퀴즈","출석하고 적립금도 받아가세요"]];
 return <div className="original-company-landing" data-source-view="company">
  <div className="original-company-identity"><img src={ORIGINAL+"/_next/image?url=%2Flogo192.png&w=256&q=75"} alt="나만의닥터 로고"/><h1>{data.title}</h1><strong>@my_doctor_official</strong><p>대한민국 1위 비대면 진료 앱<br/>안전한 진료부터 최저가 병원/약국까지</p></div>
  <div className="original-company-cards">{labels.map(([title,desc],i)=>{
    const p=paths[i]||"/",external=p.startsWith("https://");
    return external?<a href={p} target="_blank" rel="noreferrer" className={i===0?"primary":""} key={i}><span>{icons[i]}</span><div><b>{title}</b><small>{desc}</small></div><ChevronRight size={17}/></a>:
      <Anchor path={p} go={go} className={i===0?"primary":""} key={i}><span>{icons[i]}</span><div><b>{title}</b><small>{desc}</small></div><ChevronRight size={17}/></Anchor>
   })}</div>
  <Archive data={data} go={go}/>
 </div>;
}
export const isCompanyRoute=route=>route.split("?")[0]==="/company";
export const isOriginalDistinctRoute=route=>[ "/telemedicine/doctor/한사랑패밀리의원-허훈-10","/hospital/야간진료","/medical-cost/마운자로","/medical-cost/여드름약/이소티논","/map/baby119","/medicine/0.9-엔에이시엘.케이40주-200710605","/healthLab/info/1268/만성-소화기-질환-관리법","/qna","/company" ].includes(decodeURIComponent(route.split("?")[0]));
export default function OriginalDistinctPage({data,go,route}) {
 const p=decodeURIComponent(route.split("?")[0]);
 if(p==="/telemedicine/doctor/한사랑패밀리의원-허훈-10")return <DoctorDetail data={data} go={go}/>;
 if(p==="/hospital/야간진료")return <HospitalNight data={data} go={go}/>;
 if(p==="/medical-cost/마운자로"||p==="/medical-cost/여드름약/이소티논")return <PriceCompare data={data} go={go} route={p}/>;
 if(p==="/map/baby119")return <BabyEmergencyMap data={data} go={go}/>;
 if(p==="/medicine/0.9-엔에이시엘.케이40주-200710605")return <MedicineDetail data={data} go={go}/>;
 if(p==="/healthLab/info/1268/만성-소화기-질환-관리법")return <HealthArticle data={data} go={go}/>;
 if(p==="/qna")return <QnaIndex data={data} go={go}/>;
 if(p==="/company")return <CompanyPage data={data} go={go}/>;
 return null;
}
