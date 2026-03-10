# v0.13.34 Chat Stop Backend Hard Stop

## 迭代完成说明（改了什么）

- 面向 `native` 场景修复“点击终止仅停止前端流，后端 run 仍继续执行”的问题。
- 前端 stop 请求链路增强（`packages/nextclaw-ui/src/components/chat/chat-stream/transport.ts`）：
  - stop 请求改为只依赖 `runId`，避免 `sessionKey` 误匹配导致 no-op。
  - 当本地尚未拿到 `ready.runId` 时，按会话短轮询 `queued/running` run 并重试终止。
  - stop 返回 `stopped=false` 时自动继续尝试候选 run，提升真实终止成功率。
- 后端能力判定与引擎中断语义对齐：
  - `AgentEngine` 增加 `supportsAbort` 能力声明；`native` 显式 `supportsAbort=true`。
  - `runtimePool.supportsTurnAbort` 改为基于 `engine.supportsAbort` 判定，而非“仅 native”。
- 引擎实现补齐（为后续非 native 一致性做准备）：
  - `codex-sdk` 将 `abortSignal` 透传到 `runStreamed(..., { signal })`。
  - `claude-agent-sdk` 将外部 `abortSignal` 桥接到内部 `abortController`，并在 aborted 时抛出 `AbortError`。

## 测试/验证/验收方式

- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-engine-plugin-codex-sdk tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-engine-plugin-claude-agent-sdk tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
- lint/build（按影响包执行）：
  - `nextclaw-core`/`nextclaw`/两个引擎插件：`lint`、`build` 均通过（仅既有 warning，无新增 error）。
  - `nextclaw-ui`：`build` 通过；`lint` 存在仓库既有 `ChatConversationPanel.tsx` React Compiler 规则错误（与本次改动无关）。
- 单测：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw test src/cli/commands/agent-runtime-pool.command.test.ts`
  - 结果：5/5 通过（含新增 stop capability 判定用例）。
- 不适用说明：
  - 未执行端到端 UI 自动化（仓库当前无现成 stop e2e 脚本）；本轮以受影响包编译、构建、单测和本地 run 快照检查作为最小充分验证。

## 发布/部署方式

- 本次涉及前端与 CLI/runtime 代码，不涉及数据库变更，无需 migration。
- 若发布前端可见修复，按项目流程执行 `/release-frontend`；若需完整 CLI 发布，按 changeset/version/publish 流程执行。

## 用户/产品视角的验收步骤

1. 在 Chat（native 会话）发送一条会触发较长回复的消息。
2. 在回复进行中点击终止（包含“刚开始就点”的场景）。
3. 预期：
   - 流式输出停止后，不会在刷新后继续增长；
   - 会话列表的 run 状态从 running 退出，不再持续转圈；
   - `~/.nextclaw/runs/<runId>.json` 的对应 run 最终应为 `aborted`（而非继续 `completed`）。
