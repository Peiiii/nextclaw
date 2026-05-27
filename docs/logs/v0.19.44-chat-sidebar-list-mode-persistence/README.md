# v0.19.44 Chat Sidebar List Mode Persistence

## 迭代完成说明

本次完成会话侧栏“按时间 / 按项目”视图偏好的本地持久化。`listMode` 原本已经由 `useChatSessionListStore` 维护，组件通过 `ChatSessionListManager.setListMode` 更新状态；本次没有把状态逻辑下沉到组件 effect，而是让 store 作为偏好 owner，并通过 Zustand `persist` middleware 只持久化 `snapshot.listMode`。

本地存储 key 为 `nextclaw.chat.session-list.mode`，只接受 `time-first` 与 `project-first` 两个合法值。storage 不可用或已有值非法时回到默认 `time-first`，避免刷新恢复逻辑引入隐藏双路径或异常阻断。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- src/features/chat/managers/chat-session-list.manager.test.ts src/features/chat/components/layout/chat-sidebar.test.tsx`：2 个测试文件、35 个用例通过。
- `pnpm --filter @nextclaw/ui tsc`：通过。
- `pnpm --filter @nextclaw/ui lint`：未通过，阻塞来自既有无关 lint 错误，本次触达文件不在报错列表中。
- `pnpm --filter @nextclaw/ui exec eslint src/features/chat/stores/chat-session-list.store.ts src/features/chat/managers/chat-session-list.manager.test.ts`：通过。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/features/chat/stores/chat-session-list.store.ts packages/nextclaw-ui/src/features/chat/managers/chat-session-list.manager.test.ts`：通过，0 errors / 0 warnings。

## 发布/部署方式

本次未执行发布、部署或 NPM 发版。改动位于 `@nextclaw/ui`，后续进入统一 beta 批次时随 UI 包一起发布。

## 用户/产品视角的验收步骤

1. 打开 NextClaw 的聊天/会话页。
2. 在会话侧栏将视图切换到“按项目”。
3. 刷新页面或重启前端。
4. 会话侧栏应继续保持“按项目”视图。
5. 再切回“按时间”并刷新，应恢复为“按时间”视图。

## 可维护性总结汇总

本次是新增用户可见体验能力，非测试代码净增长用于建立明确的持久化合同与非法值保护。owner 边界保持清晰：store 拥有列表视图偏好状态和本地持久化，manager 仍只暴露意图级 `setListMode`，组件不新增副作用同步逻辑。

代码增减：总计新增 116 行、删除 7 行、净增 109 行；非测试代码新增 58 行、删除 7 行、净增 51 行。Maintainability guard 通过，未新增目录、文件或函数级维护性问题。本次没有为压低行数折叠清晰分支，保留了 storage 不可用与非法值的显式处理。

## NPM 包发布记录

不涉及 NPM 包发布；本次处于本地实现与验收阶段。
