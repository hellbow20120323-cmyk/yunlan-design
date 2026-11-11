#!/usr/bin/env bash
# 从本机发布到服务器：检查 → 构建 Web → 同步代码 → 安装网关依赖 → 重启网关（可选重建引擎）
#
# 用法：
#   ./deploy/deploy.sh                 # 默认：lint + 网关测试 → 构建 → 发布
#   ./deploy/deploy.sh --engine        # 同时重建并重启引擎容器
#   ./deploy/deploy.sh --skip-test     # 跳过 lint/测试（紧急热修）
#   ./deploy/deploy.sh --skip-build    # 不重新 build（须本地已有 apps/web/dist）
#
# 环境变量：
#   DEPLOY_HOST   默认 ubuntu@129.146.60.210
#   DEPLOY_DIR    默认 /home/ubuntu/yunlan
#   PUBLIC_URL    部署成功后打印的站点地址，默认 https://panso.hellbow.xyz
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${DEPLOY_HOST:-ubuntu@129.146.60.210}"
REMOTE_DIR="${DEPLOY_DIR:-/home/ubuntu/yunlan}"
PUBLIC_URL="${PUBLIC_URL:-https://panso.hellbow.xyz}"
SSH_OPTS=(-o ConnectTimeout=30)

WITH_ENGINE=0
SKIP_TEST=0
SKIP_BUILD=0

usage() {
  sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --engine) WITH_ENGINE=1 ;;
    --skip-test) SKIP_TEST=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    -h|--help) usage 0 ;;
    *)
      echo "[deploy] 未知参数: $1" >&2
      usage 1
      ;;
  esac
  shift
done

cd "$ROOT"

if [[ "$SKIP_TEST" -eq 0 ]]; then
  echo "[deploy] lint web"
  npm run lint -w @yunlan/web
  echo "[deploy] test gateway"
  npm test -w @yunlan/gateway
fi

WEB_DIST="$ROOT/apps/web/dist"
if [[ "$SKIP_BUILD" -eq 1 ]]; then
  if [[ ! -f "$WEB_DIST/index.html" ]]; then
    echo "[deploy] --skip-build 需要已有构建产物: $WEB_DIST/index.html" >&2
    exit 1
  fi
  echo "[deploy] skip build (using existing dist)"
else
  echo "[deploy] building web"
  npm run build
  if [[ ! -f "$WEB_DIST/index.html" ]]; then
    echo "[deploy] build 未生成 $WEB_DIST/index.html" >&2
    exit 1
  fi
fi

echo "[deploy] syncing to ${HOST}:${REMOTE_DIR}"
COPYFILE_DISABLE=1 tar czf - \
  --exclude=node_modules --exclude=.git --exclude=.data --exclude=.run-logs \
  --exclude=engine/cache --exclude=engine/yunlan-engine --exclude='._*' --exclude=.DS_Store \
  package.json package-lock.json version.json apps engine deploy \
  | ssh "${SSH_OPTS[@]}" "$HOST" "mkdir -p '${REMOTE_DIR}' && tar xzf - -C '${REMOTE_DIR}'"

ssh "${SSH_OPTS[@]}" "$HOST" "bash -s" <<REMOTE
set -euo pipefail
cd '${REMOTE_DIR}'
mkdir -p .data
npm install --omit=dev --no-audit --no-fund --silent
if [[ "${WITH_ENGINE}" == "1" ]]; then
  docker volume create yunlan-engine-cache >/dev/null
  docker compose -f deploy/docker-compose.engine.yml up -d --build
fi
sudo systemctl restart yunlan-gateway
sleep 2
systemctl is-active yunlan-gateway
curl -fsS http://127.0.0.1:8787/api/health | head -c 300
echo
REMOTE

echo "[deploy] ok — ${PUBLIC_URL}"
