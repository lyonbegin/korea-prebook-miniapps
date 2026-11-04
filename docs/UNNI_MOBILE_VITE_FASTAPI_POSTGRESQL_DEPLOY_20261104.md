# UNNI 모바일 Vite + FastAPI + 기존 PostgreSQL 배포 복원 기록
기준일: 2026-11-04 KST
정확한 기능 상태: **독립 실행 웹·API 배포 성공, 공개 HTML과 상품 옵션 렌더링 확인. 원본 Android UI의 픽셀 완전 복제는 미완료.**

## 고정 GitHub 참조
- 저장소: https://github.com/lyonbegin/korea-prebook-miniapps
- 소스 브랜치: `feature/unni-global-full-clone-20261104`
- 보존용 스냅샷 브랜치: `backup/unni-mobile-railway-first-deploy-20261104`
- 모바일 React/Vite 루트: `unni-global-clone/frontend`
- FastAPI 루트: `unni-global-clone/backend`
- FastAPI 소스: `unni-global-clone/backend/app/main.py`
- 프런트엔드 소스: `unni-global-clone/frontend/src/App.jsx`
- 캐시 설명: `unni-global-clone/WRITE_BEHIND_CACHE.md`
- 기존 위챗·알리페이 원본 복구 문서: `docs/WECHAT_ALIPAY_INTEGRATED_RESTORE_2026-11-04.md` (main)

## Railway: 기존 thriving-education 프로젝트에 배포
- 프로젝트 이름: `thriving-education`
- 프로젝트 ID: `9359b723-c8e5-48ea-a0fb-69c7674b28b1`
- 환경: `production` / `d95a6264-8e44-41bd-8271-4fea066b8434`

| 서비스 | 서비스 ID | URL | 빌드 루트 | 배포 검증 |
|---|---|---|---|---|
| React/Vite `unni-mobile-web` | `fa84687d-bd61-4ecb-babd-23e01e637d75` | https://unni-mobile-web-production.up.railway.app/ | `/unni-global-clone/frontend` | SUCCESS `2ea114c5-963c-4023-9a8a-3612cccdc00e` |
| FastAPI `unni-mobile-api` | `9369fabe-b2da-42ad-8368-a86201ca76e4` | https://unni-mobile-api-production.up.railway.app/health | `/unni-global-clone/backend` | SUCCESS `86c7b069-b81a-45af-aecc-973206fe9b50` |
| 기존 PostgreSQL `pgvector` (재사용) | `be2a484f-c25b-4d15-8974-fcbb1a678961` | Railway 비공개 내부 연결 | 기존 서비스 그대로 | SUCCESS `06798405-e5a5-4281-b1a4-b1289e7a9f65` |

**DB:** 기존 `pgvector`의 `DATABASE_URL`을 FastAPI 서비스 변수에 Railway 참조값 `${{pgvector.DATABASE_URL}}`로 설정. DB 자체나 기존 데이터는 재생성하지 않는다.
- `CREATE SCHEMA IF NOT EXISTS unni_clone`
- `CREATE TABLE IF NOT EXISTS unni_clone.original_response_cache`
- 기본 키: `cache_key` (원본 서비스·경로·쿼리·언어/변형 헤더 SHA256)
- 원본 응답 바이트는 `raw_body BYTEA`, 메타데이터 `response_headers JSONB` 등으로 보관
- 기능: **HIT → DB 바이트 반환**. **MISS → 원본으로부터 즉시 스트리밍, 전송 완료 후 BackgroundTask DB INSERT**.
- `/health`: `cache=postgresql`, `db_table_ready=true` 확인.
- `/cache/status`: 실제 저장된 공개 이미지 1건, 29,866 bytes 확인(2026-11-04 KST 최초 검증, 이후 수치는 변동 가능).

**캐시 제약:** 공개 `unni.app/us/events/70809` HTML은 상위 서버가 `Cache-Control: private,no-store` 및 `Set-Cookie`를 보냈으므로 DB에 저장하지 않음. 고정 URL의 공개 정적 이미지처럼 캐시 가능한 응답은 저장 확인. APK의 `mobile-bff.gangnamunni.com` 등은 실제 JSON API 성공·인증 방식을 아직 검증하지 못했으며, 테스트 경로는 502 오류도 반환함. 예약·상담 등 개인별 데이터는 공용 캐시에 저장하지 않음.

## 환경변수 (비밀값 기재 금지)
### unni-mobile-api
- `DATABASE_URL=${{pgvector.DATABASE_URL}}` (Railway 서비스 참조)
- `MAX_CACHE_BYTES=4194304`
- `FRONTEND_ORIGINS=https://unni-mobile-web-production.up.railway.app,http://localhost:5173`
- healthcheck `/health`
- Dockerfile `unni-global-clone/backend/Dockerfile`

### unni-mobile-web
- `VITE_GATEWAY_BASE=https://unni-mobile-api-production.up.railway.app`
- `NODE_ENV=production`
- 빌드 `npm run build`
- 시작 `npm run start` (Vite preview, Railway `PORT` 사용)
- healthcheck `/`
- `frontend/vite.config.js`의 preview.allowedHosts에 `healthcheck.railway.app`, `unni-mobile-web-production.up.railway.app` 포함해야 함.

## 독립 배포 재구축 순서
1. 기존 위챗/알리페이 복구 문서를 먼저 읽고 원래 서비스는 수정하지 않음.
2. 현재 백업 브랜치 또는 고정 커밋의 `unni-global-clone` 폴더를 확보.
3. 기존 `thriving-education` 프로젝트의 `pgvector`를 재사용; 새로운 DB/기존 테이블 덮어쓰기 금지.
4. FastAPI 신규 서비스와 설정을 먼저 복원·배포 후 `/health`, `/cache/status` 확인.
5. React/Vite 신규 서비스의 `VITE_GATEWAY_BASE`를 해당 API URL로 설정 후 빌드·배포.
6. 모바일 웹 / , /events?q=Botox, /events/70809 경로와 FastAPI 원본 프록시를 검증.
7. 원본 API의 미검증 계약이나 외부 이미지·콘텐츠 재사용 권리를 해결하기 전에는 '전체 데이터/전체 UI 복제 완성'으로 보고하지 않음.

## 검증한 웹 화면
- https://unni-mobile-web-production.up.railway.app/
- https://unni-mobile-web-production.up.railway.app/events?q=Botox
- https://unni-mobile-web-production.up.railway.app/events/70809

위 세 화면은 React/Vite에서 원본 공개 웹의 표시 데이터를 읽는 **기초 모바일 프로토타입**이다. 강남언니 앱의 모든 UI·동작이 1:1로 복제된 것은 아니며 Android APK에서 찾은 서버 후보를 아직 정식 앱 API로 인증하지 않았다.
