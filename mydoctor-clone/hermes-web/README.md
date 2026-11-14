# 나만의닥터 6.50.0 — 원본 Hermes → React 모바일 웹

목표: 기존 모바일 웹 코드를 별도로 다시 그리는 대신, 사용자 제공 XAPK의
`assets/index.android.bundle`에 들어 있는 **실제 Hermes HBC96 UI 코드**를
복원하여 React DOM/`react-native-web`에서 최대한 재사용한다.

## 원본 무결성 및 확인한 결과

- `com.merakiplace.mydoctor`, v6.50.0
- Hermes SHA-256: `6c99d3d6766668dd29909eb49edb92a004e588b7f49c8f93a54730c31e9a4802`
- 원본 bytecode 약 12.3MB; 전체 decompiled JavaScript 약 31.4MB.
- 대상 UI 함수 10개 선택 추출 성공, JavaScript 문법 검사 통과.
- 전체 JavaScript 문법 검사 통과. 이것만으로 실제 모듈 로딩/화면 실행 성공을 뜻하지 않음.
- 확인된 원본 이미지·폰트 등 asset 항목 394개.
- React Native Web의 View, Text, ScrollView, Image, Pressable 렌더링 검사 통과.
- 원본 전체 UI의 React DOM 실행과 실제 클릭/스크롤 결과는 **미완료**.

## 소스와 실행

- `extract_original_ui.py`: XAPK 내부 번들 SHA256 대조, 10개 네이티브 UI 함수 decompile, 구조적 감사 JSON 생성
- `audit_full_bundle.py`: 전체 HBC96 → JavaScript 디컴파일, 문법 검사, 격리 VM 실행 가능성 검사
- `frontend/src/RecoveredHermesWebScreen.jsx`: 추출된 UI component tree를 React Native Web으로 변환하는 엄격한 렌더러
- `frontend/vite.config.js`: `react-native` 모듈을 `react-native-web`으로 alias
- `frontend/tests/hermes-web-verification.cjs`: 브라우저 DOM용 RN 기본 컴포넌트 렌더링 확인
- `.github/workflows/mydoctor-hermes-to-web.yml`: 실제 XAPK에서 자동 검증 실행

원본 상용 bytecode, 전체 디컴파일 JS, 이미지 자산은 공개 GitHub 저장소에 업로드하지 않는다.
CI는 확인된 SHA256의 원본 패키지를 일시적으로 확보하여 검사하고, 구조 감사 결과만 저장한다.

## 현재 기술적 한계

Hermes 디컴파일 결과가 정상적인 JavaScript 문법을 가져도
RN 네이티브 TurboModules/Android JSI, Metro 모듈 로더, 네트워크/스토리지,
플랫폼 전용 UI 컴포넌트에 대한 의존성이 해결되지 않으면 React 웹에서 직접 실행되지 않는다.
즉 `react-native-web` alias는 **기반 렌더러**일 뿐 원본 앱 전체가 동작한다는 증거가 아니다.

최종 합격 조건은 복원된 **원본 화면 내용**이 브라우저의 DOM으로 실제 표시되고
하단까지 스크롤·터치·화면 이동·데이터 바인딩을 통과하는 것이다.


## GPT 화면 변환 자동화 (2026-11-14)

- `gpt_ui_port.py`: 실제 HBC96 원본 SHA256 확인 후 홈/병원 목록 화면별 Hermes 함수 추출, GPT-6.1 Sol Responses API로 부분 UI 트리 변환.
- `--generate`는 `OPENAI_API_KEY`가 있는 경우에만 모델을 호출. `--screen all`로 두 화면을 변환하며, `--generate` 없이 실행하면 원본 검증된 작업 계획만 생성.
- `tests/test_gpt_ui_port.py`: 가짜/근거 없는 완성 판정, 잘못된 UI 타입, 위험한 딥링크를 거절하는 단위 테스트.
- `frontend/src/HermesGptPreview.jsx`: 별도 경로 `/native/hermes-preview?screen=home`에서 변환 결과를 보여줌. 결과가 없으면 의도적으로 원본 UI 실행 미검증으로 표시.
- GH Actions의 `mydoctor-hermes-to-web.yml`은 환경에 API 키가 있는 경우 GPT 결과를 `audit/gpt-generated/*.json`으로 만든 뒤 별도의 Vite preview build에 복사함. 운영 Railway 서비스에는 반영하지 않음.

**현재 기준:** 변환기와 미리보기 수용 구조가 추가되었으며, GPT를 통한 실제 원본 화면 변환·브라우저 실행 성공 여부는 CI 결과 및 생성 결과에 따라 별도 검증해야 함.
