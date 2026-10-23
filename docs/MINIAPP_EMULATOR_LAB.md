# 위쳇알리 · Railway 브라우저형 미니앱 에뮬레이터 관리센터

## 배포된 서버 (2026-10-24)

| 역할 | Railway 서비스 | 공개 URL |
|---|---|---|
| WeChat 개발 화면 | `wechat-emulator` | https://wechat-emulator-production.up.railway.app/emulator |
| Alipay 개발 화면 | `alipay-emulator` | https://alipay-emulator-production.up.railway.app/emulator |
| 통합 관리 UI | `miniapp-emulator-console` | https://miniapp-emulator-console-production.up.railway.app/console |
| 공통 원본 H5 | `ktaxback-original-live` | https://ktaxback-original-live-production.up.railway.app/k-taxback-shop.html |

각 서비스는 기존 `KOREA-PREBOOK` Railway 프로젝트 production 환경에 배치된 독립 Bun 함수입니다.
소스 스냅샷은 `scripts/emulators/*.ts`에 저장되며, Railway 함수 코드는 별도로 배포되어 있습니다. GitHub 커밋만으로 Railway 함수가 자동 갱신되는 것은 아닙니다.

## 구현 기능
- WeChat·Alipay별 독립 URL과 상태 검사 `/health`, 상품 데이터 상태 검사 `/diagnostics`.
- 모바일 상태바·헤더·방한 서비스 메뉴를 재현한 **브라우저 기반 에뮬레이터**. 쇼핑 진입 시 실제 K-TAXBACK React H5를 iframe으로 로딩.
- 중앙 관리 UI의 스마트폰 화면 병렬 표시, 5개 viewport, 방향 전환, 쇼핑/서비스 메뉴, H5 새로고침, 모의 네트워크 차단/복구, 독립 창 열기.
- 브라우저 postMessage로 명령 상태를 수집하고 원본 H5의 React 준비/런타임 오류 상태를 표시. H5 언어/탭 변경 요청은 원본 서버의 추가 어댑터가 처리하며, 원본 JSX는 수정하지 않음.
- 통합 관리 UI에서 각 서버 `/health` 및 Best/New/Hot Deal 3개 API 검사, 명령 로그 확인·복사.

## 중요한 범위 구분
- 이 서비스는 **브라우저 기반 미니앱 에뮬레이터 셸**이며 WeChat Developer Tools 또는 Alipay Mini Program Studio의 공식 네이티브 런타임 **아닙니다**.
- 플랫폼 AppID, CLI 업로드용 개인키, 도메인 허용·검증, 미니앱 코드 컴파일·QR 공식 미리보기·실기기 스크린샷은 **미구현**. 공식 SDK를 실행했다고 보고하지 말 것.
- `iframe load`와 `React ready`는 별도 이벤트입니다. 앱 표시 상태 검증에는 후자가 필요합니다.
- 관리 UI의 오프라인 모의 기능은 실제 OS 네트워크를 차단하지 않고 화면에 오프라인 오버레이를 표시합니다.
- 기존 K-TAXBACK 결제 기능은 비활성화돼 있습니다. 장바구니 저장은 앱 계정 연동·영구 DB 저장이 아닙니다.

## 테스트
- `GET /health`: 두 Railway 서비스와 공통 H5 서버의 HTTP 상태 확인.
- `GET /diagnostics`: Best, New, Hot Deal API 응답 200 확인.
- `GET https://miniapp-emulator-console-production.up.railway.app/qa`: 브라우저 중첩 프레임·postMessage 연동 검증용 페이지.
- 소스 수준 자동검사: GitHub Actions `emulator-ci.yml` (Bun 컴파일), `manager-ci.yml` (정적 미니앱 경로 검사 및 백엔드 테스트).
- 실기기 및 공식 플랫폼 SDK 검증은 별도로 수행해야 하며 완료로 판정하지 않습니다.
