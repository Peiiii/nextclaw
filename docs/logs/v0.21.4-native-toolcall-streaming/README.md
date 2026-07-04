# v0.21.4 Native Toolcall Streaming

## 迭代完成说明

本次修复 native agent runtime 在连续多个 toolcall 场景中，前端看到多个工具状态最后一起完成的问题。

根因是 `@nextclaw/ncp-agent-runtime-next` 的执行循环仍沿用整轮收集模式：模型流先完整编码并输出，随后再通过 `DefaultNcpRoundCollector.getToolCalls()` 批量执行工具。因此即使某个 toolcall 的参数已经完整，工具执行结果也必须等整段模型 toolcall 流结束后才能进入 session/UI 事件流。

确认方式：构造两个连续 toolcall，模型在第二个 toolcall 后等待第一个 tool result 才释放 finish。旧链路会卡住或表现为批量完成；新链路中第一个 `message.tool-call-result` 会先于第二个 `message.tool-call-end` 出现。

修复方式：

- `DefaultNcpStreamEncoder` 新增 opt-in 的 `toolCallEndMode: "sequential-index"`，在后续 index 到来且前序参数已是完整 JSON object 时提前发出前序 `MessageToolCallEnd`。
- `DefaultNcpAgentRuntime` 默认启用该模式，并用 `RuntimeToolCallExecutor` 在单个 `MessageToolCallEnd` 到达后立即执行工具。
- `RuntimeToolCallExecutor` 使用 ready 队列串行执行工具：多个完整 toolcall 可以按顺序进入待执行队列，但只有当前工具结果已经 apply/yield 后才会启动下一个工具，避免前端看到多个工具同时完成。
- 工具执行结果通过 runtime 内部队列回流到同一个 session apply/yield 链路，避免 `updateToolCallResult` 只写 session state、不输出给前端。
- 保留原有 `MessageToolCallArgsDelta` 渐进输出合同：工具参数尚未完整、模型 round 尚未结束时，前端仍能收到 partial args delta，而不是等最终工具执行结果。
- `stream-encoder.ts` 重命名为 `stream-encoder.service.ts`，满足 touched source 文件角色后缀治理。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ncp-agent-runtime-next test`
- `pnpm --filter @nextclaw/ncp-agent-runtime-next tsc`
- `pnpm --filter @nextclaw/ncp-agent-runtime-next lint`
- `pnpm --filter @nextclaw/ncp-agent-runtime test`
- `pnpm --filter @nextclaw/ncp-agent-runtime tsc`
- `pnpm --filter @nextclaw/ncp-agent-runtime lint`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`
  - 结果：失败；非测试代码净增 +354，触发非功能 bugfix 行数门槛。见下方可维护性豁免说明。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
  - 结果：通过；warning 为 runtime-next 测试、runtime-next service 文件增长，以及 `stream-encoder.utils.ts` 接近预算。
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `git diff --check`

回归测试新增在 `packages/ncp-packages/nextclaw-ncp-agent-runtime-next/src/runtime/agent-runtime.service.test.ts`，覆盖：

- partial tool args 在模型 round finish 前即可作为 `MessageToolCallArgsDelta` 输出。
- 第一个 ready tool result 可早于后续 toolcall close 事件输出。
- 多个 ready toolcall 按 stream order 串行执行，第二个工具不会在第一个工具结果 apply/yield 前启动。

## 发布/部署方式

本轮未执行发布或部署。改动位于 NCP runtime 源码包，后续若进入统一 NPM 发版，需要纳入 `@nextclaw/ncp-agent-runtime` 与 `@nextclaw/ncp-agent-runtime-next`。

## 用户/产品视角的验收步骤

在 native agent runtime 中触发连续多个 toolcall：

1. 第一个工具调用参数完整后，应先看到该工具进入完成/结果状态。
2. 后续工具调用仍在模型流中继续输出时，前一个工具结果不应等待整批 toolcall 结束后才展示。
3. 多个工具不应表现为最后统一批量执行或统一批量完成。
4. 工具参数仍在生成中时，文件类工具卡片应继续收到渐进参数 delta，不能退化为只在最终结果时更新。

## 可维护性总结汇总

本次是功能性 bugfix，生产代码净增用于表达新的单 toolcall readiness 调度链路。维护性处理：

- 删除 runtime-next 对 `DefaultNcpRoundCollector` 的批量执行依赖，执行触发点回到单个 `MessageToolCallEnd`。
- 新增 `RuntimeToolCallExecutor` owner 承载工具执行队列和结果回流，避免 `DefaultNcpAgentRuntime` 文件越过 maintainability budget，也避免并发执行把多个工具完成状态压到同一帧。
- 将 toolcall buffer mutation 收敛到 `ToolCallDeltaEmitter` owner，普通函数不再直接 mutation 参数。
- 普通 maintainability guard 通过；仍有文件增长 warning，但无 error，且主 runtime service 未越过 600 行预算。

### 行数门槛豁免说明

- 严格非功能门槛结果：非测试代码新增 526 行、删除 172 行、净增 +354 行。
- 必要性：原实现只能在整轮模型输出结束后批量执行工具；要在保持 `MessageToolCallArgsDelta` 渐进展示的同时，让单个 ready toolcall 提前执行并把 `updateToolCallResult` 回流到同一条 session apply/yield 链路，需要显式表达 source stream 与 tool result queue 的并发 drain、abort、错误回流和串行执行状态。
- 已检查的压缩点：没有把 executor 逻辑继续塞回 `DefaultNcpAgentRuntime`；没有用下游 UI 兜底替代 runtime 合同；没有削弱事件类型、ack、abort 或错误路径来压行；`stream-encoder.ts` 改名为 `.service.ts` 只做角色治理，未引入第二套 encoder。
- 为什么不继续压缩：把 ready 队列、结果发布、abort 关闭和错误回流折叠成少数闭包会减少行数，但会让异步时序不可读，并增加再次出现“批量完成/无渐进输出”的风险。
- 后续拆分缝：如果 native runtime 调度继续增长，应把 `RuntimeDrainCursor` 和 runtime source/tool queue drain 继续下切到独立 service，并为 stream encoder readiness 增加专门单测文件，避免 `agent-runtime.service.test.ts` 继续膨胀。

## NPM 包发布记录

本轮不涉及立即 NPM 包发布。若后续统一发版，本次影响包为：

- `@nextclaw/ncp-agent-runtime`
- `@nextclaw/ncp-agent-runtime-next`

当前状态：待统一发布。
