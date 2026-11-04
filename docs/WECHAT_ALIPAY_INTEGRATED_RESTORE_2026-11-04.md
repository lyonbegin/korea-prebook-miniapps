# 위챗·알리페이 원본 H5 및 통합 관리센터 — 확정 복구 문서

**기준일:** 2026-11-04 (KST)  
**GitHub 저장소:** [lyonbegin/korea-prebook-miniapps](https://github.com/lyonbegin/korea-prebook-miniapps)  
**Railway 프로젝트:** `KOREA-PREBOOK`  
**문서 목적:** 사용자가 지정한 아래 3개 주소를, 나중에 코드 재작성 없이 정확한 GitHub 백업 소스로 다시 배포하고 통합 연결을 복원하는 것.

> **중요한 기술적 구분:** 이 세 주소는 **실제 위챗/알리페이 네이티브 미니앱이 아닌 브라우저형 K-TAXBACK 원본 React H5 및 통합 표시 화면**이다. GitHub의 별도 WXML/WXSS, AXML/ACSS 네이티브 소스와 혼동하지 말 것. GitHub 브랜치는 **Railway Function에 자동 연결되어 있지 않다**. 이 문서의 저장 파일은 당시 Railway에서 배포 중인 **단일 Bun Function 전체 소스**의 사본이다.

## 1. 복원해야 할 3개 고정 운영 주소

| 구분 | 고정 주소 | 목적 |
|---|---|---|
| 1. 위챗·알리페이 통합 관리센터 | https://miniapp-emulator-console-production.up.railway.app/console | 복원된 위챗·알리페이 원본 H5 화면을 각 iframe에 나란히 표시; 상태 검사·새로고침 |
| 2. 복원된 알리페이 화면 | https://alipay-emulator-production.up.railway.app/emulator | K-TAXBACK 원본 상품 목록·상세·옵션·설명·관련 상품을 제공하는 브라우저 H5 |
| 3. 위챗·알리페이 통합 검증 화면 | https://miniapp-emulator-console-production.up.railway.app/qa | 두 플랫폼 iframe 및 원본 H5·상품 목록·상세 API의 통합 검증 |

**통합에 필요한 네 번째 주소:** 위챗 원본 H5: https://wechat-emulator-production.up.railway.app/emulator

**공통 원본 데이터/화면 서비스:** https://ktaxback-original-live-production.up.railway.app/k-taxback-shop.html  
이 원본 서비스 자체도 복원할 수 있도록 아래에 **별도 전체 소스 백업**을 보관한다.

URL의 `?utm_source=chatgpt.com`은 추적용 매개변수일 뿐이며 복원에 필요하지 않다. **운영 기준은 위의 매개변수 없는 URL**이다.

## 2. GitHub 원본 백업: 브랜치, 경로, 고정 커밋

저장소: **https://github.com/lyonbegin/korea-prebook-miniapps**

| 실행 서비스 | GitHub 브랜치 | 전체 Bun 소스 파일 | 원본 소스 보존 커밋 | 당시 Git blob SHA |
|---|---|---|---|---|
| 위챗 화면 `wechat-emulator` | `backup/wechat-emulator-restored-20261104` | `backups/wechat-emulator/original-ktaxback-h5-deployed.ts` | `d9e30370d464426fac32615dfaf8583f6e648fea` | `7a41a42dd4b163317b16225871e883399f0b93c7` |
| 알리페이 화면 `alipay-emulator` | `backup/alipay-original-h5-restore-20261104` | `backups/alipay-emulator/original-ktaxback-h5-deployed.ts` | `aaf9019df5ac3ef3b68764b43a64ca95f01c61bd` | `7a41a42dd4b163317b16225871e883399f0b93c7` |
| 통합 관리·QA `miniapp-emulator-console` | `backup/alipay-original-h5-restore-20261104` | `backups/integrated-console/restored-dual-original-h5-console.tsx` | `b728f7f255d7518ff33b153600b652f0acecf9cc` | `c70feacbbb5cf1077f00eeb75d469936983de63c` |
| 공통 K-TAXBACK 원본 H5 `ktaxback-original-live` | `backup/alipay-original-h5-restore-20261104` | `backups/ktaxback-original-live/original-h5-source.ts` | `6b424f77644d1e72e0bf7e32ea120fdbeeab2f1c` | `cf3a47b400912a82baefb43e90624e57a26d121b` |

**원본을 찾는 가장 안전한 링크(불변 커밋 고정):**

1. [위챗 실행 소스 (63,293자)](https://github.com/lyonbegin/korea-prebook-miniapps/blob/d9e30370d464426fac32615dfaf8583f6e648fea/backups/wechat-emulator/original-ktaxback-h5-deployed.ts)
2. [알리페이 실행 소스 (63,293자)](https://github.com/lyonbegin/korea-prebook-miniapps/blob/aaf9019df5ac3ef3b68764b43a64ca95f01c61bd/backups/alipay-emulator/original-ktaxback-h5-deployed.ts)
3. [통합 관리센터·QA 실행 소스 (27,944자)](https://github.com/lyonbegin/korea-prebook-miniapps/blob/b728f7f255d7518ff33b153600b652f0acecf9cc/backups/integrated-console/restored-dual-original-h5-console.tsx)
4. [K-TAXBACK 공통 원본 H5 실행 소스 (63,276자)](https://github.com/lyonbegin/korea-prebook-miniapps/blob/6b424f77644d1e72e0bf7e32ea120fdbeeab2f1c/backups/ktaxback-original-live/original-h5-source.ts)

**검증 사실(2026-11-04):** 위챗·알리페이·통합센터 3개 모두 GitHub 백업 파일의 내용이 그 시점 Railway의 `deployedCode`와 **문자열 전체가 정확히 일치**함을 확인했다. 위챗과 알리페이 H5 백업은 코드가 완전히 같다. **플랫폼 구분은 Railway 서비스 도메인과 통합센터의 좌·우 iframe에서 이뤄진다.** 당시 Function은 브랜치 커밋으로 자동 배포되지 않았다.

**이전 상태로 되돌려야 할 때를 위한 추가 보존:**
- [알리페이 H5 복원 전 에뮬레이터 셸 소스](https://github.com/lyonbegin/korea-prebook-miniapps/blob/backup/alipay-original-h5-restore-20261104/backups/alipay-emulator/pre-restoration-index.tsx) — 22,503자
- [통합 관리센터 수정 전 소스](https://github.com/lyonbegin/korea-prebook-miniapps/blob/backup/alipay-original-h5-restore-20261104/backups/integrated-console/pre-original-h5-integration.tsx) — 27,198자
- [과거 위챗 에뮬레이터 셸 복구 소스](https://github.com/lyonbegin/korea-prebook-miniapps/blob/backup/wechat-emulator-restored-20261104/backups/wechat-emulator/original-restored-index.tsx) — 22,510자

**네이티브 미니앱 소스는 별개:**
- [위챗 WXML 상세페이지](https://github.com/lyonbegin/korea-prebook-miniapps/blob/main/miniapps/wechat/pages/shop/detail.wxml), [위챗 상세페이지 JS](https://github.com/lyonbegin/korea-prebook-miniapps/blob/main/miniapps/wechat/pages/shop/detail.js)
- [알리페이 AXML 상세페이지](https://github.com/lyonbegin/korea-prebook-miniapps/blob/main/miniapps/alipay/pages/shop/detail.axml), [알리페이 상세페이지 JS](https://github.com/lyonbegin/korea-prebook-miniapps/blob/main/miniapps/alipay/pages/shop/detail.js)

이 네이티브 파일들은 복원된 H5 Railway Function의 대체물이 아니다. 별도의 공식 미니앱 개발 도구/배포 파이프라인이 필요하다.

## 3. Railway 프로젝트·환경·서비스 식별자 (복구 대상 정확히 지정)

| 항목 | 값 |
|---|---|
| Railway 프로젝트명 | `KOREA-PREBOOK` |
| Railway `projectId` | `2fb3dd38-5040-4293-9064-f75eca99beed` |
| Railway 환경명 | `production` |
| Railway `environmentId` | `9cda2445-dfb1-4f72-80f1-4d18b894654c` |
| 위챗 `wechat-emulator` `serviceId` | `257837da-e969-4e26-9aca-333e4d3495b9` |
| 알리페이 `alipay-emulator` `serviceId` | `36f20448-51be-4a22-9b92-246b192a8d4b` |
| 통합센터 `miniapp-emulator-console` `serviceId` | `c851f3df-cc8f-4f7e-8342-798ca1675a4a` |
| 원본 `ktaxback-original-live` `serviceId` | `ea73ac46-0e01-43d3-a21f-3fabc97fd274` |
| 실행 형태 | 각 서비스는 **Railway Function / Bun 단일 소스**. GitHub 저장소 직접 연결 방식이 아님. |
| 이미지 (당시 서비스 설정) | `ghcr.io/railwayapp/function-bun:1.4.4` |
| 서버 포트 | `Bun.env.PORT`을 사용 (Railway가 할당) |

**2026-11-04 당시 SUCCESS로 확인된 배포 ID:**
- 위챗: `d3c559ab-5eb4-4346-b00f-7bc801464c21`
- 알리페이: `a4b97d28-df5f-4350-b9a9-5a9b80c8496c`
- 통합센터: `204d8240-662b-40ee-9bac-ccef9bc54d13`
- 원본 K-TAXBACK: `4feeb0fa-709a-4b42-8d92-57e2a05000c3`

배포 ID는 이 문서의 **시점 기록**이다. 이후 재배포할 때는 새 배포 ID가 발급되므로 GitHub의 **고정 커밋·백업 파일을 진짜 복구 기준**으로 삼는다. 서비스가 삭제되어 새로 생성된다면 Railway `serviceId`와 자동 배정 도메인도 달라질 수 있으므로 반드시 기존 서비스를 유지할 것.

## 4. 정확한 소스 복구 절차 (다시 작성하지 말 것)

### 작업 전 보존

1. Railway의 현재 서비스 **Function 전체 소스**를 먼저 별도 백업하고, 현재 서비스 ID·도메인·변수·배포 ID를 기록한다.
2. 저장소에서 위 표의 **고정 커밋/파일**을 다운로드한다. 다른 브랜치의 최신 `main` 코드 또는 22KB짜리 과거 셸 코드로 바꾸지 않는다.
3. 변경 대상 서비스가 **기존 Railway Function**인지 확인한다. GitHub Branch를 연결하는 방식으로 바꿔 배포하지 않는다.
4. 반드시 `production` 환경을 선택하고, 다른 서비스의 소스·도메인은 수정하지 않는다.

### 실제 복원 순서

**① 공통 원본 H5가 사라졌거나 오염되었을 경우에만 복구**

- 대상 서비스: `ktaxback-original-live` (`ea73ac46-0e01-43d3-a21f-3fabc97fd274`)
- 위 **원본 H5 실행 소스 63,276자**를 Railway Function 소스로 **전체 교체** 후 배포
- 확인 주소: `https://ktaxback-original-live-production.up.railway.app/k-taxback-shop.html`
- 원본 서비스가 정상이고 변경 이력이 없다면 **건드리지 말 것**.

**② 위챗 H5 복원**

- 서비스: `wechat-emulator` (`257837da-e969-4e26-9aca-333e4d3495b9`)
- 위 표의 위챗 **63,293자 전체 파일**을 해당 Railway Function 코드로 그대로 적용하고 배포
- **반드시** `/emulator` 경로가 K-TAXBACK 원본 H5 화면을 반환하는지 확인
- 확인: `https://wechat-emulator-production.up.railway.app/emulator`

**③ 알리페이 H5 복원**

- 서비스: `alipay-emulator` (`36f20448-51be-4a22-9b92-246b192a8d4b`)
- 위 표의 알리페이 **63,293자 전체 파일**을 해당 Railway Function 코드로 그대로 적용하고 배포
- 확인: `https://alipay-emulator-production.up.railway.app/emulator`

**④ 통합 관리센터 및 QA 마지막 복원**

- 서비스: `miniapp-emulator-console` (`c851f3df-cc8f-4f7e-8342-798ca1675a4a`)
- 위 표의 통합센터 **27,944자 전체 파일**을 해당 Railway Function 코드로 그대로 적용하고 배포
- 프레임 연결:
  - 왼쪽 `frame-wechat` → `https://wechat-emulator-production.up.railway.app/emulator`
  - 오른쪽 `frame-alipay` → `https://alipay-emulator-production.up.railway.app/emulator`
- 확인: `/console`, `/qa`
- 통합센터가 `/bridge/health?channel=wechat`, `/bridge/health?channel=alipay`를 통해 각 서비스의 H5/상품 상세 응답을 검사하는지도 확인.

**주의:** 백업된 `.ts` / `.tsx` 파일은 HTML 화면 일부가 아니라 **Bun 서버 라우트까지 포함하는 전체 실행 코드**이다. 임의로 HTML만 복사하거나 원본 상품 상세 소스를 새로 작성하지 말 것. Railway Function 코드의 **완전 교체**는 다른 코드를 삭제하므로 백업·서비스 ID 대조가 먼저다.

### CLI로 해당 백업 파일만 정확히 추출하는 예시

```bash
git clone https://github.com/lyonbegin/korea-prebook-miniapps.git
cd korea-prebook-miniapps
mkdir -p restore

git show d9e30370d464426fac32615dfaf8583f6e648fea:backups/wechat-emulator/original-ktaxback-h5-deployed.ts > restore/wechat-index.ts
git show aaf9019df5ac3ef3b68764b43a64ca95f01c61bd:backups/alipay-emulator/original-ktaxback-h5-deployed.ts > restore/alipay-index.ts
git show b728f7f255d7518ff33b153600b652f0acecf9cc:backups/integrated-console/restored-dual-original-h5-console.tsx > restore/console-index.tsx
git show 6b424f77644d1e72e0bf7e32ea120fdbeeab2f1c:backups/ktaxback-original-live/original-h5-source.ts > restore/original-ktaxback-index.ts

wc -c restore/*
cmp restore/wechat-index.ts restore/alipay-index.ts
```

`cmp`이 성공하면 당시 위챗·알리페이 H5 복원 소스가 동일함을 확인할 수 있다. 이 예시는 **소스 추출만 수행**하며 Railway를 자동 배포하지 않는다. 추출된 각 파일을 **반드시 위 표의 해당 Railway Function 서비스에만** 적용한다.

## 5. 재배포 후 필수 확인 주소 (읽기 전용)

### A. 세 페이지 직접 열기

1. **통합센터:** https://miniapp-emulator-console-production.up.railway.app/console
2. **알리페이:** https://alipay-emulator-production.up.railway.app/emulator
3. **통합 검증:** https://miniapp-emulator-console-production.up.railway.app/qa
4. **위챗 보조 확인:** https://wechat-emulator-production.up.railway.app/emulator

### B. 각 H5 및 상품 상세 API

| 테스트 | 주소 | 기대하는 결과 |
|---|---|---|
| 위챗 원본 화면 | https://wechat-emulator-production.up.railway.app/emulator | K-TAXBACK 실제 상품 목록 |
| 알리페이 원본 화면 | https://alipay-emulator-production.up.railway.app/emulator | K-TAXBACK 실제 상품 목록 |
| 통합 위챗 검사 | https://miniapp-emulator-console-production.up.railway.app/bridge/diagnostics?channel=wechat | `home`, `best`, `detail` 각각 `ok:true` |
| 통합 알리페이 검사 | https://miniapp-emulator-console-production.up.railway.app/bridge/diagnostics?channel=alipay | `home`, `best`, `detail` 각각 `ok:true` |
| 위챗 샘플 상품 상세 API | https://wechat-emulator-production.up.railway.app/details-info.json?prdtNo=GA230518746 | JSON `details`에 설명·성분·사용방법 필드 |
| 알리페이 샘플 상품 상세 API | https://alipay-emulator-production.up.railway.app/details-info.json?prdtNo=GA230518746 | JSON `details`에 설명·성분·사용방법 필드 |
| 위챗 상세 QA 화면 | https://wechat-emulator-production.up.railway.app/qa-ui?screen=detail | MEDIHEAL 샘플 상세·옵션·설명·관련 상품 표시 |
| 알리페이 상세 QA 화면 | https://alipay-emulator-production.up.railway.app/qa-ui?screen=detail | MEDIHEAL 샘플 상세·옵션·설명·관련 상품 표시 |

검증에 사용한 상세 샘플 상품 번호: `GA230518746` (SKIN1004). 기대 JSON 구조는 `details.whyWeLoveItText`, `details.ftrdIngrdText`, `details.howToUseText`.

**판정 기준:** Railway `SUCCESS`, HTML 로딩, API HTTP 200만으로 **상품 클릭→상세페이지→옵션 선택→장바구니 등 모든 인터랙션의 정상 작동을 보증하지 않는다.** 실제 브라우저 클릭 테스트는 따로 수행해야 한다. `/qa-ui?screen=detail`은 **샘플 상세 검증 화면**이지 모든 실상품 상세 클릭을 대체하지 않는다. 또한 `/bridge/diagnostics`는 `home`, `best`, `detail` 3개 엔드포인트만 검사한다. K-TAXBACK 원본 일부 다른 데이터 API가 별도 실패할 수 있으므로 전체 무결성으로 과장하지 말 것.

## 6. 원본과 통합센터가 연결되는 구조

```
Railway 프로젝트 KOREA-PREBOOK / production
│
├─ ktaxback-original-live (공통 K-TAXBACK H5 원본 · 보존)
│   ├─ /k-taxback-shop.html
│   ├─ /k-taxback-shop.browser.js
│   └─ 상품 목록/상세 및 관련 JSON 응답
│
├─ wechat-emulator    /emulator  ← 원본 React H5 전체 실행 소스
│
├─ alipay-emulator    /emulator  ← 동일 원본 React H5 전체 실행 소스
│
└─ miniapp-emulator-console
    ├─ /console  → frame-wechat + frame-alipay
    ├─ /qa       → 양쪽 iframe 및 API 검증
    └─ /bridge/health, /bridge/diagnostics
                    → 각 에뮬레이터 상품 목록·상세 API 검사
```

통합 관리센터의 iframe `src`는 각 Railway 서비스의 **고유 도메인**을 지정해야 한다. 두 플랫폼을 공통 원본 도메인 하나로 바꾸어 연결하면 독립 서비스 복원 여부를 검사할 수 없다.

## 7. 복구 금지사항 및 미래의 오해 방지

- **기존 소스 확인 없이 새 UI·가짜 상품 상세페이지를 만들지 말 것.**
- `main` 브랜치 네이티브 미니앱 파일과 **실행 중인 H5 Function 소스**를 서로 바꿔 쓰지 말 것.
- 기존 제품 상세 정보(이미지 갤러리, 옵션, 설명, 성분, 사용법, 관련 상품), 검색/목록 데이터를 제거하거나 간략 페이지로 대체하지 말 것.
- 세 서비스 중 하나만 복원하고 통합센터도 정상이라고 보고하지 말 것.
- **통합센터에서 기본적으로 지원되는 제어는 해당 H5 프레임 다시 불러오기 등으로 한정된다.** 이전 에뮬레이터 전용 오프라인 모의 및 전용 메시지 명령과 혼동하지 말 것.
- 기존 서비스·도메인을 삭제하지 말 것. 서비스 재생성 시 **자동 부여된 도메인의 재할당은 보장되지 않는다**.
- 데이터 제공처·이미지 CDN·상위 API가 향후 변경되면 같은 소스도 완전히 같은 화면을 보장하지 못한다. 원본 JSON 데이터 및 종속 서비스도 별도로 백업·검증할 필요가 있다.
- 복원 전후 **운영 소스와 GitHub 보관 파일의 전체 내용 일치 여부**를 확인하고, 검증되지 않은 기능을 정상이라고 보고하지 말 것.

## 8. 이 문서의 보존 전략

- 이 복원 문서는 `main` 브랜치 `docs/WECHAT_ALIPAY_INTEGRATED_RESTORE_2026-11-04.md`에 보관한다.
- 실제 실행 소스는 위 두 **backup/** 브랜치와 **불변 커밋 링크**로 각각 보존한다.
- 복원 소스에 관한 사실의 기준은 **2026-11-04 시점에 확인된 Railway `deployedCode`와 정확히 일치하는 GitHub 사본**이다.
- 이후 변경이 생기면 이 문서를 덮어써서 과거 기준을 지우지 말고, **새 날짜·새 배포 ID·새 원본 백업**의 변경 이력으로 추가 기록한다.
