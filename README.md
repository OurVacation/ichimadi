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
