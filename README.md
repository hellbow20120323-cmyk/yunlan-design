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
| `SEARCH_ENABLED` | 搜索入口开关：`false` 时前端只展示资料检索 / 在线工具，隐藏网盘、榜单与影视热榜，robots/sitemap 只保留工具页；后端搜索代码保留，改回 `true` 重启即恢复 | `1` |
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
| `BILLING_NOTIFY_SECRET` | 支付回调 HMAC 密钥；设置后启用 `POST /api/billing/notify`，未设置时回调一律 503 | 空 |
| `BILLING_NOTIFY_TOLERANCE_MS` | 回调时间戳容忍窗口（防止重放） | `300000` |
| `BILLING_CONTACT` | 人工开通联系方式（微信号 / QQ 等，展示在付款页） | 空 |
| `BILLING_CONTACT_EMAIL` | 人工开通申请邮箱；配置后前端显示「发送开通申请邮件」（mailto 自动带订单号） | 空 |
| `BILLING_PAY_HINT` | 人工转账提示文案 | 内置文案 |
| `ALIPAY_APP_ID` | 支付宝应用 App ID；与商户私钥同时配置后启用电脑网站支付 | 空 |
| `ALIPAY_PRIVATE_KEY_PATH` / `ALIPAY_PRIVATE_KEY` | 应用私钥（PKCS8 PEM）文件路径 / 内联内容（`\n` 代表换行） | 空 |
| `ALIPAY_PUBLIC_KEY_PATH` / `ALIPAY_PUBLIC_KEY` | 支付宝公钥，用于异步通知验签 | 空 |
| `ALIPAY_NOTIFY_URL` | 支付宝异步通知地址，须公网 HTTPS，如 `https://<域名>/api/billing/notify/alipay` | 空 |
| `ALIPAY_RETURN_URL` | 支付完成后的同步跳回地址 | 空 |
| `ALIPAY_GATEWAY` | 支付宝网关；沙箱环境可改 | 正式网关 |
| `WECHAT_APP_ID` / `WECHAT_MCH_ID` / `WECHAT_MCH_SERIAL_NO` | 微信支付 AppID、商户号、商户 API 证书序列号 | 空 |
| `WECHAT_PRIVATE_KEY_PATH` / `WECHAT_PRIVATE_KEY` | 商户 API 私钥（`apiclient_key.pem`） | 空 |
| `WECHAT_API_V3_KEY` | APIv3 密钥（32 字节，用于解密支付通知） | 空 |
| `WECHAT_PLATFORM_CERT_PATH` / `WECHAT_PLATFORM_PUBLIC_KEY` | 微信支付平台证书或公钥，用于通知验签 | 空 |
| `WECHAT_NOTIFY_URL` | Native 支付回调地址，须公网 HTTPS，如 `https://<域名>/api/billing/notify/wechat` | 空 |
| `PUBLIC_ORIGIN` | 站点正式地址（canonical / sitemap / OG 图） | `https://panso.hellbow.xyz` |
| `ZEPTOMAIL_SMTP_HOST` / `ZEPTOMAIL_SMTP_PORT` | 国内版 ZeptoMail SMTP 主机与端口（587 STARTTLS / 465 SSL） | `smtp.zeptomail.com.cn` / `587` |
| `ZEPTOMAIL_SMTP_USER` / `ZEPTOMAIL_SMTP_PASS` | SMTP 用户名与 API 密钥；未配置密钥时申请可入库但不会发信 | `emailapikey` / 空 |
| `MAIL_FROM` / `MAIL_FROM_NAME` | 发件地址与显示名 | `noreply@hellbow.xyz` / `云览 Yunlan` |
| `MAIL_UNSUBSCRIBE_MAILTO` | `List-Unsubscribe` 的 mailto 退订地址（可选，URL 退订始终存在） | 空 |
| `ZEPTOMAIL_INTL_SMTP_*` | 国际版 ZeptoMail 配置；海外邮箱（gmail / outlook 等）优先路由，未配置自动回退国内版 | 空 |
| `SUPPORT_LINK_TTL_MS` | 临时凭证有效期（24h 内可重复访问） | `86400000`（24 小时） |
| `SUPPORT_MATCH_WINDOW_SEC` | 账单时间与申请时间的匹配窗口 | `60` |
| `POINTS_SEARCH_COST` 等 | 积分规则，见 `apps/gateway/src/points/quota.js` | |

引擎变量见 `engine/README.md`。

## API

- `GET /api/health`：`liveReady`、`modeLabel`、`engineConfigured`、`engineOk`（引擎地址、插件、微博细节仅管理员可见）
- `GET|POST /api/search`：`kw`、`cloud_types=quark,baidu,...`、`refresh=1`（跳过引擎缓存）。上游异常或只能返回演示数据时，本次搜索积分自动返还
- `POST /api/billing/notify`：渠道无关支付回调。请求头 `X-Yunlan-Timestamp`（毫秒/秒）、`X-Yunlan-Nonce`、`X-Yunlan-Signature`（hex HMAC-SHA256，签名原文为 `timestamp.nonce.` 拼接原始请求体），Body `{ "orderId": "...", "amountCny": 3, "status": "paid", "channelTxnId": "..." }`；校验金额与订单状态，按订单幂等开通，重复通知不会重复延长会员
- `POST /api/billing/orders`：Body `{ "planId": "month", "provider": "alipay" | "wechat" | "manual" }`；支付宝返回 `payUrl`（电脑网站收银台），微信返回 `qrCode`（Native `code_url`），未配置渠道时走人工流程（返回 `payment.contactEmail` 等，订单有效期 7 天）
- `GET /api/billing/admin/orders?status=pending|paid|all&limit=50`：管理端订单列表，需 `ADMIN_TOKEN`
- `POST /api/billing/admin/orders/:orderId/grant`：管理员线下核款后手动开通会员，Body 可选 `{ "note": "微信转账单号" }`；允许补开已过期订单，重复调用幂等。示例：`curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"note":"微信转账 123"}' https://<域名>/api/billing/admin/orders/ord_xxx/grant`
- `POST /api/billing/notify/alipay`：支付宝异步通知（`application/x-www-form-urlencoded` + RSA2 验签），成功返回纯文本 `success`
- `POST /api/billing/notify/wechat`：微信支付 APIv3 通知（平台证书验签 + AES-256-GCM 解密），成功返回 `{ "code": "SUCCESS" }`
- `POST /api/support/applications`：Body `{ "email": "...", "optInEmail": true }`。同一邮箱幂等；响应直接返回 `credential`（口令 + 24h 可重复访问的临时凭证），不依赖邮件。未勾选邮件许可时不调用任何邮件接口
- `GET /api/support/credential?token=...`：校验临时凭证，24h 内可重复调用，用于刷新或从邮件找回链接恢复浮层
- `POST /api/support/retrieve`：Body `{ "email": "..." }`，命中即签发新的 24h 凭证，用于「找回您的申请」
- `POST /api/support/choice`：Body `{ "token": "...", "choice": "support"|"skip" }`，记录浮层内选择
- `GET /api/support/qr?token=...`：赞赏码，仅当凭证有效且已选择 `support` 时返回，禁止缓存
- `GET /api/support/status`：凭 `?token=` 或 `yl_app` Cookie 读取本申请状态、口令与已上传凭证
- `POST /api/support/uploads`：补充账单截图（`Content-Type: image/png|jpeg|webp`，≤2MB）或仅 JSON `{ "tradeNo": "..." }`；凭 `?token=` 或 `yl_app` Cookie 识别申请
- `GET|POST /api/support/admin/applications`、`/admin/applications/:id`：管理端申请列表与详情，需 `ADMIN_TOKEN`
- `POST /api/support/admin/applications/:id/review`：人工终审，Body `{ "action": "approve"|"reject", "note": "...", "grantPlanId": "month"? }`；`grantPlanId` 仅对同邮箱已注册用户开通权限，不传则只改申请状态
- `POST /api/support/admin/applications/:id/resend`：重发当前状态通知（受 opt-in 与退订状态约束）
- `POST /api/support/admin/donations/import`：人工导入账单，Body `{ "csv": "到账时间,备注,金额,交易单号" }` 或 `{ "records": [...] }`。只生成加权候选，不修改申请状态
- `GET /api/support/admin/candidates?reviewed=0`：候选列表；`POST /api/support/admin/candidates/:id/reviewed` 标记已处理
- `POST /api/support/admin/qr`：上传赞赏码（`image/png|jpeg|webp`），仅在申请浮层内选择「自愿支持」后加载
- 页面：`/support` 申请表单（提交后页面内浮层展示口令与选项，含「找回您的申请」入口）、`/support/admin` 人工审核后台；旧邮件中的 `/relay/:token` 会 302 到 `/support?token=...`
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
