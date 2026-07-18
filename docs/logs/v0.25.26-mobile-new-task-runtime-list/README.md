# v0.25.26 移动端新任务会话类型列表修复

## 迭代完成说明

修复移动端会话列表“新任务”弹层重复显示当前偏好类型、同时遗漏 Native 的问题。会话页输入面板下方的类型选择链路没有改动。

根因是移动端弹层把持久化的新会话类型偏好作为首项插入，却把另一份列表按服务端默认类型过滤；当服务端默认类型是 Native、用户偏好是 Claude Code 时，两套基准不一致，导致 Claude Code 被拼入两次、Native 被过滤。通过本地源码实例的 `/api/ncp/session-types` 与偏好接口，以及移动端列表拼装代码共同确认根因。

修复直接删除移动端专用的二次列表拼装路径，让弹层消费已经规范化并去重的完整 `sessionTypeOptions`。这修正了事实来源，而不是在渲染结果上追加去重或 Native 特判。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui exec vitest run src/features/chat/components/layout/__tests__/chat-sidebar.test.tsx src/features/chat/components/layout/__tests__/chat-sidebar-toolbar.test.tsx`：通过，2 个测试文件、27 个测试；新增“服务端默认 Native、持久偏好 Codex”回归场景，断言偏好类型只出现一次且 Native 仍可见。
- `pnpm --filter @nextclaw/ui tsc`：通过。
- `pnpm --filter @nextclaw/ui lint`：通过，保留 1 个与本次无关的 `cron-config.tsx` 既有复杂度 warning。
- `pnpm --filter @nextclaw/ui build`：通过。
- `pnpm --filter @nextclaw/ui test`：全量测试仍被与本次无关的既有失败阻塞；`chat-conversation-welcome.test.tsx` 缺少 `QueryClientProvider`，`chat-session-workspace-panel.test.tsx` 有一条刷新测试失败。本次两份定向测试全部通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`：通过，Errors 0、Warnings 1；总计新增 19 行、删除 41 行、净减 22 行，排除测试后新增 2 行、删除 32 行、净减 30 行。唯一 warning 是已有大型侧栏测试文件接近 900 行预算线，未越界。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm lint:new-code:governance`：被工作区中与本次无关的 `apps/platform-console/src/api/client.ts` 和 `workers/nextclaw-provider-gateway-api/src/types/platform.ts` 命名问题阻塞；本次触达文件的 package ESLint、定向测试与 maintainability guard 均通过。
- 本地源码 dev 实例：前端 `http://127.0.0.1:5174/chat`、后端 `http://127.0.0.1:18792`。在 390×844 视口点击移动端“新任务”，Native、Claude Code、Codex、Hermes、OpenCode 均恰好显示一次，Claude Code 保持当前选中状态。

## 发布/部署方式

本次只修改前端源码、定向测试和发布说明元数据，不涉及数据库 migration、后端部署或线上 API 冒烟。后续随 `@nextclaw/ui` 的统一 patch 发布进入 NextClaw 安装包；本轮未执行发布、部署或推送。

## 用户/产品视角的验收步骤

1. 将 NextClaw 窗口缩窄到移动端布局，进入会话列表。
2. 点击搜索框右侧的“新任务”按钮。
3. 确认 Native、Claude Code、Codex、Hermes、OpenCode 各出现一次。
4. 确认用户上次选择的新会话类型仍显示选中标记，并可正常创建对应类型任务。
5. 进入任意会话，确认输入面板下方的会话类型选择行为保持不变。

## 可维护性总结汇总

本次使用删除与复用完成修复：删除移动端专用的列表重组 helper、冗余派生列表和 props，让移动端与其它会话类型菜单共用同一个规范化事实源；测试侧复用统一的偏好 mock helper，避免继续复制相同 fixture。没有新增组件、状态源、fallback、去重补丁或 runtime 特判；总计新增 19 行、删除 41 行、净减 22 行，排除测试后新增 2 行、删除 32 行、净减 30 行。

`post-edit-maintainability-guard` 通过；`post-edit-maintainability-review` 结论为通过，正向减债动作是删除、简化与复用。唯一保留的观察项是 `chat-sidebar.test.tsx` 已达到测试文件预算线，后续再扩展该文件时应优先拆分 fixtures/builders 与行为用例。

## NPM 包发布记录

- `@nextclaw/ui`：需要 patch 发布；已添加 `.changeset/mobile-new-task-runtime-list.md`，状态为待统一发布。
- 其它 NPM 包：不涉及。
