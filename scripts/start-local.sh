#!/usr/bin/env bash
# 云览本机一键启动：引擎(:8888) + 网关(:8787) + Web(:5173)
# 用法（仓库根）：./start-local.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE_DIR="${ROOT}/engine"
LOG_DIR="${ROOT}/.run-logs"
ENGINE_LOG="${LOG_DIR}/engine.log"
GATEWAY_LOG="${LOG_DIR}/gateway.log"
WEB_LOG="${LOG_DIR}/web.log"

ENGINE_PID=""
GATEWAY_PID=""
WEB_PID=""

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "缺少依赖：$1"
    exit 1
  }
}

# macOS 与 Linux 通用；不要用 Linux 专有的 fuser -k PORT/tcp
free_port() {
  local port="$1"
  local pids=""
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  elif command -v fuser >/dev/null 2>&1; then
    pids="$(fuser "$port/tcp" 2>/dev/null || true)"
  fi
  if [[ -n "${pids}" ]]; then
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 0.2
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  fi
}

cleanup() {
  echo
  echo "正在停止…"
  [[ -n "${ENGINE_PID}" ]] && kill "${ENGINE_PID}" 2>/dev/null || true
  [[ -n "${GATEWAY_PID}" ]] && kill "${GATEWAY_PID}" 2>/dev/null || true
  [[ -n "${WEB_PID}" ]] && kill "${WEB_PID}" 2>/dev/null || true
  wait 2>/dev/null || true
}

echo "== 云览本机启动 =="
need node
need npm
need go
need curl

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
echo "Node $(node -v) | $(go env GOVERSION 2>/dev/null || go version)"
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  echo "需要 Node.js ≥ 18（推荐 20/22 LTS）"
  exit 1
fi

GATEWAY_PORT="${GATEWAY_PORT:-8787}"
ENGINE_PORT="${ENGINE_PORT:-8888}"
export ENGINE_URL="${ENGINE_URL:-http://127.0.0.1:${ENGINE_PORT}}"
export DEMO_MODE="${DEMO_MODE:-0}"
export ENABLE_EXT_SOURCES="${ENABLE_EXT_SOURCES:-1}"
export ENABLE_WEIBO="${ENABLE_WEIBO:-0}"
# 通用 PORT 不能被引擎继承，否则引擎会抢网关端口
unset PORT || true
export GO111MODULE=on
export GOTOOLCHAIN="${GOTOOLCHAIN:-go1.25.0}"
export PATH="${PATH}:/usr/local/go/bin:/opt/homebrew/bin"

echo "编译引擎（GOTOOLCHAIN=${GOTOOLCHAIN}）…"
(
  cd "${ENGINE_DIR}"
  go mod download
  CGO_ENABLED=0 go build -ldflags='-s -w' -o yunlan-engine .
)

mkdir -p "${LOG_DIR}"
trap cleanup EXIT INT TERM

echo "释放端口 ${ENGINE_PORT} / ${GATEWAY_PORT} / 5173…"
free_port "${ENGINE_PORT}"
free_port "${GATEWAY_PORT}"
free_port 5173
sleep 0.3

echo "启动引擎 → :${ENGINE_PORT}（日志 ${ENGINE_LOG}）"
(
  cd "${ENGINE_DIR}"
  exec env PORT="${ENGINE_PORT}" ./run-live.sh
) >"${ENGINE_LOG}" 2>&1 &
ENGINE_PID=$!

echo -n "等待引擎健康检查"
for i in $(seq 1 60); do
  if curl -fsS --max-time 1 "http://127.0.0.1:${ENGINE_PORT}/api/health" >/dev/null 2>&1; then
    echo " OK"
    break
  fi
  if ! kill -0 "${ENGINE_PID}" 2>/dev/null; then
    echo
    echo "引擎进程已退出，见 ${ENGINE_LOG}"
    tail -40 "${ENGINE_LOG}" || true
    exit 1
  fi
  echo -n "."
  sleep 0.5
  if [[ "$i" -eq 60 ]]; then
    echo
    echo "引擎启动超时，见 ${ENGINE_LOG}"
    tail -40 "${ENGINE_LOG}" || true
    exit 1
  fi
done

echo "安装 / 检查 npm 依赖…"
(cd "${ROOT}" && npm install --silent)

echo "启动网关 → :${GATEWAY_PORT}（ENGINE_URL=${ENGINE_URL} DEMO_MODE=${DEMO_MODE}）"
(
  cd "${ROOT}"
  exec env PORT="${GATEWAY_PORT}" npm run dev:gateway
) >"${GATEWAY_LOG}" 2>&1 &
GATEWAY_PID=$!

echo "启动 Web → :5173"
(
  cd "${ROOT}"
  exec npm run dev:web
) >"${WEB_LOG}" 2>&1 &
WEB_PID=$!

for _ in $(seq 1 40); do
  if curl -fsS --max-time 1 "http://127.0.0.1:${GATEWAY_PORT}/api/health" >/dev/null 2>&1 \
    && curl -fsS --max-time 1 "http://127.0.0.1:5173/" >/dev/null 2>&1; then
    break
  fi
  sleep 0.4
done

HEALTH="$(curl -fsS --max-time 3 "http://127.0.0.1:${GATEWAY_PORT}/api/health" || true)"
echo
echo "============================================"
echo "  浏览器打开： http://localhost:5173"
echo "  网关：       http://localhost:${GATEWAY_PORT}"
echo "  引擎：       ${ENGINE_URL}"
echo "  健康检查：   ${HEALTH}"
echo "  日志目录：   ${LOG_DIR}/"
echo "  按 Ctrl+C 停止全部进程"
echo "============================================"
echo

while true; do
  kill -0 "${ENGINE_PID}" 2>/dev/null || { echo "引擎已退出，见 ${ENGINE_LOG}"; exit 1; }
  kill -0 "${GATEWAY_PID}" 2>/dev/null || { echo "网关已退出，见 ${GATEWAY_LOG}"; exit 1; }
  kill -0 "${WEB_PID}" 2>/dev/null || { echo "Web 已退出，见 ${WEB_LOG}"; exit 1; }
  sleep 2
done
