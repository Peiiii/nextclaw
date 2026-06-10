# v0.20.66-chat-run-owner-convergence

## 迭代完成说明

本次完成 P0：收敛 Chat 主运行链路 owner。

指导思想与原则：

- 产品层命名服务 NextClaw 用户体验，不把基础设施协议名暴露成业务 owner 名称；协议边界可以继续保留 `ncp`。
- 单一主链路优先：发送、停止、恢复、运行快照同步和根路由物化统一收敛到 `ChatRunManager`。
- Presenter / Manager / Store 分层：`ChatPresenter` 只负责组装 feature owner，落在 `presenters/chat.presenter.ts`；运行编排由 manager 承担；组件和页面只做连接。
- 角色优先文件组织：Presenter 不放在 `managers/`，文件和目录必须能直接识别职责。
- 命名遵循语义化、无歧义、清晰简洁，避免 `NcpChat*Manager` 这类把协议名误当产品层职责名。

主要改动：

- 将 `chat-stream-actions.manager.ts` 收敛为 `chat-run.manager.ts`，不再是回调注册器，而是 Chat 运行链路 owner。
- 将 `NcpChatPresenter` 迁移为 `ChatPresenter`，并移动到 `packages/nextclaw-ui/src/features/chat/presenters/chat.presenter.ts`。
- 将 `NcpChatInputManager`、`NcpChatThreadManager`、`NcpChatQueryManager` 等产品层 owner 去协议名前缀。
- `ncp-chat-page.tsx` 不再直接构造 envelope / metadata / 恢复草稿 / 根路由物化，只负责连接 runtime 与 `ChatRunManager`。
- 删除页面内重复的快照同步 helper，将运行状态写入 input/thread store 的职责归到 `ChatRunManager`。

## 测试/验证/验收方式

- 通过：`pnpm --filter @nextclaw/ui tsc`
- 通过：`pnpm --filter @nextclaw/ui test -- src/features/chat/managers/__tests__/chat-run.manager.test.ts src/features/chat/managers/__tests__/chat-input.manager.test.ts src/features/chat/managers/__tests__/chat-session-list.manager.test.ts src/features/chat/managers/__tests__/chat-thread.manager.test.ts src/features/chat/pages/__tests__/ncp-chat-page.test.ts src/features/chat/features/ncp/hooks/__tests__/use-ncp-chat-query-store-sync.test.ts src/features/agents/components/__tests__/agents-page.test.tsx`
- 通过：`pnpm --filter @nextclaw/ui lint`，结果为 0 error，保留 32 个既有 warning。
- 通过：`pnpm lint:new-code:governance`
- 通过：`pnpm check:governance-backlog-ratchet`
- 已检查：旧主链路 owner 名称残留扫描无结果。

`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature` 的全工作区口径未通过，阻塞项为当前工作区 205 个改动文件整体非测试净增 +17。按本次 Chat P0 范围核算，`git diff HEAD --numstat` 为总计 +539 / -522 / 净增 +17，非测试 +277 / -283 / 净增 -6。

## 发布/部署方式

不涉及发布、部署或 runtime update channel。

## 用户/产品视角的验收步骤

1. 打开 Chat 页面。
2. 在根 `/chat` 发送首条消息，确认发送后路由能物化到真实 session。
3. 在已有 session 中发送、停止、恢复运行，确认输入框、消息列表、运行中状态和错误提示同步正常。
4. 切换 session / 新建 draft，确认旧运行态被清理，页面不保留上一会话的发送状态。

本轮已用定向单测覆盖上述 owner 行为；未启动真实浏览器 dev server 做手动 UI 冒烟。

## 可维护性总结汇总

- 本次顺手减债：是。
- 正向减债动作：职责收敛、删除页面内重复业务编排、命名与角色目录校正。
- 非测试代码增减：新增 277 行，删除 283 行，净减 6 行。
- `ChatPresenter` 已按角色移动到 `presenters/`，避免 presenter 伪装成 manager。
- `ncp-chat-page.tsx` 继续保留协议边界命名，但主运行链路 owner 已从页面 effect 与回调注册器收回到 `ChatRunManager`。
- 剩余观察点：`ncp-chat-query.store.ts` 等协议/查询边界仍带 `ncp` 名称，本轮未扩展为查询域改名，避免偏离 P0 主运行链路收敛目标。

## NPM 包发布记录

不涉及 NPM 包发布。
