import React from "react";
import {ChevronRight} from "lucide-react";
import "./website-qna-detail.css";

/* Verified original public Q&A screen, captured 2026-11-09.
 * The visible patient question and source answer were transcribed from
 * the preserved source screenshot, not generated as medical advice.
 */
const TITLE="아침에 첫발을 디딜 때 발뒤꿈치가 아픈데 족저근막염일까요?";
export default function WebsiteQnaDetail({go}){
 return <div className="ow-qd-page" data-testid="website-source-qna-answer" data-source-date="2026-11-09">
  <section className="ow-qd-question">
    <span className="ow-qd-pill">Q&A</span>
    <h1>{TITLE}</h1>
    <p className="ow-qd-author">박OO · 2026.10.22.</p>
    <p className="ow-qd-question-text">한 달 전부터 아침에 일어나 첫걸음을 뗄 때 발뒤꿈치가 찌릿하게 아파요. 좀 걷다 보면 덜한데 오래 서 있으면 다시 아파져요. 족저근막염 초기 증상이 이런 건가요? 정형외과에 가야 할지, 그냥 쉬면서 지켜봐도 될지 모르겠어요.</p>
    <button type="button" onClick={()=>go("/qna/정형외과")} className="ow-qd-tag">#정형외과</button>
  </section>
  <section className="ow-qd-answer">
    <h2>답변 1개</h2>
    <div className="ow-qd-answer-head">
      <div className="ow-qd-avatar" aria-label="나만의닥터 AI">닥.</div>
      <div><div className="ow-qd-answer-author"><strong>나만의닥터 AI</strong><span>AI 답변</span></div>
      <p>2026.10.22.</p></div>
    </div>
    <p>족저근막염 초기에 흔한 양상과 잘 맞아서 가능성은 충분히 있습니다. 아침 첫걸음에 뒤꿈치가 찌릿하고, 조금 걸으면 덜하다가 오래 서 있으면 다시 아픈 패턴이 대표적이기 때문입니다.</p>
    <p>다만 한 달째 이어지고 있으니 그냥 지켜보기보다 정형외과에서 확인받는 편이 좋습니다. 뒤꿈치 통증은 다른 원인으로도 생길 수 있어 진찰로 구분해야 합니다. 진료 전까지는 이렇게 해 보세요.</p>
    <div className="ow-qd-related">
      <h2>함께 보면 좋은 정보</h2>
      <button type="button" onClick={()=>go("/telemedicine/정형외과-비대면진료-예약")}>정형외과 비대면 진료 <ChevronRight size={16}/></button>
      <button type="button" onClick={()=>go("/dept-hub/정형외과")}>근처 정형외과 찾기 <ChevronRight size={16}/></button>
      <button type="button" onClick={()=>go("/qna")}>의료진 Q&A 목록 <ChevronRight size={16}/></button>
    </div>
  </section>
 </div>
}
