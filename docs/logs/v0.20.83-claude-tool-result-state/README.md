# v0.20.83 Claude Tool Result State

## 迭代完成说明

本次修复 Claude Code 类型 NCP 会话里，工具调用实际已经返回结果，但 chat 消息接口和前端工具卡片仍全部显示“执行中”的问题。

根因分为两层：

- NARP stdio runtime 的 `message.completed` 由本地重复 collector 构造，该 collector 只看到了工具调用开始事件，没有消费 `message.tool-call-result`，所以原始完成事件里的 `tool-invocation` 仍停留在 `state: "call"`。
- kernel journal 回放会把历史 `message.completed` 转成 `message.sent` 参与 materialization，导致已记录过的 `message.tool-call-result` 被后来的 stale completed snapshot 覆盖，历史会话重新读取时继续丢失 result 状态。

确认方式：

- 通过本地接口复现 `ncp-mqia441a-e75af646`，`/api/ncp/sessions/:id/messages` 中 12 个工具调用全部为 `state: "call"`，但同一 journal 里已有 12 个 `message.tool-call-result`。
- 对照 Claude raw transcript，确认上游确实产出了 `tool_result`，不是 Claude runtime 没执行工具。
- 新建 Claude smoke 会话后确认旧实现的 raw journal `message.completed` 仍是 `state: "call"`，因此源头不只在 UI。

修复方式：

- stdio runtime 删除重复 `PromptUpdateCollector`，改为由 `DefaultNcpAgentConversationStateManager` 作为单一会话 materialization owner 构造 completed assistant message。
- runtime 发送每个 NCP event 时同步 dispatch 到 conversation state manager，让 `message.completed` 直接来自已包含 tool result 的状态快照。
- kernel journal replay 记录前序 `message.tool-call-result`，在回放 stale `message.completed` snapshot 前补齐对应 tool part 的 `state: "result"`、`result` 与 `resultContentItems`，兼容历史坏 journal。
- 为历史 replay 降级和 stdio completed event 增加定向测试。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/kernel tsc`
- `pnpm --filter @nextclaw/kernel test -- --run src/stores/ncp-agent-session-journal.store.test.ts`
- `pnpm --filter @nextclaw/kernel lint`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client tsc`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client test -- --run src/stdio-runtime.test.ts`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-kernel/src/utils/ncp-agent-session-journal.utils.ts packages/nextclaw-kernel/src/stores/ncp-agent-session-journal.store.test.ts packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.service.ts packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.test.ts packages/nextclaw-ncp-runtime-stdio-client/package.json pnpm-lock.yaml`
- 接口复验历史会话：`ncp-mqia441a-e75af646` 的 12 个工具调用均 materialize 为 `state: "result"`。
- Claude runtime smoke：新会话发起一次真实 Bash 工具调用，确认 messages API 返回工具 `result`，raw journal 的 `message.completed` 也带 `state: "result"`。

## 发布/部署方式

本次未执行发布或部署。修复需要随下一次 NPM 批次发布进入运行态包。

## 用户/产品视角的验收步骤

1. 运行本地源码 dev 服务。
2. 打开 Claude Code 类型会话，例如 `http://127.0.0.1:5174/chat/sid_bmNwLW1xaWE0NDFhLWU3NWFmNjQ2`。
3. 查看已完成 assistant 消息中的工具卡片。
4. 预期工具调用显示为完成结果，不再全部停留在“执行中”。
5. 新发一条会触发工具调用的 Claude 消息，完成后刷新页面，预期工具状态仍保持完成。

## 可维护性总结汇总

本次是用户可见 bugfix，但按非新增能力标准收口。核心减债动作是删除 stdio runtime 内部重复 collector，并把会话 materialization 收敛到 `DefaultNcpAgentConversationStateManager` 单一 owner。

代码增减报告：

- 总代码增减：新增 177 行，删除 131 行，净增 +46 行。
- 非测试代码增减：新增 67 行，删除 129 行，净增 -62 行。

正向减债动作：

- 删除：移除重复 `PromptUpdateCollector`。
- 职责收敛：completed assistant message 改由已有 conversation state manager 构造。
- 可预测行为：历史 journal replay 不再让 stale completed snapshot 覆盖已存在的 tool result 事实。

可维护性风险：

- `packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.service.ts` 仍超过文件预算，但本次从 962 行降到 861 行，后续拆分缝是继续抽离 orchestration、IO 和 state transition。
- `packages/nextclaw-kernel/src/utils/ncp-agent-session-journal.utils.ts` 接近 400 行预算，后续如果继续增长，应拆出 replay materialization 辅助模块。
- 本次已使用 post-edit maintainability guard/review，当前检查无阻塞项。

## NPM 包发布记录

需要随下一次 NPM 发布进入以下包，当前状态为待统一发布：

- `@nextclaw/kernel`：历史 session journal replay 兼容 stale completed snapshot，避免 tool result 被回放覆盖。
- `@nextclaw/nextclaw-ncp-runtime-stdio-client`：stdio runtime completed event 由 conversation state manager 构造，保证 raw journal 源头包含 tool result。

已添加 `.changeset/claude-tool-result-state.md`。
