# UNNI 140항목 상세 구현·검증 결과 (2026-11-04)

## 스냅샷
- 운영 소스: `feature/unni-global-full-clone-20261104`
- 별도 보존 브랜치: `backup/unni-detail-140-audit-20261104`
- Railway 프로젝트: thriving-education (`9359b723-c8e5-48ea-a0fb-69c7674b28b1`)
- React/Vite: https://unni-mobile-web-production.up.railway.app/
- FastAPI: https://unni-mobile-api-production.up.railway.app/health
- 카탈로그: https://unni-mobile-api-production.up.railway.app/catalog/status
- 독립 문의 DB: https://unni-mobile-api-production.up.railway.app/inquiries/health

## 실제 동작 확인
- 이벤트 70809: 14옵션, 원본 5번 선택, 100Unit/LIZTOX, 정상가 $204.60, 할인율 20%, USD $163.68, 원화 ₩220,000.
- 이벤트 140615: 46% 할인/상담필요 및 마취 비용 표시.
- 이벤트 164147: 0.0 평점, 단일 옵션 $12.19, 후기가 없으면 강제 리뷰 게이트 미표시.
- 병원 826: 10장 갤러리, 9.7점, 10,685 리뷰, 5개 하이라이트, 진료시간·주소·지도.
- 의사 1502: 원본 공개명 Seungmin Yoo, 9,137 후기 건수. 잘못 저장된 'App Download'를 정적 파서 수정·원본 재조회로 교정.
- DB 저장: categories 102, events 3, event_options 16, hospitals 3, doctors 1, source_provenance 5 (전체 카탈로그 아님).
- FastAPI Docker 빌드 unittest 8개 성공. 프런트·API Railway SUCCESS.

## 미완료 및 제한
**140개 전체 구현·실기기 100% 검증은 아직 완료되지 않았습니다.**
- 추천 대상(Recommended to) 5개 상세 복제본 누락 사례.
- 원본 이벤트 모든 optionId UUID 확보 불가. 자기 웹에서는 optionIndex를 대체 deep-link로 사용, 원본 UUID라고 주장하지 않음.
- 회원 로그인 후 실 후기/원본 병원 직접 상담/예약·결제 API에 접근하거나 성공 검증하지 못함.
- 독립 문의 저장은 가능하지만 원본 병원에는 전달되지 않으며 실제 예약 확정이 아님.
- 네이티브 Compose 전 화면과 모바일 실기기 픽셀 비교·동작 자동화 미검증.
- `Cache-Control: private/no-store`인 원본 HTML을 공용 응답 캐시에 저장하지 않음.
- 상업적 원본 이미지/콘텐츠 재배포 권한 미확인.

## 원본 140개 점검표
사용자가 제공한 `UNNI_DETAIL_GAP_AUDIT_2026-11-04.md` 140개 번호·명칭을 유지한 1:1 재검증 보고서 `UNNI_140_DETAIL_IMPLEMENTATION_VERIFICATION_2026-11-04.md`를 현재 대화에 별도 파일로 제공.
검증 판정: 실배포 관측(범위 제한) 59, 코드/기능 부분 구현 60, 일부 DB 레코드만 확보 4, 접근 제한·미검증 15, 미완료 1, 원본 대비 누락 1. 해당 합계는 140건.
이 판정은 화면 UI의 정밀 일치나 모든 조작의 성공률을 수치화한 것이 아님.

## 재배포/복구 주의
- 기존 위챗·알리페이·K-TAXBACK 서비스 및 공유 PostgreSQL 타 스키마 변경 금지.
- 프런트: `unni-global-clone/frontend`를 Railway 별도 서비스 루트로 사용.
- API: `unni-global-clone/backend` Dockerfile 사용, 기존 `pgvector.DATABASE_URL` 참조.
- 별도 복구 문서: `docs/UNNI_MOBILE_EXPANDED_RAILWAY_RESTORE_2026-11-04.md` (기존 final backup branch 참조).
