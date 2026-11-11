# 나만의닥터 Android 6.50.0 — Hermes HBC 96 UI 복원 근거 및 실제 반영

분석 대상: 사용자가 업로드한 XAPK의 `base.apk/assets/index.android.bundle`.
원본 번들 SHA256:
`6c99d3d6766668dd29909eb49edb92a004e588b7f49c8f93a54730c31e9a4802`.

## 검증 방법

- `hermes-dec 0.1.8` HBC 96 바이트코드 파서를 GitHub Actions에서 확인된 배포본으로 설치하여 함수별 명령을 직접 디스어셈블.
- **함수 내부의 JSX/JSXS, View, ScrollView, TouchableOpacity, Image, Font 및 StyleSheet.create 객체와 상수를 확인**. 단순 문자열 검색과 구분.
- 서버 API는 실제 원본 공개 `GET /patient-api/app/configure/HomeNavigationConfig/` HTTP 200 결과와 응답 구조로 별도 확인.
- Android 원본 화면 자체의 스크린샷은 확보하지 못했으므로 픽셀 유사도 측정은 **미완료**. 함수 구조 재구성이 픽셀 합격을 뜻하지 않음.

## 원본 홈 구성

| 원본 Hermes 함수 | 바이트코드로 확인한 항목 | 웹 소스 반영 |
|---|---|---|
| #45594 `HomeScreen` | `ScrollView`, `bounces:true`, `scrollEventThrottle:16`, `contentContainerStyle {gap:12,paddingTop:12}`; 자식 배열에 `HomeNavigationSection`, `AdBanner`, `HomeBusinessRegistrationInformation` 및 앞선 컴포넌트 존재 | 홈 섹션 간격 12; 배너 위치 조정. 전체 선행 컴포넌트 미복원 |
| #45644 `HomeScreenGNB` | `TopGNBV2` `left=logo`, `rightItems=[search,giftbox,bell]` | 홈 상단 아이콘/구조 교체 |
| #45633 | `HOME_SCREEN_HORIZONTAL_MARGIN=12` | 12px 사용 |
| #45992–45993 `HomeNavigationSection` | `flexDirection:row`, `gap:12`, `marginHorizontal:12`; 카드 `backgroundColor:white,flex:1,borderRadius:16,padding:12,gap:12,justifyContent:center,alignItems:center`; `SvgIcon hospitalLocation size40`; `Font type=h4`, `병원/약국\n찾기` | 카드 배치/간격/크기 변경. SvgIcon 원본 벡터는 미복원 |
| #46003 | 나머지 카드: `Image source.uri=imageUrl`, `width:40,height:40`, `Font type=h4`, `title`; `navigationUrl,isOpenBrowser,minimumVersion,shouldCheckLogin` | 공개 원본 원격 JSON으로 제목·이미지 표시 |
| #46011–46013 | `getConfig({key:"HomeNavigationConfig"})` | 원본 백엔드 `app-config?config_key=HomeNavigationConfig` 호출 |
| #22854, #23143 | `GET patient-api/app/configure/{key}/`, 값 `data.value` JSON | 허용 키 1개로 제한한 읽기 전용 원본 API 게이트웨이 |
| #45648–45649 `MedicalAppointmentSection` | 카드 `borderRadius:16`, `marginHorizontal:12`, `paddingVertical:12`; 구획 `paddingHorizontal:12`; 구분선 `height:1,marginHorizontal:12,marginVertical:8`, `Font type=h3` `비대면 진료`, `최저가 병원 예약`; 원본 버튼 `모든 증상 보기` | 서비스 카드 제목·여백·탭 및 버튼 수정. 세부 행 완전 복원 전 |
| #45959 `HomeBusinessRegistrationInformation` | 법적 문구 `이용약관`, `개인정보처리방침`, `위치기반서비스이용약관`, `광고 문의 : sales@merakiplace.kr` | 홈 하단 법적 문구 추가 |
| #48386 `HospitalListScreenComponent` | `TopGNB`, `FlashList`, 30건 단위 요청, 상태·정렬·새로고침 | HBC96 목록 셸·원본 API 연결 구현; 원본 인증 필요로 실제 목록 데이터 미확보 |

## 실제 원본 서버 `HomeNavigationConfig` 응답

공개 GET HTTP 200; `data.value` JSON 문자열에 2개 원격 카드:

| 원본 카드 문구 | 원본 딥링크 화면 | 주의 |
|---|---|---|
| `다이어트\n주사 기록` | `WegovyRecordBridgeScreen` | `shouldCheckLogin=true` |
| `수액\n최저가 예약` | `IvFluidPurposeScreen` | 원본 딥링크; 웹 상세 화면 복원 전 |

고정 병원·약국 카드 1개와 설정 기반 원격 카드 2개, 총 3개.
이미지는 원본 JSON의 `https://img.my-doctor.io/...` URL에서 표시. 서버값이 없으면 임의 카드로 대체하지 않음.

## 현재 변경 파일

- `frontend/src/NativeAppHome.jsx`: 원본 카드 구성/실제 설정·이미지·딥링크; 기존 별도 웹 사이트 링크는 펼침형으로 격리
- `frontend/src/styles.css`: Hermes 상수 기반 12px/16px/40px 및 홈 GNB
- `frontend/src/App.jsx`: 홈 GNB 원본 배열 구성
- `backend/app/native_catalog.py`: 실제 원본 설정 경로 GET, `HomeNavigationConfig` 키만 허용·24시간 DB 캐시
- `frontend/tests/native-app-layout.cjs`: 실제 390×844 모바일 Chrome 탭 테스트에 원본 홈 설정/3카드/딥링크 검증 추가

## 미검증 항목

1. 원본 Android 스크린샷이 없으므로 RGB 픽셀 오차 10% 이하 판정 **불가**.
2. 원본 홈 선행 컴포넌트, 실제 `SvgIcon hospitalLocation` 벡터와 RN 폰트 계측 차이 미완료.
3. `WegovyRecordBridgeScreen`, `IvFluidPurposeScreen`의 자체 웹 화면, 로그인 분기, 스티키 탭·동적 세그먼트 및 나머지 화면은 별도 복원 필요.
4. 원본 API의 401/인증 요구 화면은 익명으로 전체 데이터 검증 불가.
5. 웹 클릭 통과와 원본 Android UI 동일성 통과는 **별개**.

**원칙:** 실제 Hermes 바이트코드/응답에서 확인되지 않은 UI 구성은 `original`이라고 표시하지 않음.

## 2026-11-11 추가: 병원 목록 HBC96 UI 역추적 및 실제 배포

원본 `base.apk/assets/index.android.bundle`을 Hermes HBC 96 파서로 직접 읽어 확인한 값입니다.

| 실제 Hermes 함수 | 코드로 확인된 사실 | 클론 구현 |
|---|---|---|
| #48385 `HospitalListScreen` | `HospitalListFilterContextProvider(verticalKey,defaultFilterValues,screenRouteParams)` | 원본 vertical key 전달 |
| #48386 `HospitalListScreenComponent` | `TopGNB({left:'backButton',center:'title',backgroundColor:white})` | 병원 찾기 상단·뒤로 가기 |
| #48386 | `useInfiniteHospitalListV2` 초기 `offset:0,limit:30` | 원본 병원 API 30건 단위 요청 |
| #48386 | `FlashList`, `ListHeaderComponent`, `ListFooterComponent`, `ListEmptyComponent`, `RefreshControl` | 헤더·병원 행·새로고침·에러/빈 상태 분리 |
| #48386 | `onEndReachedThreshold:0.01`, `estimatedItemSize:50` | 요청 임계값·추정 행 크기 명시 |
| #48388 `renderListHeader` | `count`, `ordering`, `setOrdering`, `sortingList`, `isFetching`, `verticalKey` 전달 | 실제 정렬 옵션·병원 수 표시; 원본 데이터가 있는 경우만 |
| #27143 `getHospitalSortingList` | `GET patient-api/v2/hospital/sortings`, `params.vertical_key` | 허용 목록에 API 연결 |
| #30064 `HospitalListItem` | 행 하단선 `1px #f1f2f4`, 위아래 여백 20, 요소 간격 12; `name,near_subway_name,visiting_hour,badges,image,expense_display` | 원본 반환 필드만 표시하는 목록 행 |
| #48415 `EmptyHospitalListScreen` | 문구 `조건을 만족하는 병원이 없어요.` | HTTP 200이면서 결과 0건일 때만 |
| #48414 스타일 | 빈 화면 `paddingTop:120`, 중앙 배치, 이미지 `56×56` | 빈 화면 중앙 배치 및 위치 반영 |

**실제 실행 결과:** GitHub Actions [42948278055](https://github.com/lyonbegin/korea-prebook-miniapps/actions/runs/42948278055), Chromium 모바일 390×844에서 로컬 10/10 및 Railway 10/10 통과. 운영 사이트 직접 홈 원본 메뉴 20/20, 가격 링크 31/31 클릭 통과; 브라우저 JS 오류 0건.

**병원 원본 API 제한:** 익명 요청은 로그인 필요 상태(401)입니다. 모바일 테스트의 병원 목록 행은 **0개**이며, 가짜 병원 자료로 채우지 않습니다. 로그인 필요 상태와 재시도 동작까지 검사했습니다. 실제 병원 목록 카드의 데이터 렌더링과 원본 Android 스크린샷 기반 픽셀 오차는 아직 검증되지 않았습니다.

변경 코드:
- `frontend/src/NativeHospitalListScreen.jsx` — 30건 원본 페이징, 목록/헤더/새로고침/빈 상태/정렬
- `frontend/src/App.jsx` — 원본 병원 목록 경로 교체 및 TopGNB 구분
- `frontend/src/styles.css` — HBC96 행 여백·테두리·빈 상태 스타일
- `frontend/src/lib/originalGateway.js`, `backend/app/native_catalog.py` — 원본 정렬 API 허용 경로
- `frontend/tests/native-app-layout.cjs` — 원본 병원 화면 상태·동작·가짜 검색 폼 제거 확인

**완료 판정 범위:** 원본 Hermes 근거를 반영한 레이아웃·기능 구현 및 운영 브라우저 실행 검증. 원본 Android 화면과의 픽셀 동일성은 미검증.
