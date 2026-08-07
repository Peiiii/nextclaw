# Codex 对齐的自动上下文压缩设计

## 背景

NextClaw 已经具备 Native 会话的自动上下文压缩，但当前实现只在一次 agent run 开始前执行一次 preflight。跨多轮对话时，它会在模型输入达到预算阈值后生成 rolling checkpoint；同一个 run 内如果经过多轮工具调用、工具结果和用户追加输入继续增长，则不会再次压缩，只会由最终 `InputBudgetPruner` 丢弃旧历史或截断边界消息。

这意味着当前能力能保护“长期多轮会话”，但还不能完整保护“单轮长期自治执行”。本轮目标是参考仓库当前依赖的 Codex `0.144.1` 开源实现，把 Native runtime 补齐到 pre-run + mid-run 两阶段自动压缩，同时保留 NextClaw 已有的 append-only timeline、checkpoint 和 runtime ownership 边界。

## 现状依据

### NextClaw Native

- `DefaultNcpAgentRuntime.run()` 在 drain 当前输入后、`run.started` 前只调用一次 `runPreflight`。
- `ContextWindowBudgetService` 默认预留上下文窗口的 20%，最多预留 10K token；达到 `contextTokens - reservedContextTokens` 时触发压缩。
- `ContextCompactionPreflightService` 会把 context blocks、旧 checkpoint summary 和当前消息放进同一个预算面，压缩成功后才持久化 `compressed` checkpoint，失败不会覆盖旧 checkpoint。
- `AgentRunModelInputBuilder` 把 compressed context 放在 leading system，压缩后的 onboarding 模板会被抑制。
- rolling compaction、手动压缩、context-window snapshot 和 timeline marker 已经存在。
- 每个模型 round 都会经过 `InputBudgetPruner`，所以同一 run 内超预算通常不会直接把无限大的输入送给 provider；但这个安全闸会删除旧 tool protocol/history，不能替代语义压缩。

### Codex `rust-v0.144.1`

对照固定版本而不是只看当前 `main`：

- `codex-rs/core/src/session/turn.rs` 在新 turn 记录当前输入前执行 pre-turn compaction，并在每次 sampling 后、仍需 follow-up 且达到 token limit 时执行 mid-turn compaction。
- `codex-rs/protocol/src/openai_models.rs` 默认把自动压缩上限限制在模型上下文窗口的 90%，同时允许更低的显式配置。
- `codex-rs/core/src/compact.rs` / remote compact 实现负责生成 summary、替换有效 history、重算 token usage，并区分 auto/manual、pre-turn/mid-turn 和触发原因。
- app-server 通过 `thread/compact/start` 暴露手动压缩；NextClaw Codex runtime 已直接调用该官方接口，自动压缩继续由 Codex thread owner 自己负责。

官方参考：

- <https://github.com/openai/codex/blob/rust-v0.144.1/codex-rs/core/src/session/turn.rs>
- <https://github.com/openai/codex/blob/rust-v0.144.1/codex-rs/core/src/session/context_window.rs>
- <https://github.com/openai/codex/blob/rust-v0.144.1/codex-rs/core/src/compact.rs>
- <https://github.com/openai/codex/blob/rust-v0.144.1/codex-rs/protocol/src/openai_models.rs>

## 核心判断

当前结论不是“NextClaw 没有自动压缩”，而是：

1. 跨 turn 的 Native 自动压缩已经完成，并且触发点比 Codex 默认 90% 更保守。
2. Codex/runtime-owned 会话已经由 Codex 自己自动压缩，NextClaw 不应做外层二次压缩。
3. Native 单次长期 run 缺少 mid-run compaction；硬裁剪只能保请求可发送，不能保证长期任务语义连续性。
4. mid-run 不能机械地在工具结果后调用现有 pre-run 算法。当前一个 run 的多个 tool round 聚合在同一条 streaming assistant message 中；若只按 timestamp 覆盖整条消息，压缩后新增的 part 也会被永远过滤。

因此真正需要补的是“同一条可增长消息的压缩边界”，而不是第二套摘要算法。

## 推荐方案

### 1. 单一 phase-aware preflight

保留同一个 `runPreflight` hook，增加明确 phase：

- `pre-run`：当前既有行为，在 `run.started` 前检查，压缩失败时不宣称 run 已开始。
- `mid-run`：仅在一次 sampling 完成、工具结果或追加输入使 run 仍需 follow-up 时检查，再进入下一次模型请求。

不在每个 delta/event 上检查，不做后台轮询，也不新增第二个 compaction manager。

### 2. mid-run 压缩覆盖当前有效模型视图

pre-run 继续保留最新当前用户输入为 raw message，确保最新用户意图不只依赖摘要。

mid-run 则压缩当前完整有效模型视图，不保留旧 raw tail；否则同一个长工具循环会持续膨胀，压缩没有实际收益。summary prompt 继续承担 active task、工具结果、证据和下一步的高保真连续性合同。

### 3. 记录可增长 assistant message 的 part 边界

mid-run checkpoint 在已有 v1 合同上增加可选字段：

- `phase: "pre-run" | "mid-run"`
- `continuationMessageId`
- `continuationMessageCoveredPartCount`

它们只在 mid-run 且存在未结束 assistant message 时写入。旧 checkpoint 没有这些字段时继续按既有 timestamp 逻辑读取；这属于持久数据兼容，不形成平行执行路径。

模型输入投影规则：

1. checkpoint summary 仍进入最高优先级 system context。
2. mid-run 增加一条仅存在于 model projection 的 synthetic user continuation，要求继续当前 run，不写入 timeline。
3. 对 continuation message，只投影 checkpoint 后新增的 parts；已进入 summary 的 parts 不重复发送。
4. checkpoint 后新增的其它消息继续按现有时间顺序进入模型输入。

这样同一条 UI assistant message 可以继续聚合，model history 又能在每次 mid-run checkpoint 后只携带新增部分。

### 4. 保留最终硬预算闸

`InputBudgetPruner` 继续作为最终 provider 请求的硬安全闸，但不再承担长期连续性 owner。即使摘要本身异常偏长或单个工具结果超大，请求仍必须保持在预算内。

### 5. 失败与重试

- summary provider 成功后才 patch metadata 和发 timeline event，继续保持失败原子性。
- mid-run 压缩失败时结束当前 run 并暴露错误，不带旧 checkpoint 污染重试。
- 本轮不复制 Codex model client 的通用网络重试。NextClaw provider 层目前没有稳定的 typed transient error 合同；对所有错误盲重试会把鉴权、配额和配置错误变成隐藏重复调用。后续若 provider owner 提供类型化 retry policy，再由 provider 边界统一承接。

## Owner 与数据流

```text
DefaultNcpAgentRuntime
  ├─ pre-run follow-up boundary
  └─ mid-run follow-up boundary
        ↓ phase
AgentRunContextCompactionManager
        ↓
ContextCompactionPreflightService
  ├─ budget / current projection
  ├─ active streaming part boundary
  └─ summary generation + atomic checkpoint
        ↓
context-compaction.utils
  ├─ summary projection
  ├─ synthetic continuation
  └─ post-checkpoint message/part projection
        ↓
AgentRunModelInputBuilder
        ↓
InputBudgetPruner final safety gate
```

职责依据：

- runtime 是 follow-up 生命周期的 `information expert`，只负责何时触发。
- preflight/manager 是压缩动作与持久化的完整 owner。
- projection utils 只做无状态 checkpoint view 变换。
- builder 不产生 checkpoint，也不写会话。

## 目录组织

不新增 manager/service/utils 文件。现有文件角色已经与职责匹配：

- runtime loop：`nextclaw-ncp-agent-runtime-next/src/runtime/agent-runtime.service.ts`
- core 压缩计划：`nextclaw-core/.../context-compaction.service.ts`
- kernel 编排：`context-compaction-preflight.service.ts`、`agent-run-context-compaction.manager.ts`
- 无状态投影：`context-compaction.utils.ts`
- contribution `index.ts` 只继续做 Native runtime 装配。

排除新建 `MidRunCompactionManager`、adapter、factory 或 retry wrapper：这些名字不会形成新 owner，只会拉长现有主链路。

## 兼容与迁移

- 旧 v1 checkpoint：继续按 `coveredUntil` 投影，不要求迁移。
- 新 pre-run checkpoint：可写 `phase=pre-run`，行为与当前一致。
- 新 mid-run checkpoint：使用 continuation message part boundary。
- Native 之外的 runtime：不调用 NextClaw preflight；Codex 继续由自己的 thread owner 自动压缩。
- timeline 与原始 session messages 保持 append-only，不删除用户历史。

## 验收标准

### 修前基线

- 构造两次模型 sampling 的 Native run：第一轮产生 tool call/result，第二轮继续。
- 观察当前 `runPreflight` 只调用一次；这证明缺口在 runtime follow-up 边界，而不是 summary 或 UI。

### 确定性测试

- runtime：首次调用 phase 为 `pre-run`；tool follow-up 前再次调用 `mid-run`；普通一次性回复不触发 mid-run。
- core：pre-run 保留最新输入；mid-run 覆盖完整 conversation 并返回无 raw tail 的 projected estimate。
- preflight：mid-run checkpoint 记录 active assistant part boundary；失败不持久化。
- projection：旧 parts 被 summary 覆盖，同 message 新增 parts 仍进入下一次模型输入；synthetic continuation 不进入 timeline。
- rolling：已有 mid-run checkpoint 再次超窗时，新 summary source 包含旧 summary和 checkpoint 后新增 parts。
- builder：summary 位于 leading system，continuation 和新增 tool/text parts 顺序有效。

### 工程验证

- `@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/ncp-agent-runtime-next` 定向测试。
- 三个 package 的 `tsc`。
- 所有触达 TypeScript 文件的 targeted ESLint。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、maintainability guard。

### 真实链路 smoke

- 隔离 `NEXTCLAW_HOME`，使用 Native runtime 和较小 context window。
- 让同一 run 连续执行多个会产生较大结果的工具调用。
- 观察一个 run 内出现 `context_compaction` marker，之后仍继续工具/模型 round 并正常 `run.finished`。
- 检查 checkpoint 为 `mid-run`，后续模型输入不含已覆盖 raw parts，最终回复仍能引用压缩前任务目标和最新工具结果。

## 非目标

- 不改变 Codex、Claude Code、Hermes 等 runtime-owned 上下文管理。
- 不新增远程 compaction 服务。
- 不把 agent `contextTokens` 改造成模型 catalog 系统。
- 不改 UI 展示或新增压缩设置项。
- 不用 blanket retry、错误字符串识别或静默 fallback 模仿 Codex 的 model-client 重试。

## 后续实现顺序

1. 先加 runtime 修前失败测试，锁定 mid-run 缺口。
2. 扩展 phase 和 mid-run plan 合同。
3. 增加 continuation message part boundary 与 model-only continuation projection。
4. 补 rolling、失败原子性和 builder 测试。
5. 跑真实 Native 长工具循环 smoke，再完成类型、治理和可维护性收尾。
