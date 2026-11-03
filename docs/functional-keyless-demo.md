# 위챗·알리페이 상품 상담 — 별도 인증키 없는 기능 테스트

## 테스트 페이지

https://prebook-keyless-consult-demo-production.up.railway.app/demo

이 페이지는 기존 KOREA-PREBOOK 프로젝트에서 분리한 `prebook-keyless-consult-demo` Railway 서비스에서 실행합니다. **실제 사용자·병원·예약·결제와 연결되지 않습니다.** 해당 서비스는 `APP_ENV=demo`로 시작하며 자체 SQLite 테스트 DB만 사용합니다. 기존 `prebook-api`와 HITEL 운영 서비스를 변경하지 않습니다.

## 직접 확인할 기능

1. WeChat 또는 Alipay 고객 패널에서 상품 하나를 선택하고 '상담 신청'을 누르십시오.
2. 해당 신청이 같은 페이지의 상담사/관리자 목록에 표시되는지 확인하십시오.
3. 상담사 화면에서 '상담사 배정 + 방 생성'을 누르십시오.
4. 상담사 화면의 '상담사 영상 입장'과 해당 고객 패널의 '고객 영상 입장'으로 **별도의 브라우저 창 두 개**를 여십시오.
5. 각각 '카메라·마이크 준비' 버튼을 누르십시오. 화면의 WebRTC 상태가 실제 `connected`로 전환되는지 확인하십시오.
6. 소리·영상의 상호 송수신을 확인하고, 마이크 끄기·카메라 끄기·퇴장·재연결을 시험하십시오.
7. 상담사 패널에서 '종료'를 누르면 열려 있는 방이 종료되는지 확인하십시오.

서로 다른 네트워크에서는 STUN 단독 연결이 실패할 수 있습니다. TURN이나 HITEL 실제 서버로 연결되었다고 주장하지 않습니다.

## 실제 미니앱 소스

- `miniapps/wechat` — 테스트 전용 상품 목록→상세→상담 신청→상태 조회→고객 영상 페이지
- `miniapps/alipay` — 같은 서버와 같은 상품 데이터, 해당 플랫폼의 네이티브 UI

두 미니앱의 `app.js`는 이 **기능 테스트 브랜치에서만** 테스트 서버 주소를 사용합니다. 메인 브랜치 및 운영 미니앱 설정은 바꾸지 않았습니다.

정식 WeChat/Alipay 미니앱 개발자 도구와 단말은 아직 확인하지 않았습니다. 내장 `web-view`에서 브라우저 WebRTC와 카메라/마이크가 동작하는지 공식 플랫폼 테스트가 별도로 필요합니다. 공식 인증키나 외부 플랫폼 로그인은 본 테스트에 요구하지 않습니다.

## 내부 서버 구조

- `backend/app/functional_demo.py`: 데모 상품 다섯 가지, 신청 DB, 상담방 배정 및 종료, WebSocket 시그널링.
- `backend/app/functional_demo.html`: WeChat/Alipay 고객 패널 및 상담사 패널.
- `backend/app/functional_demo_call.html`: 양쪽 WebRTC 브라우저 카메라/마이크 및 실시간 연결상태.
- `backend/tests/test_functional_demo.py`: 실제 HTTP API·DB·2개 WebSocket 참가자 교환 테스트.
- `tests/consultation_miniapp_flow.test.cjs`: WeChat/Alipay 네이티브 페이지 스크립트의 상품·상담·영상방 흐름 테스트.
- `tests/demo_frontend_syntax.test.cjs`: 데모 HTML 브라우저 스크립트 문법 검사.

## 테스트 실행

```bash
cd backend
python -m pip install -r requirements-dev.txt
PYTHONPATH=. pytest -q
cd ..
node tests/consultation_miniapp_flow.test.cjs
node tests/demo_frontend_syntax.test.cjs
APP_ENV=demo uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

이후 `http://127.0.0.1:8000/demo`에서 위 순서를 확인할 수 있습니다.

### 테스트 전용 주의

이 실험실은 키 없이 접근하는 **공개 테스트 서비스**이므로 누구나 테스트 상품 신청 내역 및 해당 상담방에 접근할 수 있습니다. 실명·전화번호·민감정보·진짜 의료 상담을 입력하거나 나누시면 안 됩니다.

기능 구현 및 검증 중에는 공식 플랫폼 API 인증이나 유료 서비스 인증키 설정을 요구하지 않습니다. 정식 운영 사용자 인증은 실제 기능을 별도로 검증한 후 진행할 사항입니다.
