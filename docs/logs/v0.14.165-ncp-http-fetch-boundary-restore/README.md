# v0.14.165-ncp-http-fetch-boundary-restore

## 迭代完成说明

- 修复 Codex/NCP 会话点击终止时的 transport 边界回归。
- 将 [`packages/nextclaw-ui/src/components/chat/ncp/ncp-app-client-fetch.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/ncp/ncp-app-client-fetch.ts) 收回为原生 `fetch` 包装：只注入 `credentials: 'include'`，不再把 NCP HTTP client 请求改写成 `appClient.request/openStream` 的 typed transport 调用。
- 去掉原先“捕获 transport 异常后伪造 HTTP 500 Response”的行为，避免把真实网络/transport 错误伪装成 `Abort request failed with HTTP 500: Failed to fetch`。
- 更新 [`packages/nextclaw-ui/src/components/chat/ncp/ncp-app-client-fetch.test.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/ncp/ncp-app-client-fetch.test.ts)，锁定三条边界：
  - 只注入 credentials，不改写原生 fetch 语义
  - fetch 失败时直接向上抛真实错误
  - SSE 请求保持原生请求头与响应语义

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test -- src/components/chat/ncp/ncp-app-client-fetch.test.ts`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui exec eslint src/components/chat/ncp/ncp-app-client-fetch.ts src/components/chat/ncp/ncp-app-client-fetch.test.ts`
- `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/components/chat/ncp/ncp-app-client-fetch.ts packages/nextclaw-ui/src/components/chat/ncp/ncp-app-client-fetch.test.ts`

## 发布/部署方式

- 本次未执行发布。
- 后续按常规 UI/CLI 发布链路发版即可；不需要额外迁移。

## 用户/产品视角的验收步骤

1. 打开包含 `codex` session type 的聊天页面。
2. 发起一轮 Codex 回复，确认会话进入运行中状态。
3. 点击“终止/Stop”。
4. 预期结果：
   - 前端不再出现 `Abort request failed with HTTP 500: Failed to fetch`
   - 当前运行被终止
   - 会话可继续正常发送下一条消息
