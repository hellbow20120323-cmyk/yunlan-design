#!/usr/bin/env bash
# 从本机发布到服务器：构建 Web → 同步代码 → 安装网关依赖 → 重启网关（可选重建引擎）
# 用法：
#   ./deploy/deploy.sh            # 仅网关 + Web
#   ./deploy/deploy.sh --engine   # 同时重建并重启引擎容器
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${DEPLOY_HOST:-ubuntu@129.146.60.210}"
REMOTE_DIR="${DEPLOY_DIR:-/home/ubuntu/yunlan}"
WITH_ENGINE=0
[[ "${1:-}" == "--engine" ]] && WITH_ENGINE=1

cd "$ROOT"
echo "[deploy] building web"
npm run build

echo "[deploy] syncing to ${HOST}:${REMOTE_DIR}"
COPYFILE_DISABLE=1 tar czf - \
  --exclude=node_modules --exclude=.git --exclude=.data --exclude=.run-logs \
  --exclude=engine/cache --exclude=engine/yunlan-engine --exclude='._*' --exclude=.DS_Store \
  package.json package-lock.json version.json apps engine deploy \
  | ssh "$HOST" "mkdir -p '${REMOTE_DIR}' && tar xzf - -C '${REMOTE_DIR}'"

ssh "$HOST" "bash -s" <<REMOTE
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
