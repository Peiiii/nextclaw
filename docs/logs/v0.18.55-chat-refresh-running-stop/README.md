# v0.18.55 Chat Refresh Running Stop

## 迭代完成说明

- 修复刷新聊天页后，当前 session 仍在运行但输入框不显示终止按钮的问题。
- 根因：HTTP session API 由 kernel 的持久化 session service 提供，读取 `/api/ncp/sessions` 时没有叠加当前 agent backend 的 live runtime 状态；真实运行态在 `DefaultNcpAgentBackend` 的 live session registry / `activeExecution`。
- 确认方式：真实启动 native 长输出会话时，SSE 已有 `run.started` 且 assistant message 为 `streaming`，但旧接口顶层 `status` 仍为 `idle`。
- 修复方式：在 agent backend 暴露 O(1) 的 `isLiveSessionRunning(sessionId)`，kernel session API 返回 summary 时只 overlay live running 状态，不读取或重放 journal/messages；前端继续只消费 API summary 的 `status`。

## 测试/验证/验收方式

- `node packages/nextclaw-kernel/node_modules/vitest/vitest.mjs run packages/nextclaw-kernel/src/services/ncp-session-api.service.test.ts --config packages/nextclaw-kernel/vitest.config.ts`
- `pnpm -C packages/nextclaw-ui test src/features/chat/hooks/use-ncp-agent-runtime.test.tsx src/features/chat/pages/ncp-chat-page.test.ts src/features/chat/utils/ncp-session-adapter.utils.test.ts`
- `node packages/ncp-packages/nextclaw-ncp-toolkit/node_modules/typescript/bin/tsc -p packages/ncp-packages/nextclaw-ncp-toolkit/tsconfig.json --pretty false --noEmit`
- `pnpm -C packages/nextclaw-kernel exec tsc -p tsconfig.json --pretty false --noEmit`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-react tsc`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit lint`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-react lint`
- `pnpm -C packages/nextclaw-ui exec eslint src/features/chat/pages/ncp-chat-page.tsx src/features/chat/hooks/use-ncp-agent-runtime.test.tsx src/features/chat/hooks/use-ncp-child-session-tabs-view.ts src/features/chat/hooks/use-ncp-session-list-view.ts src/features/chat/utils/ncp-session-adapter.utils.ts src/shared/lib/api/ncp-session.types.ts`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit build`
- `pnpm -C packages/nextclaw-kernel build`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- 真实接口冒烟：`ncp-debug-live-runtime-final-1778775419` 运行中时 `/api/ncp/sessions` 与 `/api/ncp/sessions/:id/messages` 均返回 `status: "running"`；调用 abort 后 messages 接口返回 `status: "idle"`。

## 发布/部署方式

- 未执行发布或部署。
- 本地验证构建了 `@nextclaw/ncp-toolkit` 与 `@nextclaw/kernel`，因为当前 dev serve 消费 workspace package 的 dist 类型/产物。

## 用户/产品视角的验收步骤

- 发送一条消息，让当前会话进入运行中。
- 在 AI 仍运行时刷新页面。
- 页面恢复后，当前会话 summary 应由后端返回 `status: "running"`，输入框显示终止按钮。
- 点击终止按钮后，按当前 `sessionId` abort，接口状态回到 `idle`。

## 可维护性总结汇总

- 状态来源收敛到 live runtime 的 `activeExecution`，持久化 journal 不参与运行态判定，列表接口仍保持读取 summary 的轻路径。
- 本次非测试代码净增为负，正向减债动作是删除前端列表/子 tab 中重复 summary 查表，统一使用适配后的 session view。
- 未新增文件；触达的 `agent-backend` 目录已有文件数预算 warning，但没有继续增加目录文件。

## NPM 包发布记录

- 不涉及即时 NPM 包发布。
- 后续发布需评估 `@nextclaw/ncp-toolkit`、`@nextclaw/kernel`、`@nextclaw/ncp-react` 与 `@nextclaw/ui` 的统一版本批次。
