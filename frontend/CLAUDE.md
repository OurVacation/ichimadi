# frontend/ — 모바일 웹

이 디렉터리 규칙은 레포 루트 `CLAUDE.md`에 더해 적용된다.

<!-- TODO(준혁): FE 스택이 정해지면 아래 "스택"과 "명령"을 채운다. 이 HTML 주석은 Claude에게 전달되지 않는다. -->

## 스택

- (미정) 프레임워크:
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
# (스택 확정 후 채움) 개발 서버 / 빌드 / 린트
```
