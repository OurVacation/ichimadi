#!/usr/bin/env bash
# 서버에서 실행되는 배포 스크립트. GitHub Actions(cd.yml)가 SSH 로 보내서 실행한다.
# 실행 직전에 앞에 붙어서 전달되는 변수:
#   DEPLOY_PATH, IMAGE_PREFIX, APP_TAG(sha-xxxxxxx), APP_VERSION(전체 SHA), GHCR_USER, GHCR_TOKEN
#
# 주의: 이 스크립트는 `ssh ... bash -s` 로 "표준입력"을 통해 전달된다.
# bash 는 표준입력의 스크립트를 읽으면서 실행하므로, 중간 명령(docker compose 등)이 표준입력을 읽으면
# 나머지가 사라진 채 "성공"으로 끝날 수 있다. 그래서 전체를 main 으로 감싸고 표준입력을 /dev/null 로 막는다.
set -euo pipefail

main() {
  exec </dev/null
  cd "$DEPLOY_PATH"

  if [ ! -f .env ]; then
    echo "::error::서버의 $DEPLOY_PATH/.env 가 없습니다. deploy/.env.example 을 참고해 만들어 주세요."
    exit 1
  fi

  # 1) CD 가 방금 올린 설정 파일(.incoming/)을 제자리로 옮긴다. .env 는 건드리지 않는다.
  if [ -d .incoming ]; then
    mv -f .incoming/compose.prod.yml .incoming/Caddyfile .
    rm -rf content
    mv .incoming/content content
    rm -rf .incoming
  fi

  dc() { docker compose -f compose.prod.yml "$@"; }
  export IMAGE_PREFIX APP_TAG

  # 2) 이미지 받기. 토큰은 이번 워크플로 실행 동안만 유효하고, 끝나면 바로 로그아웃한다.
  trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
  echo "==> pull $IMAGE_PREFIX/ichimadi-{api,web}:$APP_TAG"
  dc pull api web

  # 3) DB 를 먼저 띄우고 마이그레이션·시드 (API 는 시작할 때 이 작업을 하지 않는다)
  echo "==> db 시작"
  dc up -d --wait --wait-timeout 60 db
  echo "==> alembic upgrade head"
  dc run --rm --no-deps api alembic upgrade head
  if dc run --rm --no-deps api test -f scripts/seed.py; then
    echo "==> 콘텐츠 시드 (scripts.seed)"
    dc run --rm --no-deps api python -m scripts.seed
  else
    echo "==> scripts/seed.py 가 아직 없어서 시드를 건너뜀"
  fi

  # 4) 전체 재시작. api 가 healthy 가 될 때까지 기다린다.
  echo "==> 재시작"
  if ! dc up -d --remove-orphans --wait --wait-timeout 120; then
    echo "::error::컨테이너가 정상 상태가 되지 않았습니다. 아래 로그를 확인하세요."
    dc ps
    dc logs --tail=80 api web
    exit 1
  fi

  # 5) 바깥에서 들어오는 것과 같은 경로(HTTPS → Caddy → api)로 확인한다.
  #    --resolve 로 이 서버의 Caddy 에 직접 붙되, 주소와 인증서는 실제와 똑같이 검사한다.
  local site health="" html="" version=""
  site="$(dc exec -T web printenv SITE_ADDRESS | tr -d '\r')"
  echo "==> https://$site 확인 (첫 배포는 인증서 발급 때문에 1분 정도 걸릴 수 있음)"
  check() { curl -fsS --max-time 5 --resolve "$site:443:127.0.0.1" "https://$site$1" 2>/dev/null; }
  for _ in $(seq 1 30); do
    if health="$(check /api/health)" && html="$(check /)" && [[ "$html" == *'id="root"'* ]] \
      && version="$(check /version.txt)"; then
      break
    fi
    health=""
    sleep 4
  done
  if [ -z "$health" ]; then
    echo "::error::https://$site 에서 화면 또는 /api/health 가 응답하지 않습니다. (방화벽 80/443, SITE_ADDRESS, 인증서 로그 확인)"
    dc logs --tail=50 web
    exit 1
  fi
  echo "    / → 화면 OK"
  echo "    /api/health → $health"

  # 6) 방금 받은 이미지가 실제로 떠 있는지 확인한다.
  if [ "$version" != "$APP_VERSION" ]; then
    echo "::error::web 버전이 다릅니다. 기대: $APP_VERSION, 실제: $version"
    exit 1
  fi
  local want got
  want="$(docker image inspect -f '{{.Id}}' "$IMAGE_PREFIX/ichimadi-api:$APP_TAG")"
  got="$(docker inspect -f '{{.Image}}' "$(dc ps -q api)")"
  if [ "$want" != "$got" ]; then
    echo "::error::api 컨테이너가 $APP_TAG 이미지로 떠 있지 않습니다."
    exit 1
  fi
  echo "    web·api 버전 → $APP_TAG"

  # 이전 버전 이미지가 디스크를 채우지 않도록 태그 없는 이미지를 정리한다.
  docker image prune -f >/dev/null
  echo "==> 배포 완료: https://$site ($APP_TAG)"
}

main "$@"
