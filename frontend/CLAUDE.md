# frontend/ — 모바일 웹

이 디렉터리 규칙은 레포 루트 `CLAUDE.md`에 더해 적용된다.

## 스택

- 프레임워크: React 19 + TypeScript, Vite 6
- 테스트: Node 내장 `node --test` (Node 23.6 이상, `.ts`를 그대로 실행)
- 배포: 정적 빌드 → Vercel 또는 Cloudflare Pages
- API 타입: `docs/api/openapi.json`에서 `openapi-typescript`로 생성한 `src/api/schema.d.ts`

## 반드시 지킬 것

- 화면 문구는 전부 일본어로 쓴다. 한국어는 한마디 카드의 질문과 상대 대답 예시에만 쓴다.
- 한마디 데이터는 `content/phrases.json`을 번들에 넣어 쓴다. 카드는 네트워크를 기다리지 않고 탭 후 1초 안에 보여야 한다.
- API 호출은 `src/api/` 한 곳에서만 한다. 요청·응답 타입은 생성된 타입만 쓰고 손으로 쓰지 않는다.
- 에러 응답은 `{code, message_ja}` 형식이다. `message_ja`를 그대로 보여 준다.
- 기준 브라우저는 iOS Safari와 Android Chrome이다. 모바일 세로 화면 우선.
- `prefers-reduced-motion`이면 복주머니·도장 애니메이션을 생략한다.
- TTS: `speechSynthesis`, `lang='ko-KR'`, `rate=0.85`. 지원하지 않으면 듣기 버튼을 숨긴다. iOS는 사용자 탭 안에서 호출해야 소리가 난다.
- 도장: "알아들었어요"를 누르면 애니메이션을 먼저 보여 주고(낙관적 UI), 실패한 요청은 localStorage 큐에 넣었다가 온라인이 되면 다시 보낸다.
- QR 자동 로그인: `#login=<id>.<password>` 해시를 읽어 로그인한 뒤 `history.replaceState`로 해시를 지운다.
- `backend/`의 파일은 수정하지 않는다. API가 더 필요하면 필요한 필드를 정리해서 제안한다.

## API 계약이 바뀌었을 때

```bash
npx openapi-typescript ../docs/api/openapi.json -o src/api/schema.d.ts
```

## 명령

```bash
cd frontend
npm install
cp .env.example .env.local   # 백엔드 로그인 전까지 쓰는 체험 계정 (커밋하지 않음)
npm run dev                  # 개발 서버. /api는 http://localhost:8000으로 넘김
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

- `src/core/`: 로직 (저장 연결 `store.ts`, 로그인 흐름 `session.ts`, 이름 후보 `names.ts`, 도장첩 `stamps.ts`, 듣기 `speak.ts`). 화면 코드 없음
- `src/ui/`: 화면. 화면 상태는 `flow.ts`의 리듀서 하나로 관리. 저장소에 직접 닿지 않고 `Store`로만 저장한다
- `src/data/`: 한마디(`content/phrases.json`을 읽음), 체험 계정(`.env.local`), 한자 한국음 표
- 지금 `Store`는 기기 저장(localStorage) 구현이다. 백엔드 API가 정해지면 `src/api/`에 같은 모양의 구현을 만들어 `main.tsx`에서 바꿔 끼운다
