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
