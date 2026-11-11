# 云览 Yunlan

网盘公开分享聚合搜索：夸克 / 阿里 / 百度 / 迅雷 / 123 / 天翼 / 115 / UC / 移动 / 蓝奏 / 磁力。线上：<https://panso.hellbow.xyz> · 源码：<https://github.com/hellbow20120323-cmyk/yunlan-design>

## 架构

```
浏览器 ──► apps/gateway（Node, :8787）──► engine（Go, :8888，仅本机）
              │  ├─ 静态托管 apps/web/dist
              │  ├─ 积分 / 登录 / 订阅、热门榜单、分享元数据
              │  └─ 多源聚合：engine + 混合盘系 + 微博，去重排序
              └─ .data/（用户、额度、订单、缓存、微博配置）
```

| 目录 | 说明 |
|------|------|
| `apps/web` | 前端（Vite + React + TS + Tailwind） |
| `apps/gateway` | 网关（Express），对外唯一入口 |
| `engine` | 搜索引擎（Go module `yunlan/engine`，源自 fish2018/pansou，MIT） |
| `deploy` | systemd 单元、引擎 compose、发布脚本 |
| `scripts` | 本机一键启动 |
| `docs/history` | 0.4.0 以前的调试记录 |

## 本机开发

依赖：Node ≥ 18、Go ≥ 1.25、curl。

```bash
./start-local.sh          # 引擎 + 网关 + Web，一键启动
# 浏览器打开 http://localhost:5173
```

分别启动：

```bash
(cd engine && ./run-live.sh)                 # :8888
ENGINE_URL=http://127.0.0.1:8888 npm run dev # 网关 :8787 + Web :5173
```

其他命令：`npm test`（网关单测）、`npm run build`（构建 Web）、`npm run engine:test`。

## 网关环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| `PORT` | 网关端口 | `8787` |
| `ENGINE_URL` | 引擎地址；为空则不走引擎 | 空 |
| `ENGINE_FORCE_REFRESH` | `1` 时每次搜索都跳过引擎缓存 | `0` |
| `DEMO_MODE` | `1` 强制演示数据 | `0` |
| `ENABLE_EXT_SOURCES` | 混合盘系等额外源 | `1` |
| `YUNLAN_DATA_DIR` | 运行数据目录 | `<仓库根>/.data` |
| `HOST` | 网关监听地址（生产经 nginx 反代，勿直接暴露） | `127.0.0.1` |
| `AUTH_SECRET` | 登录会话签名密钥，≥32 字符。**生产缺失将拒绝启动**；开发缺失则每次启动随机生成 | 无 |
| `ADMIN_TOKEN` | 管理接口（`/api/config/weibo`、`/api/health` 详情）凭证，请求头 `Authorization: Bearer <token>`。未设置时生产环境一律拒绝 | 空 |
| `TRUST_PROXY` | 反代层数，决定限流 / 额度使用的访客 IP。Cloudflare → nginx → 网关 为 `2` | 生产 `2`，开发 `loopback` |
| `CORS_ORIGINS` | 额外允许的跨域来源（逗号分隔）。默认仅同源；开发环境放行 localhost | 空 |
| `COOKIE_SECURE` | `1/0` 强制 Cookie 的 Secure 标记；默认按 `X-Forwarded-Proto` / `CF-Visitor` 自动判断 | 自动 |
| `POINTS_ANON_IP_DAILY` | 匿名访客按 IP 的日积分上限（防清 Cookie 刷额度） | 单人额度 ×4 |
| `SEARCH_CACHE_TTL_MS` | 网关搜索结果短缓存（相同关键词合并上游请求，`0` 关闭） | `90000` |
| `HOT_REFRESH_HOUR` / `HOT_REFRESH_MINUTE` | 首页热门影视（含豆瓣热播剧集）每日刷新时刻，时区同 `POINTS_TZ` | `9` / `0` |
| `BILLING_MOCK` | `1` 开启模拟支付（任何登录用户可免费开通会员，**切勿在生产开启**） | `0` |
| `PUBLIC_ORIGIN` | 站点正式地址（canonical / sitemap / OG 图） | `https://panso.hellbow.xyz` |
| `POINTS_SEARCH_COST` 等 | 积分规则，见 `apps/gateway/src/points/quota.js` | |

引擎变量见 `engine/README.md`。

## API

- `GET /api/health`：`liveReady`、`modeLabel`、`engineConfigured`、`engineOk`（引擎地址、插件、微博细节仅管理员可见）
- `GET|POST /api/search`：`kw`、`cloud_types=quark,baidu,...`、`refresh=1`（跳过引擎缓存）
- 前端深链：`/?q=三体`（搜索结果页标题为「关键词 - N条网盘资源 | 云览」；爬虫访问时服务端预渲染列表，不扣积分）
- `GET /sitemap.xml`：首页 + 热门电影/剧集关键词
- `GET /robots.txt`

## 部署

服务器 `ubuntu@129.146.60.210`，目录 `~/yunlan`：

- 网关：systemd `yunlan-gateway`（`deploy/yunlan-gateway.service`），密钥等放 `~/yunlan/.data/yunlan.env`
- 引擎：容器 `yunlan-engine`，缓存卷 `yunlan-engine-cache`（`deploy/docker-compose.engine.yml`）
- Nginx 反代 `:80 → 127.0.0.1:8787`，前面是 Cloudflare

```bash
npm run deploy                # lint + 测试 → 构建 Web → 发布网关
npm run deploy:engine         # 同上，并重建引擎容器
./deploy/deploy.sh --help     # 更多参数（--skip-test / --skip-build）
```

清引擎搜索缓存：删卷内 `shard_*` 与 `check_cache.db` 后**必须重启容器**（内存里还有一层）。

## 合规

仅聚合公开分享链接元数据；不收集私有盘凭证；不提供提取码破解或文件代下。夸克 / UC / 阿里云盘可预览公开分享目录（文件名与大小），下载仍跳转官网。结果指向第三方，请自行确认版权与有效性。
