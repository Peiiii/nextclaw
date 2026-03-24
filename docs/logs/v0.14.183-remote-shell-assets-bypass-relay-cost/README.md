# v0.14.183-remote-shell-assets-bypass-relay-cost

## 迭代完成说明

- 将 remote 首屏页面壳与 `ui-dist` 静态资源改为由 `nextclaw-provider-gateway-api` worker 直接提供，不再走 remote relay DO 代理链路。
- 在 worker 中新增 remote static asset 中间层：仅对 remote 会话下的 `GET/HEAD` 浏览器壳请求生效，保留 `/platform/*`、`/v1/*`、`/_remote/*`、`/health` 等保留路由继续走原业务处理。
- 为静态资源接入 Cloudflare assets 绑定，并对 SPA 路由增加 `index.html` 回退；真实静态文件缺失时仍返回缺失，不会被错误吞掉。
- 保留真正 remote 交互链路的额度与成本控制：`/_remote/runtime`、`/_remote/ws`、WS 消息租约仍继续计入 quota。

## 测试/验证/验收方式

- `pnpm -C workers/nextclaw-provider-gateway-api build`
- `pnpm -C workers/nextclaw-provider-gateway-api lint`
- `pnpm -C workers/nextclaw-provider-gateway-api tsc`
- `pnpm -C workers/nextclaw-provider-gateway-api test:quota`
- `node --test workers/nextclaw-provider-gateway-api/tests/remote-static-assets-service.test.mjs`
- `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths workers/nextclaw-provider-gateway-api/src/index.ts workers/nextclaw-provider-gateway-api/src/controllers/remote-controller.ts workers/nextclaw-provider-gateway-api/src/controllers/remote-static-assets-controller.ts workers/nextclaw-provider-gateway-api/src/services/remote-static-assets-service.ts workers/nextclaw-provider-gateway-api/tests/remote-static-assets-service.test.mjs workers/nextclaw-provider-gateway-api/wrangler.toml`

## 发布/部署方式

- 发布 worker：`pnpm -C workers/nextclaw-provider-gateway-api deploy`
- 本次未触达数据库结构与 D1 migration，`db:migrate:remote` 不适用。
- 发布后建议在线验证 remote 会话冷打开时，页面壳与 `/assets/*` 不再进入 relay proxy 计费链路。

## 用户/产品视角的验收步骤

1. 在 desktop 端保持 remote access 在线。
2. 从 platform 打开某个 remote instance，进入新的 remote 会话页面。
3. 首次打开页面后，确认基础 UI 能正常加载，SPA 路由刷新仍可打开。
4. 再观察 remote quota 或底层计量：冷打开不应再出现原先那组由 `/` 与 `/assets/*` 带来的 `proxy_http` DO 消耗。
5. 继续执行真实交互，例如 runtime 初始化、WS 建连、页面内操作，确认这些真实 remote 链路仍正常可用且仍受 quota 保护。
