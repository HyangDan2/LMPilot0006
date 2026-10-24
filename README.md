# LMPilot Web MVP

LMPilot0004 PySide6 코딩 보조 앱의 흐름을 브라우저에서 사용할 수 있도록 옮기는 로컬 실행형 정적 웹 MVP입니다. 로컬 개발에서는 Vite 프록시를 통해 NVIDIA API 호환 엔드포인트를 호출합니다. 프로덕션 정적 빌드에는 앱 서버가 포함되지 않습니다.

## 실행

Node.js 20.19 이상이 설치된 환경에서 프로젝트 폴더에서 실행합니다. 자세한 기준은 [Vite 실행 환경 요구사항](https://vite.dev/guide/)을 참고하세요.

```bash
npm install
npm run dev
```

터미널에 표시되는 로컬 주소를 브라우저에서 엽니다. `file://`로 HTML을 직접 여는 방식은 사용하지 않습니다.

로컬 개발 서버는 `https://integrate.api.nvidia.com` 요청을 Vite 프록시로 전달하므로 NVIDIA API의 브라우저 CORS 제한을 피할 수 있습니다. 이 프록시는 개발 환경에서만 동작합니다. 프로덕션 정적 배포에서 NVIDIA 직접 호출이 CORS로 차단되면 별도 BFF/API 서버가 필요합니다.

## GitHub Pages에서 NVIDIA 사용하기

GitHub Pages에서는 NVIDIA 직접 호출이 CORS로 차단됩니다. 이 저장소의 `worker/index.js`는 별도 Cloudflare Worker로 배포하는 중계기입니다. Pages 배포와 Worker 배포는 별개입니다.

1. [Cloudflare 계정](https://dash.cloudflare.com/sign-up)을 만듭니다. 이 저장소를 로컬에서 열고 `npm ci`를 실행합니다.
2. `wrangler.toml`의 `ALLOWED_ORIGIN`이 실제 Pages 출처와 같은지 확인합니다. 현재 값은 `https://hyangdan2.github.io`입니다. URL의 `/LMPilot0006/` 경로는 출처에 넣지 않습니다.
3. `npx wrangler login`을 실행해 브라우저에서 Cloudflare 로그인을 마칩니다.
4. `npm run worker:deploy`를 실행합니다. 처음에는 `workers.dev` 하위 도메인을 선택하라는 안내가 나올 수 있습니다. 명령이 출력한 `https://...workers.dev` 주소를 기록합니다.
5. 프론트엔드 변경 사항을 GitHub Pages에 배포한 뒤, 앱의 **설정 → Base URL**에 `https://...workers.dev/v1`을 입력합니다. 모델명과 NVIDIA API-key도 입력하고 저장합니다. 키는 브라우저 저장소나 Worker 설정에 보관되지 않습니다.
6. **연결 테스트**를 누르고, 대화를 보내 스트리밍 응답을 확인합니다. 키는 새로고침하면 다시 입력해야 합니다.

Worker는 `/v1/models`의 GET과 `/v1/chat/completions`의 POST만 NVIDIA로 전달합니다. Pages 출처 외 브라우저 요청은 거부하고 요청 본문 크기를 2 MiB로 제한합니다. API-key와 대화 내용을 기록하는 코드는 없으며 `wrangler.toml`에서 Worker 관측 로그를 비활성화합니다. 다른 사용자가 이 공개 Pages 사이트를 이용할 경우에도 각자 NVIDIA 키를 입력해야 합니다. 이때 요청은 Worker를 경유하므로 이용자는 이 Worker 운영자를 신뢰해야 합니다. Worker 코드 변경 후에는 `npm run worker:deploy`를 다시 실행해야 합니다. 프론트엔드 변경 후에는 GitHub Pages를 별도로 갱신해야 합니다.

`ALLOWED_ORIGIN`은 일반 브라우저의 다른 웹사이트에서 보내는 요청을 막기 위한 CORS 제한이며 사용자 인증 수단은 아닙니다. Worker URL은 공개되므로 브라우저 밖의 클라이언트는 Origin을 흉내 낼 수 있습니다. 공개 사용량이 늘어나면 Cloudflare 사용량을 확인하고 별도 요청 제한을 도입해야 합니다. NVIDIA 호출 비용이나 할당량은 각 사용자가 입력한 NVIDIA 키에 적용됩니다.

로컬에서 Worker 동작을 검증할 때는 `npm run worker:test`를 사용합니다. Cloudflare 배포 명령과 로그인 절차는 [공식 Workers 시작 가이드](https://developers.cloudflare.com/workers/get-started/guide/)를 참고할 수 있습니다.

## 사용

1. 설정 버튼을 열어 Base URL, 모델명, API-key를 입력합니다.
2. 저장하면 Base URL과 모델명만 브라우저에 보관됩니다. API-key는 현재 탭의 메모리에서만 사용됩니다.
3. 대화를 시작하고 필요하면 “코드와 참고 자료 추가”에 코드, 이슈, Import Layer 내용을 입력합니다.
4. 좌측 대화 목록에서 이전 세션을 선택합니다. 모바일에서는 메뉴 버튼으로 목록을 엽니다.
5. “모든 로컬 데이터 지우기”는 확인 후 앱의 모든 대화와 저장 설정을 삭제합니다.

요청 본문에는 사용자 입력이 포함되며, 선택한 모델 제공자에게 전송됩니다. 프로덕션 정적 호스팅에서 NVIDIA API 직접 호출은 제공자와 브라우저 출처 간 CORS 정책에 따라 차단될 수 있습니다.

## 정적 빌드

```bash
npm run build
```

빌드 결과는 `dist/`에 생성됩니다. GitHub Pages처럼 저장소 하위 경로에서 호스팅할 경우 빌드 시 `VITE_BASE_PATH`를 해당 경로로 설정합니다. 정적 배포물에는 API-key나 개인 설정을 포함하지 않습니다.

## 문서

- AI 역할과 협업 규칙: [`docs/ai-harness.md`](docs/ai-harness.md)
- 시스템 구조와 데이터 정책: [`docs/architecture.md`](docs/architecture.md)
- 구현·평가 Todo: [`docs/todo.md`](docs/todo.md)
