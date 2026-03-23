# v0.14.137-appclient-full-request-unification

## 迭代完成说明

- 将 `packages/nextclaw-ui/src/api/client.ts` 从直接 `fetch` 改为统一调用 `appClient.request()`，让 `api/config.ts`、`api/remote.ts`、`api/marketplace.ts`、`api/mcp-marketplace.ts`、`api/ncp-session.ts` 这类基于 `api.get/post/put/delete` 的受控动态请求默认进入 `appClient`。
- 新增 [`AppClient 全量请求收口设计`](../../../plans/2026-03-23-nextclaw-appclient-full-request-unification-design.md)，明确“业务层统一走 `appClient`、transport 内部保留 raw HTTP、remote 下统一走 multiplex websocket”的设计边界。
- 将 transport 内部 raw HTTP 抽离到 `packages/nextclaw-ui/src/api/raw-client.ts`，并把 `API_BASE` 独立到 `packages/nextclaw-ui/src/api/api-base.ts`，避免 `LocalAppTransport -> api client -> appClient -> LocalAppTransport` 的递归。
- 将聊天 legacy SSE 入口 `sendChatTurnStream()` / `streamChatRun()` 改为通过 `appClient.openStream()` 读取事件流；remote 下这两条链路会统一复用 remote multiplex websocket，而不是继续直接打 Worker HTTP/SSE。
- 为 NCP 页面新增 `packages/nextclaw-ui/src/components/chat/ncp/ncp-app-client-fetch.ts`，把 `NcpHttpAgentClientEndpoint` 的 JSON 请求与 SSE 流都转接到 `appClient`，让 NCP chat 在 remote 下也走统一收口。
- 对 remote transport 补齐流式错误传播语义：`stream.event` 回调内抛错时，会像 local transport 一样 reject 当前 stream promise，避免 remote / local 行为分叉。
- 同步执行 `packages/nextclaw build`，刷新内置分发产物 `packages/nextclaw/ui-dist`，确保 CLI / npm 分发包带上本次前端请求收口能力。

设计文档：

- [`Remote app transport multiplex design`](../../../plans/2026-03-23-nextclaw-remote-app-transport-multiplex-design.md)
- [`AppClient full request unification design`](../../../plans/2026-03-23-nextclaw-appclient-full-request-unification-design.md)

## 测试/验证/验收方式

- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc --pretty false`
- Lint：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui lint`
  - 结果：通过；仅存在仓库既有 warning，无新增 error。
- UI 构建：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui build`
- CLI 内置 UI 同步构建：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw build`
- 定向单测：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui test -- --run src/api/client.test.ts src/api/config.stream.test.ts src/components/chat/ncp/ncp-app-client-fetch.test.ts`
  - 覆盖点：
    - 普通 API 请求已统一走 `appClient.request`
    - 聊天 SSE 已统一走 `appClient.openStream`
    - NCP HTTP/SSE 已统一走 `appClient`
- 可维护性自检：
  - `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/api/api-base.ts packages/nextclaw-ui/src/api/raw-client.ts packages/nextclaw-ui/src/api/client.ts packages/nextclaw-ui/src/api/config.ts packages/nextclaw-ui/src/transport/app-client.ts packages/nextclaw-ui/src/transport/local.transport.ts packages/nextclaw-ui/src/transport/remote.transport.ts packages/nextclaw-ui/src/components/chat/ncp/NcpChatPage.tsx packages/nextclaw-ui/src/components/chat/ncp/ncp-app-client-fetch.ts packages/nextclaw-ui/src/components/chat/ncp/ncp-app-client-fetch.test.ts`
  - 结果：无阻塞项；保留 2 条 warning：
    - `packages/nextclaw-ui/src/api/config.ts` 历史上已超预算，本次净减少 74 行
    - `packages/nextclaw-ui/src/transport/remote.transport.ts` 接近预算线，后续可按 request / stream / socket lifecycle 再拆

## 发布/部署方式

- 适用范围：本次为 UI 行为变更，并且需要同步 `nextclaw` 内置 `ui-dist`。
- 实际发布链路：
  - 先执行 `PATH=/opt/homebrew/bin:$PATH NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:frontend`
  - 因 `nextclaw` 命中仓库 release group，首次被 `scripts/check-release-groups.mjs` 拦下；随后将 changeset 扩充为 `@nextclaw/ui + @nextclaw/mcp + @nextclaw/server + nextclaw`
  - 再执行 `PATH=/opt/homebrew/bin:$PATH NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:version`
  - 最后执行 `PATH=/opt/homebrew/bin:$PATH NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:publish`
- 实际已发布版本：
  - `@nextclaw/ui@0.9.12`
  - `nextclaw@0.13.29`
  - `@nextclaw/mcp@0.1.25`
  - `@nextclaw/server@0.10.25`
- 发布过程中由 changeset / 依赖联动额外带出的版本：
  - `@nextclaw/remote@0.1.21`
  - `@nextclaw/ncp-mcp@0.1.25`
  - `@nextclaw/channel-plugin-weixin@0.1.0`
- 如需本地仅验证分发包是否已带上改动，可执行：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw build`
  - 确认 `packages/nextclaw/ui-dist` 已更新为新产物。

## 用户/产品视角的验收步骤

1. 以 remote 方式打开 NextClaw UI，并完成登录。
2. 打开浏览器 DevTools 的 Network 面板，过滤 `fetch/xhr/ws`。
3. 保持页面空闲约 1 分钟，确认不再反复看到大量 `status / config / sessions / session-types / installed` 这类直连 Worker HTTP 请求。
4. 确认页面主要保留：
   - 初始化阶段少量必要请求
   - 1 条 remote multiplex websocket
   - 少量不可避免的非受控请求
5. 在普通 chat 页面发送一条消息，确认流式输出正常，且 remote 下未额外出现独立聊天 SSE 直连。
6. 在 NCP chat 页面发送一条消息，确认流式输出正常，且 remote 下未额外出现独立 NCP HTTP/SSE 直连。
7. 刷新会话列表、查看 session history、切换 session type、查看 installed skills 等常规交互，确认功能正常且请求面仍主要收敛在 multiplex websocket。
