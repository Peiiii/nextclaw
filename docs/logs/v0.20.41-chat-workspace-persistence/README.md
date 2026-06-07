# v0.20.41-chat-workspace-persistence

## 迭代完成说明

本次把 Chat 工作区侧边栏的打开状态接入 Zustand `persist`，让它和 DocBrowser 一样具备刷新后的 UI 连续性。

完成内容：

- `chat-thread.store.ts` 从普通 Zustand store 改为带 `persist` 的 store。
- 持久化范围只包含 workspace panel 连续性字段：`workspacePanelParentKey`、`activeWorkspacePanelKind`、`activeChildSessionKey`、`workspaceFileTabs`、`activeWorkspaceFileKey`。
- 运行态字段不进入缓存，包括当前会话消息、发送状态、provider 状态、React ref 等。
- 文件预览 tab 最多缓存 `8` 个，并去掉 `fullLines` 这种可能较重、可由文本重新构建的展示行数据。
- rehydrate 时校验 persisted payload，丢弃无效文件 tab，并在 active file key 失效时回退到第一个有效文件 tab。
- 新增 store 级测试，证明持久化由 store owner 承担，而不是组件或 provider 手写 `localStorage`。

这是用户可见体验能力补齐，不是纯内部重构。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test -- chat-thread.store.test.ts ncp-chat-thread.manager.test.ts chat-session-list.manager.test.ts`
  - 结果：通过，`3` 个测试文件、`20` 个测试通过。
- `pnpm -C packages/nextclaw-ui test -- chat-conversation-panel.test.tsx`
  - 结果：通过，`1` 个测试文件、`19` 个测试通过。
- `pnpm -C packages/nextclaw-ui tsc --noEmit`
  - 结果：通过。
- `pnpm -C packages/nextclaw-ui exec eslint src/features/chat/stores/chat-thread.store.ts src/features/chat/stores/chat-thread.store.test.ts`
  - 结果：通过，无输出。
- `pnpm -C packages/nextclaw-ui lint -- src/features/chat/stores/chat-thread.store.ts src/features/chat/stores/chat-thread.store.test.ts`
  - 结果：通过，`0` errors；保留全包既有 `32` 个 warnings。
- `pnpm -C packages/nextclaw-ui build`
  - 结果：通过；Vite 保留既有 chunk size warning。
- `pnpm lint:new-code:governance`
  - 结果：通过。
- `pnpm check:governance-backlog-ratchet`
  - 结果：通过，ratchet status OK。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/features/chat/stores/chat-thread.store.ts packages/nextclaw-ui/src/features/chat/stores/chat-thread.store.test.ts`
  - 结果：Errors 0，Warnings 1；总代码 `+311 / -9 / net +302`，非测试代码 `+183 / -9 / net +174`。warning 为 `chat-thread.store.ts` 本次增长明显，但仍低于 `400` 行预算。
- `pnpm clean:generated`
  - 结果：generated artifacts are clean。

## 发布/部署方式

本次未执行发布、部署或 NPM publish。

已新增 `.changeset/chat-workspace-panel-persistence.md`，后续统一发布时应作为 `@nextclaw/ui` patch 变更进入 changelog。

## 用户/产品视角的验收步骤

1. 打开一个 Chat 会话。
2. 打开右侧工作区侧边栏中的 child-session、cron 或文件预览 tab。
3. 刷新页面。
4. 确认侧边栏仍按同一会话恢复打开状态，并优先恢复此前选中的面板或文件 tab。
5. 切换到其他会话时，确认不会错误展示上一会话的侧边栏内容。
6. 回到原会话时，确认缓存的 workspace panel 状态仍可恢复。

本轮已通过 store rehydrate 测试和 panel 渲染回归测试覆盖上述核心状态恢复路径；未启动真实本地 UI 服务做手动浏览器刷新验收。

## 可维护性总结汇总

`post-edit-maintainability-review` 结论：通过。

代码增减报告：新增 `311` 行，删除 `9` 行，净增 `302` 行。

非测试代码增减报告：新增 `183` 行，删除 `9` 行，净增 `174` 行。

本次是新增用户可见体验能力，非测试代码净增来自 store 持久化、payload 校验、active key 修复和缓存范围控制。实现没有把缓存读写散到组件、provider 或 manager；状态 owner 仍是 `chat-thread.store.ts`，动作 owner 仍是 `NcpChatThreadManager`。测试新增集中在 store owner，避免 UI 组件感知持久化细节。

本次未顺手做无关减债。维护性剩余关注点是 `chat-thread.store.ts` 增长明显；当前文件 `295` 行，低于 `400` 行预算。后续如果 chat thread store 继续膨胀，应优先把 workspace persistence normalization 拆到同 feature 的窄 utility，并保持 store 只做组合与 persist wiring。

## NPM 包发布记录

不涉及 NPM 包发布。

后续统一发布时需包含：

- `@nextclaw/ui` patch：Chat workspace panel reload persistence。
