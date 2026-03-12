# v0.13.72-ncp-agent-conversation-state-manager

## 迭代完成说明（改了什么）
- 在 `packages/nextclaw-ncp/src/toolkit/agent/agent-conversation-state-manager.ts` 增加 `DefaultNcpAgentConversationStateManager` 默认实现。
- 实现了 `dispatch(event)` 到各 `handleXxx` 的分发，覆盖 `message.*`、`run.*`、`endpoint.error` 等 agent 场景事件。
- 完成流式会话状态管理：`messages`、`streamingMessage`、`error` 的更新与订阅通知。
- 增加文本流、reasoning 流、tool call 生命周期（start/args/args-delta/end/result）状态聚合逻辑。
- 更新导出入口：`packages/nextclaw-ncp/src/toolkit/agent/index.ts`、`packages/nextclaw-ncp/src/toolkit/index.ts`。
- 新增单元测试文件：`packages/nextclaw-ncp/src/toolkit/agent/agent-conversation-state-manager.test.ts`。
- 为 `@nextclaw/ncp` 增加 `test` 脚本并接入 `vitest` 开发依赖。

## 测试/验证/验收方式
- 包级单元测试：
  - `pnpm -C packages/nextclaw-ncp test`
- 包级静态检查：
  - `pnpm -C packages/nextclaw-ncp lint`
  - `pnpm -C packages/nextclaw-ncp tsc`
- 验证结果：以上命令均通过。

## 发布/部署方式
- 本次为库内实现与测试补齐，不涉及独立部署。
- 如需随版本发布，按仓库既有 NPM 发布流程执行（changeset/version/publish）。

## 用户/产品视角的验收步骤
1. 在集成方创建 `DefaultNcpAgentConversationStateManager` 实例并订阅快照。
2. 连续注入 `message.text-start`、`message.text-delta`、`message.completed` 事件，确认 UI 能先显示流式内容再落为最终消息。
3. 注入 `message.reasoning-*` 与 `message.tool-call-*` 序列，确认同一条 assistant 消息可看到 reasoning 与工具调用状态推进。
4. 注入 `message.failed` 或 `endpoint.error`，确认错误态可被消费并展示。
