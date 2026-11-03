# KOREA-PREBOOK × HITEL — 상품별 비공개 상담 통합

## 현 구현 범위 (2026-11-04)

- WeChat 및 Alipay 미니앱의 상품 상세 → 상담 신청 → 고유 요청 토큰 → 상태 조회
- 기존 상품 등록자/상담사 연결은 서버가 지정하며, 동일한 시술의 개별 마케팅 상품은 서로 다른 상품 ID로 기록
- 화장품은 실제 상담사가 등록되지 않았으면 빈 값으로 유지; 자동으로 임의의 판매자나 상담사를 만들어내지 않음
- 관리자 페이지 `/manager/product-consultations`에서 접수/배정/준비/종료 처리
- HITEL `/private-consultation?consultation=<UUID>`로 진입할 경우 기존 HITEL API가 인증하고 해당 참여자가 초대된 *비공개* 상담방인지 확인
- 활성 상담방 UUID 중복 배정은 DB 제약으로 차단
- **중요:** 링크를 받거나 요청이 `ready`로 표시되는 것은 WebRTC 연결·실제 초대 완료·의료 예약 확정의 증거가 아님

## 현재 실제로 검증한 것

- Python API 계약 테스트 및 테스트 데이터베이스 동작
- WeChat/Alipay의 페이지 JavaScript 구문 및 모의 API 신청/상태/영상 URL 차단 흐름
- HITEL TypeScript/Vite 빌드
- **미검증:** WeChat/Alipay 정식 개발자 도구/실기기 미디어, 두 기기 상호 영상/음성, HITEL 실서버 참가 권한, 승인 도메인

## 런타임 플래그 — 기본은 모두 비활성

KOREA-PREBOOK `prebook-api`:

| 변수 | 용도 |
|---|---|
| `PRODUCT_CONSULTATIONS_ENABLED` | `true`일 때에만 POST 상담 요청 허용 |
| `WECHAT_HITEL_VIDEO_ENABLED` | WeChat에 영상 입장 링크를 발급할지 결정 |
| `ALIPAY_HITEL_VIDEO_ENABLED` | Alipay에 영상 입장 링크를 발급할지 결정 |
| `HITEL_PRIVATE_CONSULT_URL` | 정확히 `https://hitel-room-production-ecce.up.railway.app/private-consultation` 값만 허용 |
| `ADMIN_API_TOKEN` | 서버 관리자 페이지의 API 인증(기존 설정 유지) |
| `DATABASE_URL` | 기존 PostgreSQL만 사용; 다른 Railway 프로젝트나 DB를 만들지 않음 |

HITEL 웹:

| 변수 | 용도 |
|---|---|
| `VITE_PRIVATE_CONSULTATIONS_ENABLED` | `true`여야 `/private-consultation` 진입 활성화, 기본 거부 |

두 제품 모두 `main` 및 운영 배포와 별도 테스트 브랜치에서 변경합니다. 플래그를 무조건 켜지 마십시오.

## 외부 계약과 한계

상품 신청 기록과 HITEL 계정은 **아직 신뢰할 수 있는 고객 식별자로 결합되지 않았습니다.** 현재의 HITEL 개발용 로그인(`/auth/dev-token`)은 운영 사용자 인증이 아닙니다. 따라서 회원 계정 매핑, 상담사 및 고객 참가 권한 부여, 실제 HITEL 비공개 방 생성 API 인증, 공식 미니앱 AppID/승인 도메인 등록이 모두 필요합니다.

HITEL 기존 API 클라이언트는 `/telemedicine/consultations` 생성, `/telemedicine/consultations/{id}` 조회, `session:join` / `session:ready` / `session:start` 시그널링을 사용합니다. 요청 UUID만으로 세션을 만드는 기능은 없습니다. 서버에 존재하고 초대가 승인된 비공개 방에만 연결하여야 합니다.

`web-view` 기반 영상 화면은 임시 통합 경로이며 WeChat 및 Alipay에서 카메라·마이크와 실시간 양방향 WebRTC가 실제 사용 가능한지 **승인된 앱·실기기에서 시험하기 전까지 완료로 인정하지 않습니다.** 플랫폼 제한 때문에 필요할 경우 해당 플랫폼의 네이티브 RTC SDK·컴포넌트로 교체하고 영상서버와 호환성 검증을 해야 합니다. WeChat에서는 `live-pusher`/`live-player` 사용 권한이 별도로 요구될 수 있습니다.

## 반드시 통과해야 할 실기기 시험

1. 실제 등록된 상품 A의 요청을 WeChat에서 신청 → 동일한 상품 ID가 관리자 목록에 저장되는지 확인
2. 다른 마케팅 상품 B의 요청도 생성하고 A와 상담사가 같아도 서로 다른 요청으로 보관되는지 확인
3. 담당 상담사와 고객의 **신뢰할 수 있는 계정**을 HITEL에 등록/매핑
4. 기존 HITEL 서버에서 초대 기반 비공개 방 1개를 실제 생성하고 정확한 요청에 배정
5. 타 사용자, 공개방, 잘못된 UUID, 종료된 방에서 입장이 거부되는지 확인
6. WeChat과 상담사 웹 간 영상·음성 상호 송수신(원본/가면, 마이크 제어, 퇴장·재입장) 실제 검증
7. Alipay에서 동일하게 실시, 각 플랫폼 공식 개발/배포 도메인 승인 및 미디어 권한 확인
8. 실주문·결제·의료 예약 확정을 위 단계와 별도 테스트. 상담 신청을 예약 확정으로 표시하지 않음

## 자동 테스트 실행

```bash
cd backend && PYTHONPATH=. pytest -q
cd .. && node tests/consultation_miniapp_flow.test.cjs
find miniapps/wechat/pages miniapps/alipay/pages -name '*.js' -print0 | xargs -0 -n1 node --check
```

진행 상황은 인증된 관리자 API `/manager/api/product-consultations/readiness`로 확인합니다. 이 API의 `hitel_identity_verified` 및 `physical_device_video_verified`는 현재 항상 `false`로 보고되어 실기기 성공과 혼동하지 않도록 합니다.


## 공식 미니앱 회원 인증 (2026-11-04 추가)

**현재는 코드 및 자동 테스트 단계이며 공식 플랫폼 계정에서 실로그인은 검증되지 않았습니다.**

### 구조

1. WeChat: 상품 상담 화면 진입 후 \`wx.login()\` → 임시 code → 우리 API의 \`POST /v1/miniapp-auth/exchange\` → 서버에서 WeChat \`code2Session\` 호출 → 성공한 OpenID 검증.
2. Alipay CN: \`my.getAuthCode({scopes:['auth_base']})\` → 임시 authCode → 동일한 우리 API → Alipay \`alipay.system.oauth.token\` RSA2 서명 요청 → Alipay 공개키로 응답 서명 검증 → User ID 확인.
3. 고객 식별 원문(OpenID/Alipay User ID)은 브라우저에 반환하거나 DB에 저장하지 않음. 대신 \`HMAC-SHA256(MINIAPP_IDENTITY_PEPPER, platform:app_id:provider_id)\` 결과로 고객 식별.
4. 서버 세션은 12시간 유효한 불투명 임의 토큰으로 발급. DB에는 토큰 SHA-256 해시만 기록하며, 만료 및 로그아웃 시 사용할 수 없음.
5. 상담 신청 시 \`Authorization: Bearer <miniapp_session>\`을 제출하며 클라이언트가 주장하는 플랫폼이 검증된 세션과 다르면 거부.
6. \`GET /v1/product-consultations/mine\`을 통해 동일 계정이 다른 기기에서 자신의 기존 신청을 복구. 요청 상태 조회도 소유자와 일치해야 함.
7. 동일한 검증 회원·동일한 상품의 활성 상담 신청은 고유 슬롯을 이용해 한 건으로 취급. 다른 마케팅 상품은 독립된 신청이고, 완료/취소 후 새로운 신청 가능.
8. 기존 익명 상담은 개발용 호환성을 위해 비운영 환경에 남아 있으나, \`APP_ENV=production\`에서는 새 요청 및 이전 익명 조회를 허용하지 않음.

### 반드시 설정할 서버 환경 변수 (원문은 GitHub에 커밋 금지)

| 이름 | 기능 |
|---|---|
| \`MINIAPP_IDENTITY_EXCHANGE_ENABLED=true\` | 공식 인증 코드 서버 교환 활성화 |
| \`MINIAPP_IDENTITY_PEPPER\` | 32자 이상의 고엔트로피 비밀키, 사용자 식별값 HMAC |
| \`WECHAT_APP_ID\`, \`WECHAT_APP_SECRET\` | WeChat 미니앱 자격 증명 |
| \`ALIPAY_MINIPROGRAM_ID\` | Alipay CN 미니앱 ID |
| \`ALIPAY_RSA_PRIVATE_KEY\` | Alipay 앱의 RSA2 개인키 |
| \`ALIPAY_PLATFORM_PUBLIC_KEY\` | 실제 Alipay 서명 검증용 공개키 |
| \`APP_ENV=production\` | 미니앱 신원 확인 필수로 강제 |

**보안:** 앱 비밀키 및 Alipay 개인키는 서버의 비밀 변수로만 설정합니다. 관리자는 개인정보 및 비밀키를 응답·로그·PR에 게시해서는 안 됩니다. 인증 교환 엔드포인트는 외부 플랫폼 연동·요청량 제한·감사로그 정책까지 점검한 후 노출하십시오.

### HITEL 계정 연결은 별도 작업

현재 HITEL 플랫폼 API가 갖춘 계정 인증은 한국 휴대전화 OTP와 기존 Fly 개발 토큰 기반 영상 신호 체계가 별개입니다. 위챗 또는 알리페이 사용자가 가진 중국 플랫폼 계정이 HITEL 세션 자격으로 **자동으로 인정되지 않습니다.** 이를 위해서는 HITEL에서 위챗알리 공식 인증을 검증하는 신뢰할 수 있는 서버 간 연동 및 해당 상담방 참가자 권한 매핑이 필요합니다.

현재 \`/private-consultation\`은 기존 Fly 세션의 참가자 여부 검증 로직이며, \`VITE_PRIVATE_CONSULTATIONS_ENABLED\` 기본 비활성입니다. 임의의 사용자 식별자를 Fly 개발 토큰으로 발급하여 우회해서는 안 됩니다.

### 문서 확인 출처

- WeChat \`code2Session\`: https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2Session.html
- Alipay \`my.getAuthCode\`: https://idocs.alipay.com/miniprogram/miniprogram/mpdev/api_openapi_getauthcode
- Alipay CN OAuth Token: https://iopenhome.alipay.com/docs/ac/solution_api/oauth_token
