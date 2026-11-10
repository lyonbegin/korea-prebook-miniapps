# 나만의닥터 Android 6.50.0 원본 API 역공학 — 실제 검증 상태 (2026-11-10)

기준 파일: 사용자가 제공한 `나만의닥터_6.50.0.xapk`.
원본 앱: React Native / Hermes Bytecode v96. 목표: **같은 데이터 구조로 React 모바일 웹 구축**.

## 전체 정적 분석 결과

- Hermes 함수 헤더 65,450개 중 정상 65,440개 정적 스캔 (오버플로 10개 미해독)
- 고유 API 경로 문자열 후보 **161개**: `patient-api` 153개, `core-api` 4개, 상대경로 4개
- API URL이 실제 바이트코드에서 사용된 참조 위치 **393건**
- 동일 함수 `GET/POST/PUT/PATCH/DELETE` + URL 문자열 기반 메서드·경로 조합 **321종**. GET 194 / POST 97 / DELETE 13 / PATCH 9 / PUT 8.
- HTTP 메서드까지 재구성한 정적 경로 후보 **157/161개**. 나머지 4개는 직접 관련 함수에서 메서드를 확정할 수 없음.
- `Screen` / `Page` 형식 화면명 **209개** 발견. 209개를 실제 독립 라우트나 완성된 UI로 주장하지 않음.

## 실제 원본 HTTP 요청·응답 검증

| 리소스 | 메서드/경로 | 원본 응답 | 근거 |
|---|---|---|---|
| 홈 메뉴 | GET `patient-api/app/home-menu/` | 200 | 실제 20개 |
| 홈 배너 | GET `patient-api/app/app-banner/` | 200 | 실제 8개 |
| 의사 목록 | GET `patient-api/doctor/doctors/` | 200 | 실제 10개 |
| 건강 정보 | GET `patient-api/health-lab/v2/home/` | 200 | JSON 반환 |
| 병원 V2 목록 | GET `patient-api/v2/hospital/` | **401** | 익명 요청 거부. 함수 27138; Allow: GET, HEAD, OPTIONS |
| 원래 잘못된 최저가 | GET `patient-api/medical-map/lowest-price/v2` | **404** | `/regions` 누락 |
| 최저가 카테고리 | GET `patient-api/medical-map/lowest-price/categories?vertical_key=mounjaro` | **200** | 4개 카테고리. 함수 27183 |
| 지역별 최저가 | GET `patient-api/medical-map/lowest-price/v2/regions?category_id=(원본응답ID)` | **200** | 전국 가격·지역 16개. 함수 27191 |

위 200은 **원본 HTTP·JSON 데이터 수신** 증거이며 전체 화면 픽셀·터치·예약 기능 검증과 구분해야 합니다.

## 대표적인 바이트코드 API 함수

| 함수 ID | 원본 함수 | 메서드 | 확인된 요청/필드 |
|---:|---|---|---|
| 27138 | getHospitalListV2 | GET | `patient-api/v2/hospital/`; params |
| 27139 | getHospitalFiltersByVertical | GET | `.../filters`; verticalKey |
| 27140 | getHospitalDetailV2 | GET | 병원 ID; verticalKey, unitId, isIncludeMedicineExpense |
| 27141 | getHospitalReservableTime | GET | 병원 ID + `/reservable_time/` |
| 27151 | getHospitalPricing | GET | 병원 ID, verticalKey, unitId |
| 31794 | getDoctorListV2 | GET | doctor/doctors; city_ids, district_ids, search_filter_keys |
| 27111 | getDoctorReservableTimeListByDoctorId | GET | doctor/doctors/{doctorId}/reservable-time |
| 27112 | getDoctorsByIdsV2 | GET | doctor/v2/doctors; doctorIds, mydLinkKey |
| 22820 | getPharmacistList | GET | pharmacist/pharmacy/ |
| 22803 | getPhamracyDetail | GET | pharmacist/nearby-pharmacy/{id}/ |
| 31312 | 익명 약국 V2 함수 | GET | pharmacist/v2/nearby-pharmacy; latitude,longitude,limit,offset |
| 22862 | getTelemedicineList | GET | telemedicine/telemedicine/ |
| 22860 | getPrescriptions | GET | telemedicine/telemedicine/{tm_id}/prescriptions/ |
| 27183 | 익명 가격 카테고리 함수 | GET | lowest-price/categories |
| 27187 | 익명 지역 V1 함수 | GET | lowest-price/regions |
| 27191 | 익명 지역 V2 함수 | GET | lowest-price/v2/regions |

`{...}`는 정적 함수 파라미터의 동적 구간이며 값/응답은 개인별로 다릅니다.

## 원본 인증 동작

- 네트워크 초기화 함수 22977: `X-OS-Type`, `X-App-Type`, `X-App-Version`, `X-Device-Name`, `X-Device-ID`, `X-AB-Test` 헤더 설정.
- `Authorization`에는 `Bearer ` + 유효한 사용자 토큰을 결합하는 로직이 존재.
- 함수 24025도 공통 인증 헤더 구성에 관여.
- 병원 API의 401을 해결하기 위해 **임의·탈취 토큰, 인증 우회, 사용자별 응답의 공용 DB 캐시를 사용하지 않음**. 정상 사용자 인증을 필요로 하는 화면과 익명 공개 API를 분리.

## 메서드가 남은 4개와 정적 분석 한계

- `patient-api/ad/events`: 함수 13924의 `HttpTransport` 생성에 사용; 일반 화면 읽기 API로 취급하지 않음.
- `patient-api/health-care/challenge/habit-message/?`: 함수 39927 `queryFn`; 요청 메서드 외부 환경 참조.
- `patient-api/payment/telemedicine/`: 함수 39934, user_id 조건을 포함한 결제 리소스; 메서드 미확정.
- `patient-api/payment/telepharmacy/`: 함수 39988, user_id 조건을 포함한 결제 리소스; 메서드 미확정.

## 개발 원칙

**API 함수·URL·GET/POST·필수 params·응답 JSON·인증 범위 검증 → 원본 Android UI와 데이터 모델 매핑 → 첫 공개 조회 응답 즉시 표시 및 비동기 PostgreSQL 캐시 → 후속 요청 DB → 화면 및 실제 클릭 검증** 순으로 진행.

전체 161개 분석 CSV, 321종 요청 조합 CSV, 209개 화면명 CSV, 런타임 증거표는 해당 대화에서 다운로드 가능한 번들로 제공. 코드/화면 구현 완료와 API 역공학 완료를 혼동하지 말 것.
