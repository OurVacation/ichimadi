# backend/ — FastAPI

이 디렉터리 규칙은 레포 루트 `CLAUDE.md`에 더해 적용된다.

## 스택

- Python 3.12, FastAPI, Pydantic v2, pydantic-settings
- PostgreSQL 16, SQLAlchemy 2.0 (동기, psycopg 3), Alembic
- 인증: PyJWT(HS256), bcrypt
- LLM: `google-genai` (Gemini Flash, 한국식 이름 후보에만 사용. ADR-004)
- 테스트: pytest + httpx(`TestClient`). 린트·포맷: ruff
- 의존성 관리: uv (`pyproject.toml`, `uv.lock`). 새 의존성은 추가하기 전에 물어본다.

## 구조

```
backend/
├─ app/
│  ├─ main.py          # FastAPI 앱, 라우터 등록, 에러 핸들러, CORS
│  ├─ core/            # config.py(설정), security.py(JWT·bcrypt), normalize.py(정규화), errors.py
│  ├─ db.py            # 엔진, 세션, get_db 의존성
│  ├─ deps.py          # get_current_user, get_name_generator
│  ├─ models/          # user, stamp_profile, phrase_set, phrase, stamp, name_suggestion
│  ├─ schemas/         # Pydantic 요청·응답 모델 (Swagger 예시 포함)
│  ├─ routers/         # health, auth, me, stamps, phrases, names
│  ├─ services/        # 비즈니스 로직 (라우터는 얇게)
│  └─ llm/             # NameGenerator 인터페이스와 Gemini 구현 (호출만, 검증은 services)
├─ alembic/            # 마이그레이션
├─ scripts/            # create_accounts.py, reset.py, seed.py, export_openapi.py
├─ http/               # 수동 테스트용 .http 파일
└─ tests/
```

## 설계 문서

- 구성 계획: `docs/design/backend-architecture.md` · ERD: `docs/design/erd.md` · API 명세: `docs/design/api.md`
- 결정: `docs/adr/ADR-001`(API를 FE `Store`에 맞춤), `ADR-002`(데이터 모델), `ADR-003`(한마디 카테고리·API), `ADR-004`(LLM 이름 추천)
- 보류: H-1 `stamped_at`을 FE 시각으로 받을지, H-2 retry(attempts) 기록, H-3 `hackathon` 외 카테고리 콘텐츠. 정해지기 전에는 구현하지 않는다

## 데이터 모델 핵심

- `users`(id, login_id UNIQUE — 정규화된 값, password_hash, role: judge|spare|team|demo, ja_name NULL, created_at)
- `stamp_profiles`(user_id PK, animal NULL: tiger|rabbit|magpie|bear, korean_name NULL: 한글 1~10자, updated_at) — 내 도장 모양
- `phrase_sets`(code TEXT PK, name_ja, sort_order, is_active) — 한마디 카테고리. `content/phrase_sets.json`에서 시드. 지금은 `hackathon` 하나
- `phrases`(id TEXT `q1`…, set_code FK, sort_order, ko, kana, ja_meaning, usage_ja, reply_ko, reply_kana, reply_ja, is_active) — `content/phrases.json`에서 시드, 지우지 않고 비활성화
- `stamps`(user_id, phrase_id, stamped_at) — **PK (user_id, phrase_id)**. 한마디당 도장은 하나. 진행도·완료는 **카테고리별**
- `name_suggestions`(input_key PK, candidates JSONB, model, created_at) — LLM 이름 후보 캐시
- 통계(P2)는 **role이 judge·spare인 사용자만** 센다(팀 테스트 기록 제외)

## 반드시 지킬 것

- 스키마 변경은 항상 Alembic 마이그레이션으로 한다. 이미 적용된 마이그레이션은 고치지 않고 새로 만든다.
- `POST /api/me/stamps`는 한 트랜잭션에서 처리한다: 활성 한마디 확인 → stamps `INSERT … ON CONFLICT DO NOTHING` → `{stamps, progress}` 반환. 같은 요청이 여러 번 와도 결과가 같아야 한다(멱등, 첫 `stamped_at` 유지).
- 사용자는 토큰으로만 식별한다. 경로·본문으로 `user_id`를 받지 않는다.
- 모든 엔드포인트는 `response_model`, `tags`, `summary`를 단다. 스키마에는 `json_schema_extra`로 예시를 넣는다(Swagger에 그대로 보임).
- 에러는 `AppError(code, message_ja, status)`를 raise하고, 전역 핸들러가 `{"code", "message_ja"}`로 바꾼다. FastAPI 기본 `{"detail": ...}`을 그대로 내보내지 않는다(422 검증 에러 포함).
- 인증은 `HTTPBearer` 기반 `get_current_user` 의존성으로 한다. JWT 만료는 72시간(행사 기간을 덮도록).
- 회원가입·관리자용 API는 만들지 않는다. 계정 발급과 리셋은 `scripts/`에서만 한다.
- 비밀번호, 토큰, 계정 CSV 내용, 일본어 이름, LLM 응답 원문을 로그로 남기지 않는다.
- LLM은 이름 후보에만 쓴다. 한마디 문장은 생성하지 않는다. LLM 출력은 서버가 검증한 뒤에만 저장·반환하고, 실패하면 503 `name_suggest_unavailable`(FE가 `names.ts`로 대비).
- 테스트에서 실제 LLM을 부르지 않는다. `get_name_generator`를 가짜 구현으로 바꾼다.
- `frontend/`의 파일은 수정하지 않는다. 계약을 바꿔야 하면 무엇을 바꿀지 먼저 제안한다.

## 엔드포인트를 추가하거나 바꿨을 때

1. `schemas/`에 요청·응답 모델(예시 포함)을 만든다.
2. `tests/`에 테스트를 추가한다. 정상 케이스, 인증 없음 401, 남의 데이터 접근 불가를 기본으로 넣는다.
3. `docker compose run --rm api pytest`를 통과시킨다.
4. `docker compose run --rm api python -m scripts.export_openapi`로 `docs/api/openapi.json`을 다시 생성하고 같은 커밋에 넣는다.
5. `http/`에 수동 테스트 요청을 추가한다.

## 꼭 있어야 하는 테스트

- 로그인 성공·실패, 전각·공백·대문자 아이디로도 로그인, 토큰 없이 보호된 API 호출 시 401
- 같은 한마디 도장을 두 번 보내도 도장은 1개, 첫 시각 유지, 응답이 같다
- 다른 사용자의 도장은 보이지 않는다
- 카테고리 안의 한마디를 다 모으면 그 카테고리만 `completed: true`
- 잘못된 동물·이름은 422 `invalid_profile`, 없는 한마디는 404 `unknown_phrase`
- 이름 후보: 같은 입력은 캐시(LLM 1번만 호출), 시간 초과·이상한 출력은 503이고 저장 안 함
- (P2) 통계에 team·demo 계정이 섞이지 않는다 · (H-2 결정 시) retry는 도장을 만들지 않는다

## 명령 (레포 루트에서)

```bash
docker compose up -d db api
docker compose run --rm api alembic upgrade head
docker compose run --rm api alembic revision --autogenerate -m "<설명>"
docker compose run --rm api python -m scripts.seed
docker compose run --rm api python -m scripts.create_accounts --prefix j --count 12 --role judge
docker compose run --rm api pytest
docker compose run --rm api ruff check . && docker compose run --rm api ruff format .
```
