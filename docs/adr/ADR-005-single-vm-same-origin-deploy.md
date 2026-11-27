# ADR-005: 화면·API·DB를 VM 1대에 같은 주소로 배포한다

- 상태: 제안 (리뷰 후 채택)
- 날짜: 2026-11-27
- 결정한 사람: 현우 (배포)
- 고치는 결정: `frontend/CLAUDE.md`의 "배포: 정적 빌드 → Vercel 또는 Cloudflare Pages"
- 관련: [docs/INFRA.md](../INFRA.md), `compose.prod.yml`, `Caddyfile`, `deploy/`

## 배경

- 코드 프리즈(11/29 17:00)까지 시간이 짧다. 설정할 서비스와 계정이 적을수록 현장에서 덜 깨진다.
- 동시 사용자는 수십 명 이하다.
- 프론트를 다른 도메인(Vercel 등)에 두면 API 호출이 다른 주소로 가게 되어 CORS 설정이 필요하고, HTTPS 페이지에서 HTTP API를 부르면 브라우저가 막는다(mixed content).
- Vercel 무료 플랜은 레포 주인이 아닌 사람의 커밋 배포를 막는 경우가 있다.

## 결정

1. GCP VM 1대(서울, e2-small, Ubuntu 24.04)에 `web`(Caddy + 프론트 빌드 결과), `api`(FastAPI), `db`(PostgreSQL 16)를 `compose.prod.yml`로 함께 올린다.
2. 주소는 하나(`https://34-47-91-94.sslip.io`)다. Caddy가 `/api/*`는 `api:8000`으로 넘기고, 나머지는 프론트 화면을 돌려준다(SPA fallback). 프론트와 API가 같은 주소라 CORS가 필요 없다.
3. HTTPS 인증서는 Caddy가 Let's Encrypt로 자동 발급한다. 도메인은 IP 기반 무료 주소(sslip.io)를 쓴다.
4. `dev`에 머지되면 GitHub Actions가 이미지 2개(`ichimadi-api`, `ichimadi-web`)를 같은 커밋 태그로 GHCR에 올리고, SSH로 VM에 배포한 뒤 실제 주소로 화면과 `/api/health`를 확인한다.
5. 마이그레이션(`alembic upgrade head`)과 시드(`scripts.seed`)는 배포 스크립트가 API 재시작 전에 실행한다.

## 검토한 대안

| 대안 | 장점 | 단점 |
|---|---|---|
| 프론트는 Vercel/Cloudflare Pages, API는 VM | 프론트 배포가 간단, PR마다 미리보기 | CORS·도메인 2개 관리, 무료 플랜 협업 제한, 서비스 계정이 늘어남 |
| API를 PaaS(Render, Fly.io 등)에 | 서버 관리 없음 | 무료 플랜 콜드 스타트(첫 요청 지연), DB 별도 준비 |
| **VM 1대에 전부 (채택)** | 주소 1개, CORS 없음, 비용·설정 최소 | VM 1대가 죽으면 전부 멈춘다. PR 미리보기 없음 |

## 트레이드오프

- 서버가 1대라서 장애 지점도 1개다. 행사 규모(수십 명)에서는 단순함을 고른다.
- PR별 미리보기 배포가 없다. 대신 PR마다 CI가 빌드와 테스트를 확인한다.
