# UNNI 원본 API: 빠른 응답 / PostgreSQL 후속 저장

기존 시스템과 완전히 분리한 신규 브랜치 `feature/unni-global-full-clone-20261104` 전용입니다.

**MISS:** React → FastAPI → 원본 서버에서 받아 즉시 스트리밍 → 전송 완료 후에만 Starlette BackgroundTask가 PostgreSQL에 원문 BYTEA INSERT. DB INSERT 대기는 화면 표시의 필수 단계가 아닙니다.

**HIT:** PostgreSQL에서 원래 응답 바이트와 필요한 헤더를 직접 반환. 원본 API 재호출 없음.

**BYPASS:** 로그인·상담·예약·계정·비공개 데이터, 캐시 금지 또는 크기 초과 응답은 저장하지 않고 원본 응답만 전달합니다.

```
React + Vite
  → GET /gateway/{service}/{original-path}?{original-query}
  → FastAPI → PostgreSQL SELECT(cache_key)
        ├ HIT: PostgreSQL BYTEA → React
        └ MISS: 원본 HTTP 스트리밍 → React
                  └ 응답 전송 후 BackgroundTask → PostgreSQL INSERT
```

## 구현 위치

- `backend/app/main.py`: FastAPI 비동기 원문 캐시 미들웨어
- `backend/tests/test_gateway.py`: MockTransport + FakePG 테스트 5개
- `backend/Dockerfile`, `backend/requirements.txt`: 새 독립 백엔드 환경
- `frontend/src/lib/originalGateway.js`: 원본 경로·쿼리를 유지하는 React/Vite 데이터 클라이언트

기존 GitHub 저장소 루트의 `Dockerfile`은 다른 시스템을 위한 것이므로 **신규 Railway 서비스는 반드시 `unni-global-clone/backend`를 root directory로 설정**해야 합니다. `DATABASE_URL`은 기존 DB가 아닌 신규 독립 PostgreSQL에 연결합니다.

## 필수 설정

- `DATABASE_URL`: 새 PostgreSQL 연결 URL
- `FRONTEND_ORIGINS`: 허용할 신규 React/Vite 도메인(개발 시 `http://localhost:5173`)
- `MAX_CACHE_BYTES`: 응답 하나의 최대 캐시 크기(기본 4194304)
- `GET /health`의 `cache:postgresql`: 실제 DB 연결 성공 표시

실제로 앱에서 쓰는 URL·HTTP 메서드·인증·응답 JSON을 아직 검증하지 않았습니다. APK에서 확인된 `mobile-bff.gangnamunni.com` 등은 원본 서버 **후보 주소**입니다. 로그인 우회나 제3자 저작물의 무단 재배포를 위한 코드가 아닙니다.

## 완료와 미완료

**완료:** Python 컴파일, 모의 API·모의 DB 5개 테스트, 원본 응답 바이트 보존, MISS→HIT, 개인정보 캐시 제외, 언어별 분리.

**미완료:** 실제 PostgreSQL 연결·실배포·원본 앱 API의 요청 확인, React 화면 전체 구현, 원본 앱과 픽셀 동일 UI 검증. 의료시술·가격의 장기 보존에 따른 갱신 정책은 추가해야 합니다.
