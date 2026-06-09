# v0.20.55 Chat Frontend MVP Decoupling

## 迭代完成说明

本次迭代优先处理 Chat 前端 MVP 解耦计划里的高复杂度点，先做第一波低风险 owner 收敛：

- `ChatMessageListContainer` 不再自己判断 tool action 类型，统一交给 `NcpChatThreadManager.handleToolAction`。
- `NcpChatThreadManager` 将 `showContent` 和 `openSessionFromToolAction` 收为内部实现细节，对外保留一个 tool action 入口。
- `showContent(panel_app)` 会先按当前已安装 Panel App 列表解析 manifest `appId`，再用 DocBrowser 的完整 panel app target 打开，避免把 manifest id 误当内部 entry id 导致 `PANEL_APP_INVALID_ID`。
- `ChatSessionWorkspacePanel` 不再直接调用 `ChatSessionListManager` 标记 child session 已读，改为把 active workspace selection 交给 thread manager 同步。
- `ChatPresenterProvider` 不再手写重复的 manager 方法签名，改为从实际 manager public surface 推导 context 类型。
- `NcpChatThreadManager` 内部复用 `closeWorkspacePanel()`，减少重复 workspace clear patch。

本轮主体不是新增用户功能，目标是降低 View 层业务分发和 provider 类型重复维护成本；同时修正 show-content 打开 Panel App 时的入口 id 解析问题。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui test`
- `pnpm -C packages/nextclaw-ui exec vitest run src/features/chat/components/conversation/__tests__/chat-attachment-upload-limit.test.ts --pool=threads --fileParallelism=false`
- `pnpm -C packages/nextclaw-ui lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/features/chat/managers/ncp-chat-thread.manager.ts packages/nextclaw-ui/src/features/chat/components/providers/chat-presenter.provider.tsx packages/nextclaw-ui/src/features/chat/components/chat-session-workspace-panel.tsx packages/nextclaw-ui/src/features/chat/components/conversation/chat-message-list.container.tsx packages/nextclaw-ui/src/features/chat/managers/chat-session-list.manager.ts packages/nextclaw-ui/src/features/chat/managers/__tests__/ncp-chat-thread.manager.test.ts packages/nextclaw-ui/src/features/chat/components/conversation/__tests__/chat-attachment-upload-limit.test.ts`

结果：以上命令均通过。`pnpm -C packages/nextclaw-ui lint` 为 `0` error，仍有历史 warning。功能层面覆盖 tool action 分发、file preview、URL / panel app content 打开、visible child session read sync；未额外启动真实本地 UI 进行手工点击验收。

## 发布/部署方式

未执行发布或部署。本次是前端内部解耦和测试补充，尚未形成需要单独上线发布的用户功能增量。

## 用户/产品视角的验收步骤

1. 在 Chat 消息列表中点击 show-content 类 tool action，文件内容仍进入 workspace file preview，URL 和 panel app 内容仍进入 DocBrowser。
2. AI 触发 `showContent(panel_app)` 时，使用 manifest `appId` 也能打开已安装 Panel App。
3. 点击 open-session 类 tool action，仍能跳转目标 session；桌面 child session 场景仍优先打开 workspace child panel。
4. 在 workspace 中切到 child session tab 后，已读标记仍由 session list owner 处理，组件层不再自行判断 read 规则。

## 可维护性总结汇总

本次 maintainability guard 结果：

- 当前检查范围总变更：`+72 / -77 / net -5`
- 当前检查范围非测试代码：`+71 / -76 / net -5`
- 结论：检查通过；`NcpChatThreadManager` 接近 600 行预算，已记录为后续拆分风险。

正向减债：

- 删除组件层 tool action 分发分支。
- 删除 provider 里的重复 manager 方法签名清单。
- 收敛 `NcpChatThreadManager` 对外公开面。
- 复用已有 workspace close owner，减少重复 patch。

剩余风险：

- `NcpChatThreadManager` 当前 551 行，接近 600 行预算；下一步应优先拆 workspace view model / content dispatch 子 owner，避免继续膨胀。
- `ncp-chat-thread.manager.test.ts` 本轮增长明显，后续应抽测试 fixture / builder，避免测试文件成为新热点。

## NPM 包发布记录

未执行 NPM 包发布。`@nextclaw/ui` 的用户可见 show-content 行为变更已通过现有 `.changeset/chat-ui-show-content.md` 纳入后续统一发布。
