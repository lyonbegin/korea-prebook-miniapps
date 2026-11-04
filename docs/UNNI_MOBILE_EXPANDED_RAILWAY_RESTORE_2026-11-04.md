# UNNI 글로벌 모바일 프로젝트 — 소스·Railway·PostgreSQL 복구 문서

작성일: 2026-11-04 (KST). 데이터·기능을 실제로 검증한 범위만 기재합니다.

## 1. 정식 원본과 고정 소스

- 원본 공개 서비스: https://unni.app/us
- 사용자 제공 APK: Unni 3.338.0 (XAPK, 별도 보존 필요. 이 GitHub에 원본 XAPK 파일은 없음)
- GitHub 저장소: https://github.com/lyonbegin/korea-prebook-miniapps
- 새 모바일 개발 브랜치: feature/unni-global-full-clone-20261104
- 이 복구용 고정 소스 커밋: 651d402a158b3e5cbd3c4c5b64b51e9506453a85
- 이 복구 브랜치: backup/unni-mobile-expanded-20261104
- 이전 초기 버전 백업: backup/unni-mobile-railway-first-deploy-20261104

**중요:** 원본 1:1 네이티브 앱 복제가 검증된 것은 아닙니다. 독립 React/Vite 모바일 웹은 원본 공개 데이터와 화면 유형을 재현하며, 일부 네이티브 Compose 화면·비공개 API·로그인/예약은 구현되지 않았습니다.

## 2. GitHub 실행 소스 정확한 경로

- 프런트엔드 루트: unni-global-clone/frontend
- React 진입: unni-global-clone/frontend/src/main.jsx
- React 전체 라우팅: unni-global-clone/frontend/src/App.jsx
- 홈/상품목록/시술상세/병원/의사/칼럼 화면: unni-global-clone/frontend/src/ui/Screens.jsx
- 선택 옵션/이미지갤러리/필터/모달: unni-global-clone/frontend/src/ui/Components.jsx
- 원본 공개 웹 HTML/ID/옵션 파싱: unni-global-clone/frontend/src/lib/sourceModel.js
- 실제 원본 14개 대분류/88개 소분류 URL: unni-global-clone/frontend/src/lib/subcategories.json
- FastAPI 호출 어댑터: unni-global-clone/frontend/src/lib/originalGateway.js
- UI 스타일: unni-global-clone/frontend/src/styles.css
- 백엔드 루트: unni-global-clone/backend
- FastAPI: unni-global-clone/backend/app/main.py
- Postgres 구조: unni-global-clone/backend/app/catalog_schema.py
- 88개 소분류 DB 시드: unni-global-clone/backend/app/subcategories.py
- FastAPI pytest 모의 테스트: unni-global-clone/backend/tests/test_gateway.py
- 기존 올리브영·위챗·알리페이 복원 문서: https://github.com/lyonbegin/korea-prebook-miniapps/blob/main/docs/WECHAT_ALIPAY_INTEGRATED_RESTORE_2026-11-04.md

**금지:** 저장소 루트의 기존 Dockerfile로 UNNI를 배포하지 말 것. 그 파일은 기존 사업의 별도 앱용이다.

## 3. 기존 Railway 프로젝트와 서비스 ID

프로젝트: thriving-education
projectId: 9359b723-c8e5-48ea-a0fb-69c7674b28b1
환경: production
environmentId: d95a6264-8e44-41bd-8271-4fea066b8434

### React/Vite 프런트엔드

- 서비스명: unni-mobile-web
- serviceId: fa84687d-bd61-4ecb-babd-23e01e637d75
- 공개 URL: https://unni-mobile-web-production.up.railway.app/
- 소스 브랜치: feature/unni-global-full-clone-20261104
- rootDirectory: /unni-global-clone/frontend
- buildCommand: npm run build
- startCommand: npm run start
- healthcheckPath: /
- 변수 VITE_GATEWAY_BASE = https://unni-mobile-api-production.up.railway.app
- 변수 NODE_ENV = production
- Vite preview.allowedHosts는 healthcheck.railway.app 및 웹 공개 호스트를 허용하도록 유지.

### FastAPI 백엔드

- 서비스명: unni-mobile-api
- serviceId: 9369fabe-b2da-42ad-8368-a86201ca76e4
- 공개 URL: https://unni-mobile-api-production.up.railway.app/health
- rootDirectory: /unni-global-clone/backend
- Dockerfile: Dockerfile (위 rootDirectory 기준)
- healthcheckPath: /health
- 변수 DATABASE_URL: Railway의 기존 pgvector 서비스 DATABASE_URL을 참조. 비밀번호를 평문으로 옮기지 말 것.
- 변수 FRONTEND_ORIGINS: https://unni-mobile-web-production.up.railway.app,http://localhost:5173
- 변수 MAX_CACHE_BYTES: 4194304

### 공유 PostgreSQL (신규 설치 아님)

- 기존 PostgreSQL 서비스명: pgvector
- 기존 serviceId: be2a484f-c25b-4d15-8974-fcbb1a678961
- 기존 prebook-api serviceId: b3d48a46-e604-450f-a7e1-3fa36eecaf41
- 기존 DB를 삭제/초기화하거나 기존 스키마를 수정하지 말 것.

## 4. UNNI만 사용하는 기존 PostgreSQL의 신규 구조

전용 스키마: unni_clone
- original_response_cache: 원본 응답 캐시 키/상태/헤더/바이트
- categories: 원본 대분류 14개와 소분류 88개, 102개 원본 ID와 URL 및 부모 ID
- hospitals: 향후 사용 권한을 확인한 병원 메타데이터
- doctors: 의료진과 병원 관계
- events: 시술 이벤트와 병원 관계
- event_categories: 이벤트-분류 연결
- event_options: 실제 시술 옵션의 가격·ID
- media_assets: 라이선스를 확인한 이미지 관리
- source_provenance: 출처와 사용 범위 기록

초기 실제 검증 수량 (2026-11-04):
- categories 102개 (대분류 14개 + 하위 88개)
- hospitals 0개, doctors 0개, events 0개, event_options 0개
- original_response_cache는 공개 정적 리소스 저장 성공 확인. 실제 건수는 실행 시 status API로 조회.

읽기 전용 상태 주소:
- https://unni-mobile-api-production.up.railway.app/health
- https://unni-mobile-api-production.up.railway.app/catalog/status
- https://unni-mobile-api-production.up.railway.app/cache/status

## 5. 원본 데이터 요청/저장 정책

- 캐시 HIT: PostgreSQL의 원본 바이트를 그대로 반환.
- 캐시 MISS: 원본 HTTP 응답을 먼저 React에 스트리밍하고, 전송 완료 후 FastAPI BackgroundTask로 저장.
- 인증·사용자 개인 정보·채팅·예약·결제와 원본이 private/no-store로 표기한 응답은 공용 DB 캐시에서 제외.
- 실제 원본 강남언니 공개 HTML은 Cache-Control private/no-store, Set-Cookie가 확인되어 원문을 저장하지 않음.
- APK에서 추출한 mobile-bff.gangnamunni.com 등 서버 후보는 일부 경로가 502 등으로 실패. 앱의 전체 API 계약/인증/전체 데이터는 아직 확보하지 않음.
- 정적 이미지 등 원본이 공개 캐시를 허용하는 응답은 실제 기존 pgvector DB에 저장 성공.

## 6. 실제 동작 URL 및 검증 항목

- 홈: https://unni-mobile-web-production.up.railway.app/
- 리프팅 카테고리: https://unni-mobile-web-production.up.railway.app/events?q=Lifting&categoryId=419
- 보톡스 카테고리: https://unni-mobile-web-production.up.railway.app/events?q=Botox&categoryId=415
- 최저가 정렬: https://unni-mobile-web-production.up.railway.app/events?q=Lifting&categoryId=419&s=LOWEST_DISCOUNTED_COST
- 시술 이벤트 상세: https://unni-mobile-web-production.up.railway.app/events/70809
- 원본 이벤트 옵션 딥링크: https://unni-mobile-web-production.up.railway.app/events/70809?optionId=d195122c-ee11-4090-94c1-29a439508bdd
- 병원 목록: https://unni-mobile-web-production.up.railway.app/hospitals
- 병원 상세: https://unni-mobile-web-production.up.railway.app/hospitals/826
- 의료진: https://unni-mobile-web-production.up.railway.app/doctors/1502
- 칼럼 목록: https://unni-mobile-web-production.up.railway.app/contents
- 칼럼 상세: https://unni-mobile-web-production.up.railway.app/contents/405d9338-d3d4-81c4-a3e0-e868a4a5ad3f

시술 상세 70809의 옵션 14개가 화면에서 확인되었고, URL의 optionId를 반영하도록 파서를 수정했다. 최초 미들웨어는 원본 데이터를 수집하여 구조적으로 연결하지만, 실제 로그인·상담·예약·결제나 전체 상품/병원 DB 수집은 완료되지 않았다. 상담 모달은 전송되었다고 표시하지 않는다.

## 7. 장애 시 복구 순서

1. K-TAXBACK/위챗·알리페이 기존 복원 문서를 먼저 확인하고, 기존 서비스/DB/브랜치를 변경하지 않는다.
2. 위 고정 커밋 651d402a158b3e5cbd3c4c5b64b51e9506453a85 또는 이 백업 브랜치에서 unni-global-clone 전체 폴더를 확보한다.
3. Railway thriving-education 생산 환경에서 기존 pgvector가 실행되는지 먼저 확인한다.
4. unni-mobile-api를 위 루트/Dockerfile 및 pgvector DB 변수를 적용하여 복원한다. health, catalog/status, cache/status를 확인한다.
5. unni-mobile-web을 위 루트/환경변수/시작명령으로 복원한다.
6. 최소 홈, 리프팅/보톡스, 이벤트 70809 14개 옵션, 병원 826, 의사 1502, 칼럼 목록 및 상세를 확인한다.
7. 원본 애플리케이션의 100% UI/데이터 복제로 보고하려면 추가로 실제 앱 실행, 모바일 네트워크/화면 대조, 원본 전체 데이터 접근 및 권리 검증이 필요하다.
