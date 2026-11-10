# 나만의닥터 6.50.0 — 원본 Android 실기기·에뮬레이터 픽셀 게이트

## 엄격한 판정

- 원본 앱 `com.merakiplace.mydoctor` v6.50.0의 **실제 포그라운드 화면**이 확보되지 않으면 **픽셀 유사도 측정 0/0, 미통과**.
- Hermes 코드와 API JSON으로 재구성한 웹 화면, 원본 사이트 HTML 화면, 구글 플레이 프로모션 이미지, Android 홈 런처 화면을 원본 Android 화면의 정답으로 간주하지 않음.
- React Native Hermes 바이트코드의 문자열과 HTTP 함수만으로 `View`/스타일/레이아웃의 정확한 픽셀 크기와 좌표를 증명할 수 없음.
- 원본 화면 `android_<screen>.png`와 브라우저 `web_<screen>.png`를 각 390×844로 정규화하여 `abs(RGB)>25` 픽셀 비율 <=10%인 경우에만 합격; 오차 heatmap + 50/50 overlay 필수.
- 페이지 구조·진입 상태·폰트·이미지 로딩을 맞춘 후 별도로 스크롤 위치/전환 버튼/목록 셀/상세 등을 검증.
- 스크린샷에는 로그에서 `VERIFIED_TOP_ACTIVITY=...com.merakiplace.mydoctor...` 확인과 사용자 업로드 Hermes SHA256 `6c99d3d6766668dd29909eb49edb92a004e588b7f49c8f93a54730c31e9a4802` 일치 증거가 필요.

## 실제 XAPK 구조 / 재현 실패 원인

- 사용자 첨부 `나만의닥터_6.50.0.xapk`: `base.apk`, `split_0.apk`, `split_1.apk`, `split_2.apk`.
- `split_0.apk`에 `lib/arm64-v8a/libreactnative.so`가 존재. 앱 본체는 ARM64 라이브러리를 필요로 함.
- 2026-11-10 이전 Android 15 x86_64 Google APIs 에뮬레이터에서 `adb install-multiple` 완료 이후 실행 시 즉시 종료.
- 로그: `SoLoaderDSONotFoundError: couldn't find DSO to load: libreactnative.so`; `topResumedActivity`는 Android Launcher.
- 이전 `android_home.png`가 실제로는 Android Launcher임에도 잘못 `MEASURED`로 해석된 기록이 있음. 이 픽셀 비교 결과는 **무효**. 현재 스크립트는 원본 포그라운드 증거 없으면 픽셀 측정 금지.
- ARM64 macOS GitHub Hosted Runner 테스트도 이전에 실제 원본 화면 확보에 실패. macOS ARM64 CPU라는 사실만으로 Android ARM64 에뮬레이터가 지원되는 것은 아님.
- Google Play x86_64 Android 15 image 대체 실험은 **실제 앱 프로세스와 원본 화면이 캡처되는지** 확인하기 위한 것; 장치 호환 보장이 아님.

## 작업 진행 정책

1. 실행 가능한 ARM64 Android 런타임 확보. XAPK 서명/원본 Hermes 일치 확인, `adb install-multiple`, 앱 실행/포그라운드 PID 검사.
2. **오리지널 앱** 화면별 원본 PNG + UI XML 수집: 홈, 가격 비교, 의사, 병원, 약국, 상세. 로그인 요구 화면은 정상 인증 상태에서 별도 검증.
3. 동일 기기 비율·상태바/내비게이션 바·폰트·안전영역을 맞춘 Railway 웹 캡처.
4. 화면별 픽셀 heatmap·overlay 생성, 오차 큰 레이아웃/색상/이미지/텍스트 영역 우선 수정.
5. 각 화면 오차 10% 이하인 경우에만 개별 통과. API 데이터/클릭 통과를 픽셀 통과로 대체하지 않음.

## 검증 증거

- GitHub Actions: `.github/workflows/mydoctor-native-android-pixel-parity.yml` / `mydoctor-native-arm64-original-pixels.yml`.
- 원본 이미지 검사기: `mydoctor-clone/android-reference/compare_pixels.py`.
- 원본 설치 및 실제 포그라운드 검사: `mydoctor-clone/android-reference/capture_original.sh`.
- 원본 XAPK에서 추출한 이미지/폰트 자료는 원본 화면 캡처가 되기 전에는 근거 수준을 구분해 분석.

**현 상태:** 픽셀 정확도 미검증. 이전 클릭 100%/API 200 결과는 픽셀 일치와 별개의 사항.
