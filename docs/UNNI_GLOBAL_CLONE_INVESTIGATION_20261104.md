# UNNI Global 독립 복제 — 조사 체크포인트
기준일: 2026-11-04 KST
상태: **BLOCKED / 미완료**. 실행 가능한 복제 사이트, DB, 배포 주소는 아직 없습니다.

## 1. 범위와 보호
대상 원본: https://unni.app/us
저장소: lyonbegin/korea-prebook-miniapps
신규 브랜치: feature/unni-global-full-clone-20261104 (main에서 생성)
예정 신규 Railway 서비스: unni-global-clone
프로젝트: KOREA-PREBOOK / 2fb3dd38-5040-4293-9064-f75eca99beed
환경: production / 9cda2445-dfb1-4f72-80f1-4d18b894654c

먼저 첨부 복구 문서와 GitHub main의 docs/WECHAT_ALIPAY_INTEGRATED_RESTORE_2026-11-04.md를 읽었습니다.
GitHub 문서 blob SHA: 102a5fc186382139639f67e26042b38926c89b3f

이번 작업에서 기존 코드, main, backup/*, 서비스, 도메인, DB에 쓰기를 수행하지 않았습니다.
기존 올리브영 시스템과 통합하지 않았습니다.
Railway environment-status 읽기 결과:

| 서비스 | 상태 | 실행 배포 ID |
|---|---|---|
| wechat-emulator | Online / SUCCESS / replica 1 | d3c559ab-5eb4-4346-b00f-7bc801464c21 |
| alipay-emulator | Online / SUCCESS / replica 1 | a4b97d28-df5f-4350-b9a9-5a9b80c8496c |
| miniapp-emulator-console | Online / SUCCESS / replica 1 | 204d8240-662b-40ee-9bac-ccef9bc54d13 |
| ktaxback-original-live | Online / SUCCESS / replica 1 | 4feeb0fa-709a-4b42-8d92-57e2a05000c3 |

4개 배포 ID가 복구 문서와 일치합니다. pendingWork 없음. 이 확인은 기존 서비스의 전체 사용자 기능 테스트를 뜻하지 않습니다.

## 2. 직접 관찰
클라우드 브라우저에서 https://unni.app/us 접속, DOM 및 화면 캡처를 수행했습니다.
브라우저 viewport 평가값: 1363 × 936.
DOM에는 검색, 14개 대분류 링크, 이벤트 카드, 가격, 평점, 후기 건수, 콘텐츠 링크, 주요 메뉴가 존재합니다.
하지만 캡처에는 앱 배너가 뷰포트 대부분을 차지하여 정상 사이트 레이아웃의 비교 기준을 확보하지 못했습니다.
재접속 및 새로고침 후에도 같은 결과였습니다.
Playwright의 Procedures 링크 클릭 시 예상 /us/events 대신 콘텐츠 상세 경로가 열렸습니다. 원인 미확정이며 원본의 정상 동작이라고 단정하지 않습니다.

확인된 콘텐츠 상세 URL:
https://unni.app/us/contents/402d9338-d3d4-81e6-962b-e426777633d2

### 홈페이지 DOM에서 확인한 주요 경로
경로 발견은 해당 화면의 구현/동작 검증 완료를 의미하지 않습니다.

| 유형 | 실제 링크 | 상태 |
|---|---|---|
| 홈 | https://unni.app/us | DOM 조사, 렌더링 기준 확보 실패 |
| 병원 목록 | https://unni.app/us/hospitals | 경로 발견, 상세 조사 미완료 |
| 시술 목록 | https://unni.app/us/events | 경로 발견, 상세 조사 미완료 |
| 커뮤니티 | https://unni.app/us/community | 경로 발견, 상세 조사 미완료 |
| 콘텐츠 목록 | https://unni.app/us/contents | 경로 발견, 상세 조사 미완료 |
| 검색 | https://unni.app/us/search?category=Lifting | 카테고리 링크 확인, 동작 미검증 |

### 대분류 14개
각 링크는 /us/search?category= 뒤에 아래 명칭을 URL 인코딩한 값입니다.
Lifting, Skin, Botox, Filler, Rhinoplasty, Eye, Face Contour, Breast, Body, Hair, Hair Removal, K-Med, Dental, Others.
이는 화면상의 명칭과 URL 확인이며 원본 카테고리 ID나 전체 중·소분류를 확보한 상태가 아닙니다.

### 화면 증거
[원본 렌더링 문제 캡처](https://chatgpt.com/library?file_id=libfile_9404d513f99481919d99c6cba75e66f7&account_id=personal)

## 3. 기술적 차단 사유
- 클라우드 브라우저 정상 시각 기준 확보 실패.
- DOM 조회에서 외부 stylesheet link 6개의 sheet 참조가 false로 관찰되었으나, 브라우저 DOM 조회 제약 가능성도 있어 이것만으로 CSS 네트워크 차단이라고 결론내리지 않습니다.
- 별도 curl HEAD로 https://unni.app/assets/css/fonts.css 는 HTTP 200을 확인했습니다. 따라서 사이트 전체 장애 또는 접속 차단으로 단정할 근거가 없습니다.
- 로컬 Playwright 실행: Chromium 실행 파일 없음.
- npx playwright install chromium: 내려받은 브라우저 아카이브의 “End of central directory record signature not found” 오류로 설치 실패.
- 원본이 봇 차단 화면을 제공한 증거는 없습니다.

정상 원본 화면·모바일·상태 캡처 없이 추측한 UI를 만들지 않았습니다. 시각 검증 차단 상태에서 샘플 사이트를 배포하지 않았습니다.

## 4. 수집 및 재사용 권한
홈페이지에서 다음 약관 링크를 확인:
https://www.notion.so/healingpaper/Terms-of-Use-for-UNNI-from-November-20th-2024-237d9338d3d48172bb40fd386d3ed7e8

웹 읽기 도구는 본문 접근 오류, HTTP 문서 추출은 JavaScript 필요 안내만 확인했습니다.
따라서 약관 본문과 재사용 라이선스는 **확인되지 않았습니다**.
공개 열람 가능성을 재배포 허락으로 간주하지 않습니다.
원본 이미지·상표·후기 전문·시술 설명을 복제 서비스에 배포하지 않았습니다.
공식 제공/사용허락 확인 대상: 브랜드/로고, 사진/영상, 상세 광고 콘텐츠, 컬럼 전문, 후기 전문·사진, 전체 DB 재사용 및 최신화 권한.
가격·주소 등 사실 정보도 출처·시점·확보 근거와 이용 범위를 필드별로 기록해야 합니다.

## 5. 데이터 현황
| 종류 | 확인/저장 상태 |
|---|---|
| 대분류 | 화면 명칭 14개 확인, DB 저장 0 |
| 중·소분류 | 미확보 |
| 병원 | DB 저장 0 |
| 의사 | DB 저장 0 |
| 이벤트 | DB 저장 0 |
| 전체 옵션 | DB 저장 0 |
| 가격·평점·후기 메타데이터 | 일부 홈 DOM에 노출 확인, 정규화/DB 저장 0 |
| 이미지/콘텐츠 재사용 승인 | 0건 확인 |

관찰된 일부 홈 카드 수를 전체 데이터 수로 보고하지 않습니다. PostgreSQL은 생성하지 않았습니다.

## 6. 검증표
| 검사 | 결과 | 근거 |
|---|---|---|
| 복구 문서 선행 확인 | PASS | 첨부 및 GitHub main 문서 읽음 |
| 신규 브랜치 생성 | PASS | GitHub create_branch 성공 |
| 기존 서비스 배포 기준 확인 | PASS | 4개 Online, 배포 ID 문서와 일치 |
| 원본 홈페이지 DOM 접근 | PASS | 14개 분류/5개 주요 메뉴 확인 |
| 원본 정상 화면 확보 | FAIL | 배너 확대 상태 지속 |
| 데스크톱·모바일 동일 해상도 비교 | 미검증 | 원본 시각 기준/복제본 없음 |
| 전체 카테고리 이동 | 미검증 | 링크 발견만 수행 |
| 검색·필터·정렬 | 미검증 | UI 동작 조사 미완료 |
| 목록 → 상세 → 옵션·가격 변경 | 미검증 | 구현 전 |
| 병원·의사 연결 | 미검증 | 구현 전 |
| 로그인·상담·예약 흐름 | 미검증 | 구현 전 |
| DB 건수·관계·누락 검증 | 미검증 | DB 미생성 |
| 복제본 콘솔·네트워크 | 미검증 | 복제본 없음 |
| Railway 신규 서비스 배포 후 접속 | 미검증 | 신규 배포 없음 |
| 저작물 재사용 권한 | 미검증 | 허락/약관 본문 확인 불가 |

## 7. 향후 데이터/API 연결 설계 (제안, 구현 아님)
기존 K-TAXBACK 서비스에는 연결/변경하지 않습니다.
독립 PostgreSQL DB에는 최소 다음 관계를 사용하도록 제안합니다.
- source_records: source, entity_type, original_id, original_url, fetched_at, permission_status, evidence.
- categories: 부모 category 연결.
- hospitals, doctors, hospital_doctors.
- events: 병원 연결, event_categories 중간 테이블.
- event_options: event 연결, 통화/원화 가격, VAT 여부, 유효시점.
- review_metrics: 집계 평점·건수만; 후기 전문과 분리.
- media_assets: 라이선스/사용범위가 확인된 파일만 서비스용으로 승인.
- external_product_links: 향후 K-TAXBACK 상품 ID 연결용. 현 단계에서는 비활성.
원본 ID를 얻지 못한 항목에 임의 ID를 원본 ID처럼 기재하지 않습니다.
API 계약 제안:
GET /api/categories, /api/events, /api/events/:id, /api/hospitals/:id, /api/doctors/:id.
상담은 실제 연결 제공자가 정해지기 전까지 전송 완료를 가장하지 않습니다.
향후 통합은 독립 서비스 검증 후 별도 승인된 작업으로 실행합니다.

## 8. 재개 및 복구
현재 신규 브랜치의 조사 문서만 복구 대상입니다. 실행 앱 복구 문서로 오인하지 마십시오.
서비스 ID, DB ID, 배포 ID, 공개 URL은 아직 존재하지 않습니다.
다음 순서:
1. 정상 렌더링 가능한 승인된 브라우저에서 원본 데스크톱·390×844 모바일 및 상호작용 상태를 캡처.
2. 페이지 유형과 원본 ID/관계·옵션을 실제 조사로 확정.
3. 콘텐츠별 사용권한을 기록하고 허용된 데이터를 수집·검증.
4. 같은 신규 브랜치에 독립 앱 및 DB 마이그레이션 구현.
5. KOREA-PREBOOK 내부 새 서비스와 전용 PostgreSQL 생성, 기존 서비스 설정 변경 금지.
6. 원본/복제본 비교와 실제 사용자 흐름 테스트 후에만 완료 보고.

