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
