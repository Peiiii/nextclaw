# Chat UI Owner Refactor

## 迭代完成说明

本次完成 chat UI 相关职责回收与 show content 链路整理：

- 将全局内容展示能力收敛到 `ChatUiManager`，由它持有 `DocBrowserManager` 并提供统一的 `showContent` 意图级入口。
- `NcpChatThreadManager` 只保留会话 workspace / file preview / child session panel 相关职责；URL 与 panel app 展示委托给 `ChatUiManager`。
- 移除 `NcpChatInputManager.goToProviders`、`NcpChatThreadManager.goToProviders`、`NcpChatThreadManager.createSession` 这类空心转发入口。
- 将 provider 配置入口调用改为直接使用 `presenter.chatUiManager.goToProviders`。

根因：此前 UI 能力散落在 thread/input manager 上，导致职责名和实际 owner 不一致，且产生只转发不决策的 public 方法。
确认方式：通过全局搜索调用点、构造函数依赖、测试断言和治理检查确认旧入口已收敛。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test src/features/chat/managers/__tests__/chat-ui.manager.test.ts src/features/chat/managers/__tests__/ncp-chat-thread.manager.test.ts src/features/chat/managers/__tests__/ncp-chat-input.manager.test.ts src/features/chat/components/conversation/__tests__/chat-conversation-panel.test.tsx`
  - 结果：通过，4 个测试文件，46 个用例。
- `pnpm -C packages/nextclaw-ui tsc`
  - 结果：通过。
- `pnpm -C packages/nextclaw-ui lint`
  - 结果：通过，0 error；仍有 33 个既有 warning。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
  - 结果：通过；工作区混合 WIP 口径下非测试代码净增 `-1` 行。
- `pnpm lint:new-code:governance`
  - 结果：通过。
- `pnpm check:governance-backlog-ratchet`
  - 结果：通过。
- `pnpm check:generated-clean`
  - 结果：通过。

## 发布/部署方式

本次未发布、未部署。属于前端内部职责重构和测试补强。

## 用户/产品视角的验收步骤

1. 当 chat 链路触发 `showContent` 的 URL 或 panel app 请求时，应由全局 UI owner 打开 DocBrowser 展示。
2. 当 `showContent` 的目标是本地文件时，仍应在会话 workspace file preview 中打开。
3. Provider 配置提示中的跳转按钮仍应进入 `/providers`。

## 可维护性总结汇总

本次使用 `post-edit-maintainability-review` 思路进行复核。

- 代码组织：全局展示归 `ChatUiManager`，thread manager 回到会话 workspace 职责，input manager 不再依赖 UI manager。
- 正向减债动作：职责收敛、删除空心转发、减少 `NcpChatThreadManager` 对 doc browser / panel app / viewport 细节的依赖。
- 非测试代码增减：按本次 scoped commit 口径，新增约 `62` 行，删除约 `79` 行，净增约 `-17` 行。
- 可维护性风险：`chat-input-bar.container.tsx` 和 `ncp-chat-thread.manager.ts` 仍接近文件预算，需要后续继续拆分混合职责。

## NPM 包发布记录

不涉及 NPM 包发布。
