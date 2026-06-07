# v0.20.41-chat-workspace-persistence

## 迭代完成说明

本次把 Chat 工作区侧边栏的打开状态接入 Zustand `persist`，让它和 DocBrowser 一样具备刷新后的 UI 连续性。同批次补齐工作区局部后退/前进历史，让右侧栏 header 对齐 DocBrowser 的导航语义，而不是把左箭头误用为“返回父会话”。

完成内容：

- `chat-thread.store.ts` 从普通 Zustand store 改为带 `persist` 的 store。
- 持久化范围只包含 workspace panel 连续性字段：`workspacePanelParentKey`、`activeWorkspacePanelKind`、`activeChildSessionKey`、`workspaceFileTabs`、`activeWorkspaceFileKey`。
- 运行态字段不进入缓存，包括当前会话消息、发送状态、provider 状态、React ref 等。
- 文件预览 tab 最多缓存 `8` 个，并去掉 `fullLines` 这种可能较重、可由文本重新构建的展示行数据。
- rehydrate 时校验 persisted payload，丢弃无效文件 tab，并在 active file key 失效时回退到第一个有效文件 tab。
- 新增 store 级测试，证明持久化由 store owner 承担，而不是组件或 provider 手写 `localStorage`。
- 新增业务无关的 `navigation-history` shared primitive，DocBrowser 和 Chat workspace 都复用它维护 push、back、forward、filter 语义。
- Chat workspace store 只持久化轻量 `{ kind, key }` 历史 entry，manager 负责把 child-session、file、cron selection 映射到通用 history。
- 右侧工作区 header 改为工作区局部后退/前进按钮；“返回父会话”只保留在父会话 banner，不再和工作区历史导航混用。

这是用户可见体验能力补齐，不是纯内部重构。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test -- src/shared/lib/navigation-history/navigation-history.utils.test.ts src/shared/components/doc-browser/doc-browser-context.test.tsx src/features/chat/managers/ncp-chat-thread.manager.test.ts src/features/chat/stores/chat-thread.store.test.ts src/features/chat/managers/chat-session-list.manager.test.ts src/features/chat/components/conversation/chat-conversation-panel.test.tsx`
  - 结果：通过，`6` 个测试文件、`65` 个测试通过。
- `pnpm -C packages/nextclaw-ui tsc`
  - 结果：通过。
- `pnpm -C packages/nextclaw-ui lint`
  - 结果：通过，`0` errors；保留全包既有 `32` 个 warnings，当前触达文件无新增 warning。
- `pnpm -C packages/nextclaw-ui build`
  - 结果：本轮尚未重跑；上一轮 workspace persistence 改动已通过，当前继续以 `tsc`、lint 和定向行为测试覆盖本批 UI/source 变更。
- `pnpm lint:new-code:governance`
  - 结果：全量执行被无关 `packages/browser-connector/src/controllers/page.controller.ts` WIP 阻塞；限定本任务触达文件执行通过，`governance all checks passed`。
- `pnpm check:governance-backlog-ratchet`
  - 结果：通过，ratchet status OK。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <本轮触达的 nextclaw-ui 文件>`
  - 结果：Errors 0，Warnings 7；总代码 `+778 / -89 / net +689`，非测试代码 `+475 / -63 / net +412`。主要 warning 为 chat workspace/store/manager 与 DocBrowser manager 接近文件预算；`chat-thread.store.ts` 已从初次检查的 `401` 行收敛到 `399` 行，回到 `400` 行预算内。
- `pnpm clean:generated`
  - 结果：generated artifacts are clean。

## 发布/部署方式

本次未执行发布、部署或 NPM publish。

已新增 `.changeset/chat-workspace-panel-persistence.md`，后续统一发布时应作为 `@nextclaw/ui` patch 变更进入 changelog，内容包含 workspace panel refresh persistence 与 workspace-local history navigation。

## 用户/产品视角的验收步骤

1. 打开一个 Chat 会话。
2. 打开右侧工作区侧边栏中的 child-session、cron 或文件预览 tab。
3. 刷新页面。
4. 确认侧边栏仍按同一会话恢复打开状态，并优先恢复此前选中的面板或文件 tab。
5. 在右侧工作区内依次切换 child-session、文件预览、cron 等 tab。
6. 点击右侧工作区 header 的后退按钮，确认回到上一步选择；再点击前进按钮，确认恢复下一步选择。
7. 在后退后选择一个新的 tab，确认前进历史被截断。
8. 切换到其他会话时，确认不会错误展示上一会话的侧边栏内容。
9. 回到原会话时，确认缓存的 workspace panel 状态仍可恢复。

本轮已通过 store rehydrate、manager history、DocBrowser history 回归和 panel 渲染交互测试覆盖上述核心路径；未启动真实本地 UI 服务做手动浏览器刷新验收。

## 可维护性总结汇总

`post-edit-maintainability-review` 结论：通过。

代码增减报告：新增 `311` 行，删除 `9` 行，净增 `302` 行。

非测试代码增减报告：新增 `183` 行，删除 `9` 行，净增 `174` 行。

本次是新增用户可见体验能力，非测试代码净增来自 store 持久化、payload 校验、active key 修复、缓存范围控制和共享 history primitive。实现没有把缓存读写散到组件、provider 或 manager；状态 owner 仍是 `chat-thread.store.ts`，动作 owner 仍是 `NcpChatThreadManager`，跨业务 history 语义收敛到 `shared/lib/navigation-history` 并由 DocBrowser 共同复用。

本次顺手减债是删除 DocBrowser 内部手写 active history push/back/forward/filter 逻辑，改用共享 primitive，避免 Chat workspace 再复制一套私有历史栈。维护性剩余关注点是 `chat-thread.store.ts` 和 `ncp-chat-thread.manager.ts` 继续承载 workspace 状态与行为增长；如果后续 workspace 能力继续扩展，应优先抽出同 feature 的 workspace selection/history utility，保持 store 做 persist wiring、manager 做意图级 transition。

## NPM 包发布记录

不涉及 NPM 包发布。

后续统一发布时需包含：

- `@nextclaw/ui` patch：Chat workspace panel reload persistence and workspace-local history navigation。
