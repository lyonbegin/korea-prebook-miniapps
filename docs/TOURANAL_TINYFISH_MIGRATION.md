# Touranal → 위쳇알리 : TinyFish 원격 소싱 전환 (2026-10-23)

## 원본 조사
업로드된 \`touranal_share_20261023_082518.zip\`은 96개 엔트리 / 실제 파일 95개, 비압축 약 3.95 MB의 소스 스냅샷이다.
로컬 데이터베이스 원본(.db), 다운로드 영상, 브라우저 로그인 상태 및 비밀 키 파일은 제외됐다.
원본 전체를 GitHub에 올리거나 다른 서비스에 전개하지 않았다.

| 원본 | 기존 의존성 | 교체/이관 방법 |
|---|---|---|
| \`backend/main.py\` | \`tour_analyzer.db\`, \`youtube_discovery.db\`, \`C:\\tour\\ktaxback.db\`, 로컬 FastAPI:8001 | 상품·소싱·채널 API를 기능별 분리하고 기존 Railway pgvector에 독립 테이블 |
| \`backend/google_product_search.py\` | Google Shopping/Fallcent, Playwright, \`127.0.0.1:9229\` CDP | TinyFish Search/Fetch/Agent/Browser로 재설계 |
| \`youtube_pipeline/xiaohongshu_crawler.py\` | \`rednote.com\`, \`127.0.0.1:9333\`, 로그인된 Chrome | TinyFish Browser Context Profile |
| \`youtube_pipeline/xhs_discover_new.py\` | 로컬 cookies.txt, CDP | TinyFish Browser Context Profile |
| \`youtube_pipeline/bilibili_search_crawler.py\` | Bilibili WBI signed API | 필요 시 공식 API 우선, 웹사이트 수집은 TinyFish Agent |
| \`backend/yanolja_flight_crawler_v3.py\` | 로컬 Chromium 실행 | 외부 브라우저 실행기로 교체 검토 |
| \`backend/product_store.py\` | SQLite 상품·옵션·가격 기록 | 표준 제품 식별자/가격 이력 PostgreSQL 스키마 후속 마이그레이션 |
| \`backend/hotel_store.py\` | 로컬 숙소 DB | 표준 숙소 정규화와 채널별 공급 이력 이관 |
| \`youtube_pipeline/build_shopping_pools.py\` | 로컬 JSON/CSV 결과 | 수집·분석 후 제품 후보군 생성 엔진으로 재사용 |
| \`tour-analyzer-app.jsx\` | 로컬 API와 SPA UI | 관리자 정보구조 반영; React 원본 전체를 서버로 복사하지 않음 |

## 신규 구현 / 기존 구조 유지
- GitHub: \`lyonbegin/korea-prebook-miniapps\`의 \`main\` 브랜치.
- Railway: 기존 \`thriving-education\` 프로젝트와 \`prebook-api\`; 기존 \`pgvector\` PostgreSQL 사용.
- \`backend/app/sourcing.py\`: 신규 소싱처·로그인 프로필 ID·작업 큐·결과·원본 링크·검수/등록 API.
- \`backend/app/manager.html\`: TinyFish 소싱처, 프로필, 검색, 작업 상태, 결과 검수 UI.
- \`scripts/tinyfish_sourcing_worker.py\`: 외부 작업자가 TinyFish REST /run-async, /v1/runs/{id} API를 이용해 원격 수집.
- 신규 DB 테이블은 모두 \`korea_prebook_\` 접두사를 사용한다.
- 상품 후보는 직접 미니앱에 게시되지 않는다. 검수 후 상품 저장, WeChat/Alipay 별도 노출 설정으로 이어진다.

## 로그인 정책
- ID/비밀번호, 쿠키, JWT, TinyFish API Key를 GitHub나 관리자 상품 DB에 저장하지 않는다.
- 사이트별 TinyFish Browser Context Profile을 생성하고 로그인된 세션을 저장한다.
- 관리자에는 프로필 식별자 \`prof_...\`와 연결 상태만 저장한다.
- TinyFish 요청에는 \`use_profile: true\` + \`profile_id\`가 정확히 함께 전달된다.
- 프로필 설정 완료 = 현재 로그인 성공을 뜻하지 않는다. 실제 수집 작업 때 페이지 로그인 상태 검증이 필요하다.
- 유료·로그인 사이트는 권한이 부여된 데이터에만 접근한다. 구매/주문/메시지/예약 제출은 금지한다.

## Python Worker 실행
1. TinyFish API Key는 \`https://agent.tinyfish.ai\`에서 발급받는다.
2. **기존 Railway 프로젝트 내 별도 worker 서비스** 또는 권한이 있는 원격 PC에서 다음 환경변수를 설정한다:
  - \`TINYFISH_API_KEY\` : 해당 사용자 TinyFish API 키
  - \`ADMIN_API_TOKEN\` : 운영 \`prebook-api\` 관리자 토큰과 동일한 값
  - \`MANAGER_BASE=https://prebook-api-production-9b80.up.railway.app\`
3. 작업 시작 커맨드: \`python scripts/tinyfish_sourcing_worker.py\`
4. Worker는 관리자 큐에서 작업을 받아 TinyFish Async 실행, 상태 재조회, 완료 결과를 등록한다.
5. API 키가 설정되지 않으면 Worker가 동작하지 않으며 수집 작업은 대기 상태로 남는다.
6. 별도 Worker 서비스를 설치할 때 기존 \`procureflow-worker\`나 다른 Railway 서비스를 건드리지 않는다.

공식 TinyFish 문서: https://docs.tinyfish.ai/agent-api/reference , https://docs.tinyfish.ai/agent-api/browser-context-profiles

## 구현 구분
- 완료: 원본 의존성 분석, 소싱처 등록/연결 API, 비동기 작업 큐, Worker 코드, 수집 결과 검수·채널 노출 데이터 연동, 테스트 파일 추가.
- 완료 아님: TinyFish 계정 API Key의 Worker 적용, RedNote/Klook 등 사이트별 실제 로그인, 실제 브라우저 수집 성공 건수, 과거 touranal 전체 DB 마이그레이션, 공인 OTA 판매자 입점 승인.
- WeChat/Alipay 실제 MiniProgram Studio 검증은 이전 공식 실행기와 별개다.
