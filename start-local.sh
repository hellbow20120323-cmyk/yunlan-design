#!/usr/bin/env bash
# 云览本机一键入口
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
exec "$ROOT/scripts/start-local.sh"
