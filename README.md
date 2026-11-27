# ichimadi

## 기술 스택

- 백엔드: FastAPI (Python 3.13), Docker Compose
- 프론트엔드: 미정
- AI: 외부 API 호출 방식 검토 중 (제공자 미정)

## 프로젝트 구조

```
ichimadi/
├── frontend/             # 프론트엔드 (미정)
├── backend/
│   ├── app/
│   │   ├── main.py       # FastAPI 진입점
│   │   ├── api/          # 라우터
│   │   ├── core/         # 설정
│   │   └── services/     # 비즈니스 로직, 외부 API 연동
│   ├── tests/
│   └── Dockerfile
└── docker-compose.yml
```

## 실행

```bash
docker compose up --build
```

- 상태 확인: http://localhost:8000/health
- API 문서: http://localhost:8000/docs

환경 변수를 바꾸려면 `backend/.env.example`을 `backend/.env`로 복사해서 수정합니다.
API 키는 `backend/.env`에만 넣고 커밋하지 않습니다.

## 테스트

```bash
docker compose run --rm --build -v ./backend:/src -w /src --user root backend \
  sh -c "pip install -r requirements-dev.txt && pytest -p no:cacheprovider"
```
