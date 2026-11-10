# 云览搜索引擎（engine）

Go 实现的多源网盘搜索引擎：TG 频道 + 插件站点聚合、两级缓存、异步补齐。云览网关（`apps/gateway`）通过 `ENGINE_URL` 调用其 `/api/search` 与 `/api/health`，仅监听本机端口，不直接对外。

源自 [fish2018/pansou](https://github.com/fish2018/pansou)（MIT，见 `LICENSE`），已改为本仓库 Go module `yunlan/engine`，不再与上游直接同步。上游原始文档保留在 `docs/upstream-README.md` 及 `docs/` 下的插件开发指南。

## 构建与运行

```bash
CGO_ENABLED=0 go build -o yunlan-engine .
./run-live.sh            # 默认 :8888，缓存写入 ./cache
```

Docker：`docker build -t yunlan-engine:local .`（部署见仓库根 `deploy/`）。

## 常用环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| `PORT` | 监听端口 | `8888` |
| `CHANNELS` | TG 频道列表 | 见 `run-live.sh` |
| `ENABLED_PLUGINS` | 启用插件列表（为空则无插件） | 见 `run-live.sh` |
| `CACHE_PATH` / `CACHE_TTL` | 缓存目录 / 分钟 | `./cache` / `60` |
| `PROXY` | SOCKS5 代理（可选） | 无 |

## 清缓存

搜索结果缓存同时存在于磁盘分片（`$CACHE_PATH/shard_*`）与进程内存，**删文件后必须重启进程**。单次跳过缓存可在请求体加 `"refresh": true`。
