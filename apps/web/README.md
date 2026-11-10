# 云览 Web（apps/web）

Vite + React + TypeScript + Tailwind v4。所有数据请求走同源 `/api/*`（开发时由 Vite 代理到网关 `:8787`）。

```bash
npm run dev:web     # 仓库根执行，:5173
npm run build       # 产物 apps/web/dist，由网关静态托管
```

网关响应适配见 `src/services/gatewayAdapter.ts`；浏览器存储键集中在 `src/utils/storage.ts`（`yunlan.*`，启动时自动迁移旧键）。
