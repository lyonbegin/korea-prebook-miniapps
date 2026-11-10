import React,{useState}from "react";
const fmt=n=>new Intl.NumberFormat("ko-KR").format(n||0);
export default function ReviewsSummary({data,go}){
 const review=data.reviewSummary;
 const [selected,setSelected]=useState("전체");
 const facets=selected==="전체"?review.facets:review.facets.filter(x=>x.label===selected);
 return <div className={"original-review"+(review.kind==="hospital"?" original-review-hospital":"")} data-source-view="reviews">
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
    <div className={"review-facets"+(review.kind==="hospital"&&review.facets.length===11?" original-hospital-facets":"")} role="group" aria-label="증상별 후기 분류">
      {(review.kind==="hospital"&&review.facets.length===11?
        [review.facets.slice(0,3),review.facets.slice(3,5),review.facets.slice(5,8),review.facets.slice(8,11)]:
        [review.facets]).map((group,i)=><div className="review-facet-row" key={i}>{group.map(x=><button type="button" key={x.label}
        className={selected===x.label?"active":""}
        aria-pressed={selected===x.label} onClick={()=>setSelected(selected===x.label?"전체":x.label)}>
        {x.label} {fmt(x.count)}건
      </button>)}</div>)}
    </div>
    {selected!=="전체"&&<p className="review-filter-label" role="status">{facets[0]?.label} {fmt(facets[0]?.count)}건</p>}
   </section>
   {review.channel_counts.map(x=>{
     const samples=review.public_review_samples?.[x.name]||[];
     return <section className={"review-channel"+(samples.length?" review-channel-with-cards":"")} key={x.name}>
       <h2>{review.provider}{review.kind==="doctor"?" 의사":""} {x.name} {fmt(x.count)}건</h2>
       <p>최근 글 후기 우선 100건 표시</p>
       {samples.length?<ol className="review-card-list">{samples.map((card,i)=><li className="review-source-card" key={x.name+"-"+i}>
         <div className="review-source-doctor">{card.avatar?<img src={card.avatar} alt=""/>:<span aria-hidden="true">{card.doctor?.slice(0,1)}</span>}<span>{card.doctor}</span></div>
         <span className="review-source-positive">{card.rating}</span>
         <div className="review-source-meta"><strong>{card.condition}</strong><span>{card.reviewer}</span><span>{card.date}</span></div>
         <p className="review-source-excerpt">{card.excerpt}</p>
         <div className="review-source-tags">{card.tags.map(tag=><span key={tag}>{review.tag_icons?.[tag]&&<img alt="" src={review.tag_icons[tag]}/>} {tag}</span>)}</div>
       </li>)}</ol>:<div className="review-summary-note">공개 집계 자료는 원본과 일치합니다. 후기 원문은 원본 서비스에서 확인할 수 있습니다.</div>}
     </section>;
   })}
   {data.links.length>0&&<div className="review-detail-link">
       {data.links.map(link=><a key={link.path} href={link.path}
         onClick={e=>{e.preventDefault();go(link.path)}}>{link.label} <span aria-hidden="true">›</span></a>)}
   </div>}
 </div>;
}
