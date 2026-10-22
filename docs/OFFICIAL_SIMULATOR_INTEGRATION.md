# 위쳇알리 — 공식 미니앱 검증 실행기

## 현재 구성
- Railway의 기존 thriving-education/prebook-api가 관리자 및 테스트 큐를 제공한다.
- 공개 관리자: \`https://prebook-api-production-9b80.up.railway.app/manager\`
- **관리자 API**는 \`ADMIN_API_TOKEN\`의 Bearer 인증이 없으면 수정할 수 없다.
- 관리자에서 채널 제목·상품 노출·소싱 상품을 수정하면 WeChat/Alipay의 \`/v1/channels/{channel}/home\`에 즉시 반영된다.
- 우측 미리보기는 자체 데이터 프리뷰이며 실제 네이티브 에뮬레이터가 아니다.
- 별도 PC 실행기가 공식 개발도구를 실행하고 작업 결과를 관리자에 회신한다. 플랫폼 AppID/계정이 없으면 실제 QR/코드 업로드는 수행하지 못한다.
- 임의의 자동 배포 또는 심사 제출은 절대 수행하지 않는다.

## PC 실행기
Windows/macOS에 GitHub 프로젝트를 체크아웃한다.

1. WeChat Developer Tools를 설치하고, IDE 보안 설정에서 CLI/HTTP 접근을 허용한다.
2. Alipay Mini Program Studio를 설치한다. Alipay+ 대상은 계정에서 공식 \`@antglobal/miniprogram-cli\` CLI 키를 발급해 초기화해야 한다. Alipay 중국 본토 및 Alipay+ 플랫폼은 계정·도구·심사 요구가 다를 수 있다.
3. \`cd scripts && npm install\`
4. \`npm install -g @antglobal/miniprogram-cli\`
5. 환경변수 \`ADMIN_API_TOKEN\`(Railway 서비스 비밀변수와 동일), \`WECHAT_DEVTOOLS_CLI\`(개발자 도구 CLI 파일의 실제 경로), \`ALIPAY_MINIPROGRAM_ID\`, \`ALIPAY_WORKSPACE_ID\`, \`ALIPAY_SUPER_APP_ID\` 를 **해당 PC에만** 설정한다.
6. \`node channel-runner.js\`

관리자에서 '공식 테스트 요청'을 생성하면 실행기가 8초 간격으로 새 작업을 읽어 다음을 수행한다.
- **WeChat preview**: miniprogram-automator → WeChat Developer Tools 실행 → 홈 진입 → 실제 스크린샷을 관리자 DB로 전송.
- **Alipay preview**: miniprogram-cli preview → 테스트 QR 출력(PC 터미널) → 결과 로그 전송. Studio 내부 시뮬레이터 화면 스크린샷 자동화는 별도 구현 과제.
- **코드 업로드 요청**: 반드시 관리자에서 명시적으로 요청하고, PC의 \`ALLOW_OFFICIAL_UPLOAD=YES\` 환경변수가 설정되어야 실행한다. WeChat은 \`miniprogram-ci\`의 APPID·privateKeyPath·버전, Alipay는 계정 CLI 초기화·버전이 필요하다. **코드 업로드와 플랫폼 심사·승인은 서로 다르다.**

참고: Alipay+ MiniProgram CLI의 upload 기능은 해당 앱 유형·appX2 지원조건을 충족해야 한다. 현재 AXML/ACSS 기본 프로젝트는 반드시 Studio에서 호환성 테스트 후 업로드한다.

## 플랫폼 준비 확인
- WeChat: 미니프로그램 AppID, 운영주체, 업종·사업자 검증, HTTPS request domain 등록, 개발 도구 로그인, 미리보기 권한, 정식 심사자료
- Alipay: 운영주체·워크스페이스·미니프로그램·Super App ID, 계정 권한, 서버 도메인 허용, DSL/appX2 호환성, 심사자료
- 소싱: 기존 \`C:\touranal\` 코드는 현재 접근 가능한 GitHub 52개 중 별도 저장소가 없다. 통합 관리자에 수동 소싱·게시 데이터 구조는 추가했으며, 실제 수집기 코드는 원본 확보 후 연계한다.
- 공개 판매·결제: 현 단계에서는 모두 **비활성화**되어 있다.

## 보안
- \`ADMIN_API_TOKEN\`, WeChat private key, Alipay CLI Access Keys를 GitHub에 커밋하지 말 것.
- 공식 개발도구는 로컬 PC에서만 실행하고 Railway Linux 서비스에 GUI를 설치하지 않는다.
- \`/manager/api/*\`는 토큰 보호. 관리 URL의 existence 자체가 권한을 의미하지 않는다.
- 기존 pgvector 데이터베이스에는 \`korea_prebook_\` 접두사의 별도 테이블만 생성한다.
