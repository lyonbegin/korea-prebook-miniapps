# UNNI Global 모바일 복제 프로젝트 — 2026-11-04 실행 재개·검증 기록

> 이 문서는 **이전 작업을 이어받기 위한 운영 복구 기록**입니다. 원본 강남언니 글로벌 웹/Android 앱 140개 항목을 100% 복제했다는 보고서가 아닙니다. 기존 위챗·알리페이 서비스는 변경하지 않았습니다.

## 1. 확정 GitHub / Railway 매핑

- 저장소: https://github.com/lyonbegin/korea-prebook-miniapps
- **운영 브랜치:** `feature/unni-global-full-clone-20261104`
- 운영 프로젝트: Railway `thriving-education` (project ID `9359b723-c8e5-48ea-a0fb-69c7674b28b1`), production `d95a6264-8e44-41bd-8271-4fea066b8434`
- 모바일 웹: Railway `unni-mobile-web` (service ID `fa84687d-bd61-4ecb-babd-23e01e637d75`), root `/unni-global-clone/frontend`
- FastAPI: Railway `unni-mobile-api` (service ID `9369fabe-b2da-42ad-8368-a86201ca76e4`), root `/unni-global-clone/backend`
- 공유 PostgreSQL: 기존 `pgvector` (service ID `be2a484f-c25b-4d15-8974-fcbb1a678961`), 별도 스키마 `unni_clone`. **데이터베이스 교체/재생성 금지.**
- 구형 별도 프로젝트 `UNNI-UI-CLONE` (project ID `943f5a38-dce8-4d50-9bfc-e08fbc0f83ed`) 안의 `unni-pc-clone`은 이전 PC 검증이며 현재 글로벌 모바일 운영 대상이 아닙니다.
- 위챗·알리페이는 별도 Railway 프로젝트 `KOREA-PREBOOK` (project ID `2fb3dd38-5040-4293-9064-f75eca99beed`)의 `wechat-emulator`, `alipay-emulator`, `miniapp-emulator-console`, `ktaxback-original-live` Railway Function으로 운영되며, 관련 보관 문서는 `docs/WECHAT_ALIPAY_INTEGRATED_RESTORE_2026-11-04.md`를 참조합니다. **해당 서비스 Function 코드를 GitHub 브랜치 배포로 교체하지 마십시오.**

## 2. 운영 주소와 객관적인 관측

- 프런트: https://unni-mobile-web-production.up.railway.app/
- 이벤트 70809: https://unni-mobile-web-production.up.railway.app/events/70809?optionId=d195122c-ee11-4090-94c1-29a439508bdd
- 병원 826: https://unni-mobile-web-production.up.railway.app/hospitals/826
- 의료진 1502: https://unni-mobile-web-production.up.railway.app/doctors/1502
- API: https://unni-mobile-api-production.up.railway.app/health
- DB 현황: https://unni-mobile-api-production.up.railway.app/catalog/status
- 자체 상담 테이블: https://unni-mobile-api-production.up.railway.app/inquiries/health

2026-11-04 실서비스 읽기 전용 API 확인:
- `/health`: `ok=true`, `cache=postgresql`, `db_table_ready=true`.
- `/catalog/status`: `categories=102`, `hospitals=3`, `doctors=1`, `events=3`, `event_options=16`, `option_price_history=15`, `media_assets=0`, `source_provenance=5`, `full_catalog_imported=false`.
- `/inquiries/health`: `ok=true`, 문의·메시지 테이블 모두 준비됨, `staff_delivery_configured=false`, `original_clinic_connected=false`, `reservations_confirmed=false`.

## 3. 2026-11-04 추가 코드 변경

운영 브랜치의 다음 커밋 순서:
1. `9de27c34e1f42ee584573ff04fca255dcc931b5f` — 병원 상세 `onConsult`에서 병원 ID/이름을 버리던 버그 수정.
2. `cdcc14dc69708ebe44b485516599ca7317b838bf` — 실제 DB에 기록하지 않고 POST를 가로채는 상담 식별자 E2E 검증 2건 추가.
3. `9d6275bbbdb3fc042fd17a623237e37ad7a85a80` — 찜 저장을 React 초기 URL이 아니라 실제 선택 URL에 동기화.
4. `91e4d66f5110b2e7f98660a47103d7b22e535852` — 옵션 선택 시 새 URL과 찜 상태를 동기화하고 추가 원본 HTML 재요청 방지.
5. `8dc9a49b376d6212256eccd8d7774b39bd27e341` — 옵션 변경 후 저장한 찜 URL 검증 추가.

핵심 코드:
- `unni-global-clone/frontend/src/App.jsx`
- `unni-global-clone/frontend/src/ui/DetailV2.jsx`
- `unni-global-clone/frontend/tests/live-smoke.cjs`
- `.github/workflows/unni-mobile-detail-qa.yml`

## 4. 검증 증거

- GitHub Actions `UNNI mobile detail end-to-end QA`: https://github.com/lyonbegin/korea-prebook-miniapps/actions/runs/41816410584
- 마지막 코드 커밋 `8dc9a49...`의 모바일 Playwright 테스트 결과: **13/13 PASS** (2026-11-04 10:47 UTC경).
- 검사 항목: 홈 렌더, 이벤트 70809 시술 14개/선택 가격, 추천 5개, 옵션 1 딥링크, 옵션 5 UUID/가격, 선택 옵션별 찜 URL, 이벤트 상담 option UUID·병원 ID (POST 모의), 병원 상세, 병원 상담 병원 ID (POST 모의), 의료진 상세, 대체 시술 할인, 자체 문의 목록, 중요 런타임 오류 없음.
- GitHub Actions 테스트는 실제 개인정보나 상담 요청을 원본 병원/자체 DB에 제출하지 않았습니다.
- 마지막 코드 커밋 기준 Railway 웹·API 배포는 SUCCESS로 확인했습니다.
- CI 출력에 차단 대상 밖의 브라우저 console error 2건이 기록되어 있으므로 '콘솔 오류 완전 0건'이라고 보고하지 말 것.

## 5. 전체 140개 상세 점검표 대비 아직 완료하지 못한 부분

이전 첨부 보고서 `UNNI_140_IMPLEMENTATION_RECHECK_2026-11-04(1).md`의 140개 항목 번호와 상태를 기준으로 후속 검증하십시오. 당시 판정은 실배포 부분 관측 62, 코드/기능 부분 구현 59, 접근 제한·미검증 15, 일부 DB만 확보 4였습니다. 이 분류는 전체 기능 완료를 의미하지 않습니다.

- 원본 사이트/네이티브 앱의 로그인 후 후기, 실상담·예약·결제 API 접근 및 이용 권한 미확보.
- 원본 전체 시술·병원·의료진/옵션 UUID 카탈로그 DB 확보 미완료. 데이터는 소수 공개 사실 기록만 존재.
- 전체 Android Compose UI와 React의 픽셀 1:1/제스처 검증 미완료.
- 진료 정보와 광고 이미지 이용 권한 확인 필요. 원본 `private/no-store` HTML의 무단 캐시/재배포 금지.
- 자체 상담 `/inquiries`는 자체 DB 저장 기능이며 원본 병원 전송 기능이 아님. 예약/결제 성공으로 표시 금지.
- 실제 사용자 검증 시 **테스트 데이터와 운영 환자 데이터 분리**, 본인 동의·인증, 권한 확인이 우선.

## 6. 다음 진행 순서

1. 마지막 운영 브랜치/배포 SHA를 각각 확인하고 전체 E2E 로그 및 screenshot artifact 재점검.
2. 140개 점검표의 미검증/부분 구현(P0) 우선순위로 재현 가능한 오류를 테스트로 먼저 고정.
3. 원본과 기능 동등성 검증이 가능한 공개 카탈로그를 권한 범위 내에서 타입별로 확대. 원본 HTML에 대한 no-store 준수 유지.
4. 권한 없이 실제 원본 병원 상담·예약·결제를 연결했다고 보고하지 말 것.
5. 위챗·알리페이 Railway Function과 기존 pgvector의 타 스키마를 수정하지 말 것.


## 7. 같은 날 추가 개발 — 자체 상담사 운영센터

이번 단계는 **독립 운영 서비스의 상담 업무**이며 원본 UNNI 로그인/상담 API를 연결한 것이 아닙니다.

- 운영자 페이지: https://unni-mobile-web-production.up.railway.app/staff
- 구현 파일: `unni-global-clone/frontend/src/ui/StaffConsole.jsx`, `src/staff-console.css`
- 일반 사용자 메시지 UI: `unni-global-clone/frontend/src/ui/InquiryPanel.jsx`
- 기존 백엔드: `unni-global-clone/backend/app/inquiries.py`
- 운영 API:
  - `GET /inquiries/staff/queue`: 최근 50건까지 목록, 선택적 상태 필터 (접근 토큰 필수)
  - `GET /inquiries/staff/{uuid}`: 문의·연락처·메시지 상세 (접근 토큰 필수)
  - `POST /inquiries/{uuid}/staff-reply`: 상담사 답변 (접근 토큰 필수)
  - `POST /inquiries/staff/{uuid}/close`: 상담 종료 (접근 토큰 필수)
  - `GET /inquiries/{uuid}`: 사용자별 기존 발급 토큰으로 자신의 문의와 답변 조회
- **인증:** Railway API 서비스 `unni-mobile-api`의 `UNNI_STAFF_TOKEN` 환경변수가 설정된 것을 `GET /inquiries/health`로 2026-11-04 확인 (`staff_delivery_configured=true`). 실제 토큰 값은 GitHub 소스·이 문서·프런트엔드 빌드에 절대로 기재하지 말 것. 운영자는 별도로 전달받은 토큰을 `/staff`의 암호 필드에 입력한다.
- 운영자 조회는 토큰 검사를 SQL보다 먼저 수행하고 `Cache-Control: no-store`를 설정한다. 프런트는 토큰을 메모리에만 보관하며 localStorage나 URL에 넣지 않는다.
- 독립 채팅창은 사용자가 연 상태로 있을 때 15초 간격으로 새 답변을 조회하고, 직접 새로고침도 지원한다.
- 운영자 답변이나 사용자의 추가 메시지에 따라 자체 문의 상태·갱신시각을 변경한다. 종료된 상담은 추가 메시지를 거부한다.
- **개인정보 처리:** 연락처/메시지는 기존 `unni_clone`에만 있고, 관리자 인증 없이는 조회할 수 없다. 데이터 보존 정책, 운영자 권한 감사기록, 접속기록·접근통제 강화는 실제 서비스 상용 전 별도 필요.

### 검증

- 마지막 실제 서비스 코드: `7bc5fe76cca205366aa09aeb39ea28d8a875c64a`
- GitHub Actions: https://github.com/lyonbegin/korea-prebook-miniapps/actions/runs/41818151915
- Playwright 실제 배포 모바일 화면 테스트: **15/15 PASS**.
  - 방문자 옵션/상담 UUID 맥락, 상담사 목록/답변/종료 UI, 사용자 화면 답변 새로고침 포함
  - 상담 API 쓰기는 전부 **모의 응답**이므로 실제 상담 DB에 새 데이터를 쓰지 않았다.
- Python 백엔드 Dockerfile: `python -m unittest discover -s tests -p 'test_metadata_unittest.py' -v` 실행, 운영자 설정 누락 503·잘못된 토큰 403·정상 토큰 접근 시 no-store 조건 등을 포함.
- Railway `unni-mobile-web`, `unni-mobile-api`가 해당 커밋에 대해 배포 SUCCESS.
- 운영 `GET /inquiries/health` 조회: `ok=true`, `staff_delivery_configured=true`, `original_clinic_connected=false`, `reservations_confirmed=false`.

**제약:** 자체 상담 운영이 가능하도록 코드를 추가한 것이지, 실제 원본 UNNI 병원에 메시지가 전송되는 것은 아니다. 공개 원본에서 시술 70809의 14개 옵션은 확인되지만, UUID가 확인된 것은 옵션 5번 등 제한적인 범위다. 나머지 원본 UUID를 임의 생성하지 말 것. 원본 전체 카탈로그, 후기, 원본 예약/결제/실기기 픽셀 비교는 여전히 미완료다.
