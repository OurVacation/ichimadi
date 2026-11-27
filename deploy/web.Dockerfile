# syntax=docker/dockerfile:1
# 배포용 web 이미지: 프론트를 빌드해서 Caddy 이미지에 넣는다.
# 빌드 컨텍스트는 레포 루트다 (프론트가 content/phrases.json 을 번들에 넣기 때문).
#   docker build -f deploy/web.Dockerfile .
# 컨텍스트에 들어가는 파일은 deploy/web.Dockerfile.dockerignore 로 제한한다.

# 1단계: 정적 파일 빌드. 결과물은 CPU 종류와 무관하므로 빌드 머신 아키텍처에서 실행한다.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /repo/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY content /repo/content
COPY frontend ./

# (선택) 백엔드 로그인을 연결하기 전까지 쓰는 체험 계정. 빌드된 JS에 그대로 들어가서 누구나 볼 수 있다.
# 실제 심사위원 계정 비밀번호는 절대 넣지 않는다.
ARG VITE_TRIAL_ACCOUNTS=""
RUN VITE_TRIAL_ACCOUNTS="$VITE_TRIAL_ACCOUNTS" npm run build

# 배포된 커밋 확인용: https://<주소>/version.txt
ARG APP_VERSION=dev
RUN printf '%s\n' "$APP_VERSION" > dist/version.txt

# 2단계: Caddy 웹 서버에 정적 파일만 복사한다. Caddyfile 은 서버에서 볼륨으로 넣는다.
FROM caddy:2-alpine
COPY --from=build /repo/frontend/dist /srv
