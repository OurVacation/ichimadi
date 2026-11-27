# ichimadi

## 기술 스택

- 백엔드: Python 3.12, FastAPI, PostgreSQL 16, SQLAlchemy, Alembic, uv
- 프론트엔드: React + TypeScript (Vite). 실행법은 `frontend/CLAUDE.md`
- 로컬 개발: Docker Compose

## 프로젝트 구조

```
ichimadi/
├── backend/              # FastAPI (규칙: backend/CLAUDE.md)
├── frontend/             # 모바일 웹 (규칙: frontend/CLAUDE.md)
├── docs/api/openapi.json # API 계약
└── docker-compose.yml    # 로컬 개발: db + api
```

## 실행

```bash
docker compose up -d --build db api
docker compose run --rm api alembic upgrade head
```

- 상태 확인: http://localhost:8000/api/health
- API 문서: http://localhost:8000/api/docs

환경 변수를 바꾸려면 `backend/.env.example`을 `backend/.env`로 복사해서 수정합니다. `.env`는 커밋하지 않습니다.

## 테스트와 린트

```bash
docker compose run --rm api pytest
docker compose run --rm api ruff check .
docker compose run --rm api ruff format .
```

## API 계약 갱신

```bash
docker compose run --rm api python -m scripts.export_openapi
```

## 백엔드 사용

```bash
docker compose up -d --build db api
docker compose run --rm api alembic upgrade head
docker compose run --rm api python -m scripts.seed
docker compose run --rm api python -m scripts.create_accounts --prefix j --count 12 --role judge
```

시드는 카테고리 1개·한마디 6개를 넣습니다. 다시 실행해도 중복되지 않고, 원본에서 빠진 항목은 비활성화됩니다.
`CONTENT_DIR`로 원본 위치를 바꿀 수 있습니다(기본값: 로컬 `content/`, 컨테이너 `/content`).

발급된 계정은 `backend/j.accounts.csv`에만 기록됩니다. 기존 아이디는 건너뛰고, 기존 CSV는 덮어쓰지 않습니다.
다시 발급할 때는 `--out 다른이름.accounts.csv`를 지정하세요. CSV는 Git에서 제외됩니다.

`backend/http/`에 로그인·프로필·도장·한마디·이름 후보 요청이 있습니다.
HTTP 클라이언트의 비공개 환경에 `loginId`, `password`, 로그인 응답의 `access_token`을 `token`으로 설정하세요.
Swagger(`/api/docs`)에서도 로그인 후 **Authorize**에 토큰을 넣어 보호된 API를 호출할 수 있습니다.
FE는 갱신된 `docs/api/openapi.json`을 기준으로 Store를 서버 구현으로 연결할 수 있습니다(M1·M2·M6·M7).

```bash
# 대상 계정 수를 보여 주고 확인을 받습니다. 자동 실행 시에만 --yes를 추가하세요.
docker compose run --rm api python -m scripts.reset --login-ids j01,j02
docker compose run --rm api python -m scripts.reset --role team
# 도장·프로필 초기화와 비밀번호 재발급. CSV는 파일로만 기록됩니다.
docker compose run --rm api python -m scripts.reset --login-ids j01 --new-password --out reset.accounts.csv
# 이름 추천 캐시 삭제
docker compose run --rm api python -m scripts.reset --names
```

이름 후보는 `GEMINI_API_KEY`가 없으면 503 `name_suggest_unavailable`을 반환합니다.
빈 이름·공백뿐인 이름·정규화 후 30자를 넘는 이름은 모두 422 `invalid_ja_name`입니다.
기본 모델은 [공식 모델 문서](https://aistudio.google.com/docs/models/gemini-3.8-flash)에서 확인한
`gemini-3.8-flash`이며 `GEMINI_MODEL`로 바꿀 수 있습니다.
`NAME_SUGGEST_TIMEOUT_SECONDS`(기본 10)를 SDK의 밀리초 단위 HTTP 타임아웃으로 변환하고 재시도를 끕니다
([SDK 문서](https://googleapis.github.io/python-genai/)). Gemini API가 10초 미만의 마감 시간을 거부하므로 10초보다 작게 줘도 10초로 올립니다.
thinking 정도는 `GEMINI_THINKING_LEVEL`(기본 `low`)로 정합니다. 테스트는 실제 Gemini를 호출하지 않습니다.

DB 테스트는 별도 `ichimadi_test` DB를 자동 생성·마이그레이션하고 테스트마다 트랜잭션을 롤백합니다.
`TEST_DATABASE_URL`로 바꿀 수 있으며, 실수로 애플리케이션 DB를 사용하지 않도록 DB 이름이 `_test`로 끝나야 합니다.
기존 health·error 테스트는 DB 없이도 실행할 수 있습니다.

## 배포 담당자에게 전달할 사항

`compose.prod.yml`과 `Caddyfile`은 이번 구현에서 수정하지 않았습니다. 배포 시 다음 설정이 필요합니다.

- `APP_ENV=prod`, 충분히 긴 별도의 `JWT_SECRET`(기본 개발 키는 prod 시작 시 거부).
- 이름 추천용 `GEMINI_API_KEY`, `GEMINI_MODEL`, 서버에서 Google API로 나가는 HTTPS.
- 시드 실행 환경의 `content/` 읽기 전용 마운트(예: `./content:/content:ro`)와 마이그레이션·시드 실행.
- 카테고리 화면 문구 `ハッカソン会場`는 일본어 검수 필요.
