import React,{useState}from "react";
const fmt=n=>new Intl.NumberFormat("ko-KR").format(n||0);
export default function ReviewsSummary({data,go}){
 const review=data.reviewSummary;
 const [selected,setSelected]=useState("전체");
 const facets=selected==="전체"?review.facets:review.facets.filter(x=>x.label===selected);
 return <div className="original-review" data-source-view="reviews">
   <section className="review-top">
    <h1>{data.title}</h1>
    <div className="review-metrics">
     <div><span>전체 후기</span><strong>{fmt(review.total_reviews)}건</strong></div>
     <div><span>재진료 의향</span><strong>{review.revisit_percent}%</strong></div>
    </div>
    {review.service_stats.length>0&&<div className="review-service-stats">
      {review.service_stats.map(x=><div key={x.label}><span>{x.label}</span>
        <b>{x.description}</b><strong>{x.percent}%</strong></div>)}
    </div>}
    <h2 className="review-facet-heading">증상별 후기</h2>
    <div className="review-facets" role="group" aria-label="증상별 후기 분류">
      {review.facets.map(x=><button type="button" key={x.label}
        className={selected===x.label?"active":""}
        aria-pressed={selected===x.label} onClick={()=>setSelected(selected===x.label?"전체":x.label)}>
        {x.label} {fmt(x.count)}건
      </button>)}
    </div>
    {selected!=="전체"&&<p className="review-filter-label" role="status">{facets[0]?.label} {fmt(facets[0]?.count)}건</p>}
   </section>
   {review.channel_counts.map(x=><section className="review-channel" key={x.name}>
      <h2>{review.provider}{review.kind==="doctor"?" 의사":""} {x.name} {fmt(x.count)}건</h2>
      <p>최근 글 후기 우선 100건 표시</p>
      <div className="review-summary-note">공개 집계 자료는 원본과 일치합니다. 후기 원문은 원본 서비스에서 확인할 수 있습니다.</div>
   </section>)}
   {data.links.length>0&&<div className="review-detail-link">
       {data.links.map(link=><a key={link.path} href={link.path}
         onClick={e=>{e.preventDefault();go(link.path)}}>{link.label} <span aria-hidden="true">›</span></a>)}
   </div>}
 </div>;
}
