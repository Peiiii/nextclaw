# v0.26.27 排队消息单一投影修复

## 迭代完成说明

修复 AI 正在回复时追加消息会同时显示在会话记录和待发队列的问题。

根因由端到端证据确认：kernel 的 `SessionRun` 已经拥有权威待发队列，`AgentRunRequestManager` 对排队请求返回 `runId: null`，并且只有该请求真正开始执行时才发布 `message.sent`；但 NCP React 发送 hook 会在请求返回前把所有已有会话消息乐观写入 conversation manager，收到 `runId: null` 后也不撤销，因此同一消息同时被会话时间线和待发队列投影。

修复保留单一事实 owner：权威队列继续归 kernel，正式会话消息继续归 NCP `message.sent` 事件与 conversation manager。发送中的乐观消息改为 hook 的临时展示状态；已知当前 run 活跃时不写入时间线，服务器确认排队时清除临时投影，正式 `message.sent` 落入 manager 后再完成交接。没有新增队列副本、专用事件或兼容分支。

## 测试/验证/验收方式

- 修前同一回归测试稳定失败：后端返回 `runId: null` 后，`visibleMessages` 仍包含待发消息。
- 修后 NCP runtime 定向测试：2 个文件、7 个用例全部通过，覆盖排队阶段不进入时间线、真正启动后只出现一次、已有会话立即展示、后端事件去重、草稿会话 materialize 与发送失败状态。
- `pnpm -C packages/ncp-packages/nextclaw-ncp-react tsc`：通过。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/ncp-packages/nextclaw-ncp-react lint`：0 error；2 条 warning 来自未触达的既有附件文件。
- `pnpm -C packages/nextclaw-ui lint`：通过。
- `pnpm --filter @nextclaw/ui... --workspace-concurrency=4 --if-present run build`：通过，确认 UI 生产构建能够消费修改后的 NCP React 源码。
- `pnpm lint:new-code:governance` 与 `pnpm check:governance-backlog-ratchet`：通过。

## 发布/部署方式

本次只提交并尽量 fast-forward 合入本地 `master`；不 push、不建 PR、不发布 NPM 包、不部署、不执行 migration，也不重启现有 NextClaw 实例。

## 用户/产品视角的验收步骤

1. 在 AI 正在回复时继续发送一条消息，确认它只出现在输入框上方的待发队列，不会同时进入会话记录。
2. 等待当前回复结束，确认待发消息开始执行后才进入会话记录，并且只出现一次。
3. 在 AI 空闲时发送消息，确认消息仍会立即出现在会话中。
4. 模拟发送失败，确认原用户消息仍保留为失败状态。

## 可维护性总结汇总

- 生产代码新增 33 行、删除 36 行、净减 3 行；源码与测试合计新增 65 行、删除 50 行、净增 15 行，增长全部来自两阶段回归测试。
- 正向减债动作是职责收敛与删除：conversation manager 不再承载未被服务器确认进入时间线的乐观消息，删除乐观 ID 集合和会话切换 effect 状态修补。
- 没有新增生产文件、类型、helper、factory、事件通道或队列状态源；组件类型、key、父级结构与状态型 DOM 生命周期均未变化。
- `post-edit-maintainability-guard`：0 error、0 warning；主观复核未发现新增 owner 漂移、抽象膨胀、组件身份或长期维护风险。

## NPM 包发布记录

- `@nextclaw/ncp-react`：需要 patch，修复排队消息错误进入会话时间线，待统一发布。
- `@nextclaw/ui`：需要 patch，随产品 UI 交付修复后的排队展示行为，待统一发布。
- Changeset：`.changeset/fix-queued-message-single-projection.md`。
- 本次未执行 NPM 发布。
