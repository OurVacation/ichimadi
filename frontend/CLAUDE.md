# frontend/ — 모바일 웹

이 디렉터리 규칙은 레포 루트 `CLAUDE.md`에 더해 적용된다.

## 스택

- 프레임워크: React 19 + TypeScript, Vite 6
- 테스트: Node 내장 `node --test` (Node 23.6 이상, `.ts`를 그대로 실행)
- 배포: 정적 빌드를 Caddy 이미지에 넣어 GCP VM에서 서빙한다 (`deploy/web.Dockerfile`, [docs/INFRA.md](../docs/INFRA.md)). `/api`는 같은 주소에서 Caddy가 백엔드로 넘기므로 API 주소 설정이나 CORS가 필요 없다
- API 타입: `docs/api/openapi.json`에서 `openapi-typescript`로 생성한 `src/api/schema.d.ts`

## 반드시 지킬 것

- 화면을 만들거나 고치기 전에 [DESIGN.md](DESIGN.md)를 읽는다. 색은 `index.css`의 토큰만 쓰고, 밤·낮 두 테마에서 모두 확인한다.
- 화면 문구는 전부 일본어로 쓴다. 한국어는 한마디 카드의 질문과 상대 대답 예시에만 쓴다.
- 한마디 데이터는 로그인 직후 `GET /api/phrases`로 한 번 받아 기기에 캐시해 둔다(서버에 닿지 못하면, 즉 통신 실패·시간 초과·5xx면 캐시를 쓴다. 서버가 404나 이상한 응답을 주면 캐시를 지운다). 카드는 네트워크를 기다리지 않고 탭 후 1초 안에 보여야 한다.
- API 호출은 `src/api/` 한 곳에서만 한다. 요청·응답 타입은 생성된 타입만 쓰고 손으로 쓰지 않는다.
- 에러 응답은 `{code, message_ja}` 형식이다. `message_ja`를 그대로 보여 준다.
- 기준 브라우저는 iOS Safari와 Android Chrome이다. 모바일 세로 화면 우선.
- `prefers-reduced-motion`이면 복주머니·도장 애니메이션을 생략한다.
- TTS: `speechSynthesis`, `lang='ko-KR'`, `rate=0.7`. 지원하지 않으면 듣기 버튼을 숨긴다. iOS는 사용자 탭 안에서 호출해야 소리가 난다.
- 도장: "알아들었어요"를 누르면 서버를 기다리지 않고 도장 화면으로 간다(낙관적 UI). 저장은 `src/api/stampOutbox.ts`가 뒤에서 한다: 계정별 큐(`ichimadi:<계정>:pendingStamps`)에 넣고 하나씩 보내며, 통신 실패·시간 초과·5xx·401이면 남겨 두었다가 온라인이 될 때, 같은 계정으로 들어올 때, 남은 동안 30초마다 다시 보낸다. 404(없는 한마디)만 버리고 서버 문구를 보인다.
- QR 자동 로그인: `#login=<id>.<password>` 해시를 읽어 로그인한 뒤 `history.replaceState`로 해시를 지운다.
- `backend/`의 파일은 수정하지 않는다. API가 더 필요하면 필요한 필드를 정리해서 제안한다.

## API 계약이 바뀌었을 때

```bash
npm run api:types   # = openapi-typescript ../docs/api/openapi.json -o src/api/schema.d.ts
```

## 명령

```bash
cd frontend
npm install
npm run dev                  # 개발 서버 (서버 모드). /api는 http://localhost:8000으로 넘김
VITE_STORE=local npm run dev # 오프라인 시연 모드. .env.local의 VITE_TRIAL_ACCOUNTS (cp .env.example .env.local, 커밋하지 않음)
npm run api:types            # docs/api/openapi.json이 바뀌면 src/api/schema.d.ts를 다시 만든다
npm test                     # 로직 테스트
npm run build                # 타입 검사 + 배포용 빌드 (dist/)
```

### QR 카드

```bash
npm run qr -- --base-url https://<배포 주소>            # .env.local의 VITE_TRIAL_ACCOUNTS로 만든다
npm run qr -- --base-url <url> --accounts-file <path>   # 같은 형식(id:password,…)의 파일로 만든다
```

- 결과는 `qr-cards/`에 계정마다 PNG 하나와 인쇄용 `cards.html`(A4 한 장에 2×4)로 나온다. 실행할 때마다 폴더를 새로 만든다.
- QR 내용은 `<base-url>/#login=<id>.<password>`(각각 `encodeURIComponent`)이다. 앱의 QR 자동 로그인이 이 해시를 읽는다.
- `qr-cards/`에는 비밀번호가 들어 있다. `.gitignore`에 있으니 커밋하지 않는다.

## 구조

- `src/api/`: 서버 연결. `client.ts`(fetch 감싸개: `/api`, Bearer 토큰, 시간 제한, `ApiError`), `store.ts`(`Store` 구현), `names.ts`(이름 후보, 안 되면 임시 규칙), `phrases.ts`(한마디 받기·캐시), `stampOutbox.ts`(도장 보낼 큐), `schema.d.ts`(생성된 타입)
- `src/core/`: 로직 (기기 저장 `store.ts`, 처음 화면 `session.ts`, 이름 후보 임시 규칙 `names.ts`, 도장첩 `stamps.ts`, 듣기 `speak.ts`). 화면 코드 없음
- `src/ui/`: 화면. 화면 상태는 `flow.ts`의 리듀서 하나로 관리. 저장소에 직접 닿지 않고 `Store`로만 저장한다. 한마디는 로그인 때 받은 목록을 props로 받는다
- `src/data/`: 오프라인 시연용 한마디(`content/phrases.json`)와 체험 계정(`.env.local`), 한자 한국음 표
- 디자인(색·글꼴·한옥 요소·밤/낮 테마)은 **[DESIGN.md](DESIGN.md)**를 따른다. 테마 저장은 `src/core/theme.ts`, 한옥 그림은 `src/ui/hanok.tsx`
- `main.tsx`가 모드를 고른다. 기본은 서버 모드(`src/api/`), `VITE_STORE=local`이면 `localMode.ts`(기기 저장 + 체험 계정 + 번들 한마디)를 따로 불러온다. 서버 모드 빌드에는 체험 계정과 한마디가 들어가지 않는다
