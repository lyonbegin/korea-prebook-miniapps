import React from "react";
import data from "./data/original-footer-nav.json";
export default function OriginalFooter({go}) {
  return <footer className="original-footer">
    <nav aria-label="원본 공개 사이트 지도" className="original-footer-nav">
      {data.groups.map(group => <section key={group.title}>
        <h2>{group.title}</h2>
        <div className="original-footer-links">{group.links.map(link =>
          link.href.startsWith("/") ?
          <a key={link.href} href={link.href} onClick={e=>{e.preventDefault();go(link.href)}}>{link.label}</a> :
          <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label}</a>
        )}</div>
      </section>)}
    </nav>
    <div className="original-company">
      <strong>(주)메라키플레이스 · 원본 공개 회사 정보</strong>
      <p>비즈니스/광고 제휴 문의: sales@merakiplace.kr</p>
      <p>대표: 선재원, 손웅래 | 사업자등록번호: 554-86-02396</p>
      <p>통신판매업신고: 2026-서울강남-02884</p>
      <p>서울특별시 강남구 테헤란로 242, 4층 (역삼동)</p>
      <p>이메일: help@merakiplace.kr | 전화번호: 1544-6172</p>
      <p>고객센터 운영시간: 평일 오전 10시 ~ 오후 7시</p>
      <p>Copyright 2026 Merakiplace Inc. All rights reserved.</p>
    </div>
  </footer>;
}
