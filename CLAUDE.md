# 이치마디 (イチマディ)

서울의 일본인이 한국어 한마디를 직접 말해 보고, 상대가 알아들으면 도장을 받는 모바일 웹 앱.
KOREC 해커톤 출품작. **코드 프리즈: 2026-11-29(일) 17:00.** 그 뒤에는 코드를 바꾸지 않는다.

## 레포 구조 (모노레포)

```
/
├─ CLAUDE.md            ← 이 파일 (공통 규칙)
├─ docker-compose.yml   ← 로컬 개발: db + api
├─ compose.prod.yml     ← 배포: caddy + api + db (현우 담당)
├─ Caddyfile            ← HTTPS, /api/* → api:8000
├─ content/phrases.json ← 한마디 콘텐츠의 유일한 원본 (FE 번들과 DB 시드가 같이 씀)
├─ docs/
│  ├─ api/openapi.json  ← API 계약. BE가 생성하고 커밋, FE가 타입을 생성
│  ├─ adr/              ← 설계 결정 기록 (ADR-001 …)
│  └─ meetings/         ← 회의록
├─ backend/             ← FastAPI (태원). 규칙은 backend/CLAUDE.md
└─ frontend/            ← 모바일 웹 (준혁). 규칙은 frontend/CLAUDE.md
```

## 담당

| 영역 | 담당 | 손대기 전에 |
|---|---|---|
| `backend/`, `docs/api/`, `docs/adr/` | 태원 | – |
| `frontend/` | 준혁 (UI 다듬기: 태영) | BE 작업 중에는 수정하지 않는다 |
| `compose.prod.yml`, `Caddyfile`, 배포 | 현우 | 변경이 필요하면 제안만 한다 |
| 발표용 확장 기능 (P2~P4) | 승환 | – |

## 제품 규칙 (모든 영역 공통)

- 화면 문구는 **전부 일본어**. 한국어는 "한마디"(질문·상대 대답 예시)에만 쓴다.
- 한마디 문장은 일본어 검수가 끝난 고정 문장이다. `content/phrases.json` 밖에서 문장을 만들거나 바꾸지 않는다. 런타임에 LLM으로 문장을 생성하지 않는다.
- MVP 범위는 M1~M7과 한국식 이름 도장이다. 아래는 **만들지 않는다**: 회원가입, STT 발음 평가, GPS, 레벨 테스트, 서울 장소 한마디.
- 완료 기준: 체험용 계정으로 로그인해서 **1분 안에 도장 하나**를 받는다. 이 기준을 느리게 만드는 변경은 하지 않는다.
- 동시 사용자는 수십 명 이하다. 확장성보다 단순함과 현장 안정성을 고른다.

## API 계약

- 계약의 원본은 `docs/api/openapi.json`이다. BE 엔드포인트를 바꾸면 이 파일을 다시 생성해서 같은 커밋에 넣는다.
- FE는 API 타입을 손으로 쓰지 않는다. `openapi.json`에서 생성한다.
- 모든 API는 `/api` 아래에 있다. 에러 응답은 항상 `{"code": "...", "message_ja": "..."}` 형식이다.
- 인증: `Authorization: Bearer <JWT>`. 회원가입 API는 없다. 계정은 스크립트로 미리 발급한다.

## 자주 쓰는 명령 (레포 루트에서)

```bash
docker compose up -d db api          # 로컬 DB + API (http://localhost:8000/api/docs)
docker compose run --rm api pytest   # 백엔드 테스트
docker compose logs -f api           # API 로그
```

## Git

- 브랜치: `feat/be-<기능>`, `feat/fe-<기능>`, `fix/<내용>`, `infra/<내용>`. `main`에 직접 push하지 않는다.
- PR은 작게 만든다. PR 설명에 어떤 기능(M1~M7, P2…)인지 적는다.
- `.env`, 계정 CSV(`*.accounts.csv`), 비밀번호, 토큰은 커밋하지 않는다.
- 설계를 바꾸는 결정을 했다면 `docs/adr/`에 ADR을 추가하거나 고친다(검토한 대안, 선택 이유, 트레이드오프).

## 작업 방식

- 큰 변경 전에는 계획을 먼저 보여 주고 확인을 받는다.
- "끝났다"고 말하기 전에 관련 테스트를 실행하고 결과를 보여 준다.
- 모르는 요구사항은 추측해서 채우지 말고 질문한다.
