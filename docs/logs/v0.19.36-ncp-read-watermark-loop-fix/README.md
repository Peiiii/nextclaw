# v0.19.36 NCP Read Watermark Loop Fix

## 迭代完成说明

本次修复 NCP 会话流式输出期间前端反复 `PUT /api/ncp/sessions/:id` 写入 `uiReadAt` 的问题。

根因：NCP 会话 summary 的 `lastMessageAt` 在重建时会读取最后一条消息时间；流式输出期间最后一条 assistant 消息仍处于 `streaming` 状态，其时间戳会随流式事件推进，导致前端把当前打开的会话持续判断为“有新内容未读”，从而不断持久化新的 `uiReadAt`。

确认方式：沿 `ChatSidebar` / `ChatSessionWorkspacePanel` 的 readAt 写入 effect，追踪到 `updateNcpSession({ uiReadAt })` 与后端 `ui_last_read_at` 映射，再检查 NCP session journal summary 重建逻辑。修复目标落在根因层：summary 的 `lastMessageAt` 只采用 durable `final` 消息时间，前端在运行态不持久化已读水位，等运行结束后再落一次稳定水位。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/kernel test -- ncp-agent-session-journal.store.test.ts`
- `pnpm --filter @nextclaw/ui test -- chat-sidebar-read-state.test.tsx chat-sidebar.test.tsx`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/kernel exec eslint src/utils/ncp-agent-session-journal.utils.ts src/stores/ncp-agent-session-journal.store.test.ts`
- `pnpm --filter @nextclaw/ui exec eslint src/features/chat/components/layout/chat-sidebar.tsx src/features/chat/components/layout/chat-sidebar-read-state.test.tsx src/features/chat/components/chat-session-workspace-panel.tsx`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
- `pnpm check:governance-backlog-ratchet`

以下项目级验证被当前工作区已有的 tool-provider/runtime 改动阻塞，和本次 readAt 修复触达文件无关：

- `pnpm --filter @nextclaw/kernel tsc`：阻塞于 `NcpToolExecutionContext` 导出缺失，以及 `agent-runtime.service.ts` / `tool-registry.ts` 参数签名不匹配。
- `pnpm lint:new-code:governance`：阻塞于 `packages/ncp-packages/nextclaw-ncp-agent-runtime/src/runtime/tool-registry.ts` 与 `packages/ncp-packages/nextclaw-ncp/src/agent-runtime/tool.ts` 的既有命名治理问题。
- `pnpm --filter @nextclaw/ui lint`：阻塞于既有 UI lint backlog，例如未使用导入、`import()` 类型标注、refs during render 与历史复杂度 warning；本次触达文件的定向 ESLint 已通过。

未使用浏览器复现；本次按用户要求只通过代码链路、单元测试、类型检查和静态检查验证。

## 发布/部署方式

本次仅修改本地源码与测试，不涉及部署。若进入发布批次，随 NextClaw 常规前端/桌面发布流程带出。

## 用户/产品视角的验收步骤

1. 打开一个 NCP chat session。
2. 在 assistant 流式输出期间观察 network。
3. 预期：不会因为流式 token 更新而持续每秒级 `PUT /api/ncp/sessions/:id` 写入 `uiReadAt`。
4. 流式输出完成后，会话已读水位可以更新到最终稳定消息时间，未读提醒语义保持正常。

## 可维护性总结汇总

已按非功能修复控制生产代码净增为 0。后端将 `lastMessageAt` 的语义收敛为“最后一条 final 消息时间”，前端将 readAt 持久化收敛到非运行态，避免把流式 UI 更新当作已读状态写入触发器。

本次可维护性收益来自简化语义边界：稳定 summary 时间归后端 durable message owner，前端只在稳定态写 read watermark，没有新增平行轮询、节流器或临时防抖链路。已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 做收尾评估。

## NPM 包发布记录

不涉及 NPM 包发布。
