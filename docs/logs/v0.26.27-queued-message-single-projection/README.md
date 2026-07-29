# v0.26.27 排队消息单一投影修复

## 迭代完成说明

修复 AI 正在回复时追加消息会同时显示在会话记录和待发队列的问题。

根因由端到端证据确认：kernel 的 `SessionRun` 已经拥有权威待发队列，`AgentRunRequestManager` 对排队请求返回 `runId: null`，并且只有该请求真正开始执行时才发布 `message.sent`；但 NCP React 发送 hook 会在请求返回前把所有已有会话消息乐观写入 conversation manager，收到 `runId: null` 后也不撤销，因此同一消息同时被会话时间线和待发队列投影。

修复保留单一事实 owner：权威队列继续归 kernel，正式会话消息继续归 NCP `message.sent` 事件与 conversation manager。发送中的乐观消息改为 hook 的临时展示状态；已知当前 run 活跃时不写入时间线，服务器确认排队时清除临时投影，正式 `message.sent` 落入 manager 后再完成交接。没有新增队列副本、专用事件或兼容分支。

0729 跟进修复了终止当前回复后，排队消息已经自动执行并进入消息流，但输入框上方仍保留旧队列项的问题。kernel 会先从权威队列移除下一项，再发布 `sessionRunQueueUpdated` 并启动该项；前端首次队列读取尚未返回时收到更新事件，React Query 会复用这次旧请求，旧响应随后把已经出队的消息重新写回缓存。修复在队列更新事件到达时先取消过时读取，再精确失效同一会话的队列查询，确保只接受更新后的权威队列结果。

## 测试/验证/验收方式

- 修前同一回归测试稳定失败：后端返回 `runId: null` 后，`visibleMessages` 仍包含待发消息。
- 修后 NCP runtime 定向测试：2 个文件、7 个用例全部通过，覆盖排队阶段不进入时间线、真正启动后只出现一次、已有会话立即展示、后端事件去重、草稿会话 materialize 与发送失败状态。
- 0729 跟进修前回归测试稳定失败：队列更新发生在首次读取返回前时，客户端只调用一次 `listQueuedInputs`，旧响应重新显示已出队消息。
- 0729 跟进修后 UI 队列回归：3 个文件、7 个用例全部通过，覆盖取消过时读取、更新后重新读取空队列，以及会话控制器与 NCP runtime 队列链路。
- kernel 队列回归：1 个文件、3 个用例全部通过，确认终止当前 run 后下一条排队请求会出队并自动开始。
- `pnpm -C packages/ncp-packages/nextclaw-ncp-react tsc`：通过。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/ncp-packages/nextclaw-ncp-react lint`：0 error；2 条 warning 来自未触达的既有附件文件。
- `pnpm -C packages/nextclaw-ui lint`：通过。
- `pnpm --filter @nextclaw/ui... --workspace-concurrency=4 --if-present run build` 与 `pnpm --filter @nextclaw/ui build`：通过，确认 UI 生产构建能够消费修改后的 NCP React 源码及 0729 队列刷新修复。
- `pnpm lint:new-code:governance` 与 `pnpm check:governance-backlog-ratchet`：通过。

## 发布/部署方式

本次只提交并尽量 fast-forward 合入本地 `master`；不 push、不建 PR、不发布 NPM 包、不部署、不执行 migration，也不重启现有 NextClaw 实例。

## 用户/产品视角的验收步骤

1. 在 AI 正在回复时继续发送一条消息，确认它只出现在输入框上方的待发队列，不会同时进入会话记录。
2. 等待当前回复结束，确认待发消息开始执行后才进入会话记录，并且只出现一次。
3. 在 AI 空闲时发送消息，确认消息仍会立即出现在会话中。
4. 模拟发送失败，确认原用户消息仍保留为失败状态。
5. AI 正在回复且存在排队消息时点击终止，确认排队消息自动开始后立即从输入框上方消失，并且消息流中只出现一次。

## 可维护性总结汇总

- 生产代码新增 33 行、删除 36 行、净减 3 行；源码与测试合计新增 65 行、删除 50 行、净增 15 行，增长全部来自两阶段回归测试。
- 正向减债动作是职责收敛与删除：conversation manager 不再承载未被服务器确认进入时间线的乐观消息，删除乐观 ID 集合和会话切换 effect 状态修补。
- 没有新增生产文件、类型、helper、factory、事件通道或队列状态源；组件类型、key、父级结构与状态型 DOM 生命周期均未变化。
- `post-edit-maintainability-guard`：0 error、0 warning；主观复核未发现新增 owner 漂移、抽象膨胀、组件身份或长期维护风险。
- 0729 跟进的生产代码新增 4 行、删除 5 行、净减 1 行；新增 28 行竞态回归测试，未增加状态 owner、fallback 或兼容路径。

## NPM 包发布记录

- `@nextclaw/ncp-react`：需要 patch，修复排队消息错误进入会话时间线，待统一发布。
- `@nextclaw/ui`：需要 patch，随产品 UI 交付排队单一投影与 0729 出队刷新修复，待统一发布。
- 首轮 changeset 已随之后的统一发布消费；0729 跟进 changeset 为 `.changeset/fix-abort-queue-refresh.md`。
- 本次未执行 NPM 发布。
