# External Agent Session Framework V1 Design And Execution Plan

**Goal:** 把 NextClaw 从“已经支持多种可插拔 runtime”升级成“拥有统一外部 Agent Session 框架的产品与平台”，并在不被 `acpx` 或任何单一协议反向塑形的前提下，为 `Codex SDK`、`Claude Code SDK`、未来 `acpx/ACP`、以及更后续的协议型 backend 提供统一接入路径。

**Architecture:** 先建立 `session framework`，再接协议/SDK adapter。产品主语始终是 `session`，不是 `sdk`、不是 `protocol`、不是 `backend`。`native`、`codex`、`claude`、未来 `acpx` 都通过同一个会话建模、绑定模型、状态模型和生命周期 contract 接入。v1 先解决最小正确架构，不追求协议终局统一。

**Tech Stack:** TypeScript, NCP packages, NextClaw plugin/runtime registry, Hono UI router, React Query, existing `Codex SDK` / `Claude Agent SDK` runtime adapters

---

## 1. 这份文档回答什么

这份文档不是再做一轮开放讨论，而是给出当前最适合直接执行的完整方案，重点回答：

1. 我们到底在建什么，不建什么。
2. 为什么现在必须先做 `Session Framework`，而不是直接接更多协议。
3. 这套框架的最小正确抽象是什么。
4. 目录结构、包结构、代码组织应该怎样规划。
5. 现有 `native / codex / claude` 应该怎样平滑迁移。
6. `acpx/ACP` 应该在什么位置进入，什么时候进入。
7. 如何用最简单、最可预测的方案落地，避免大而全和抽象膨胀。

这份文档默认作为后续直接执行的主方案文档。

## 2. 一句话结论

**最终建议：先做 `External Agent Session Framework v1`，后做 `acpx/ACP adapter`，不先做“大一统协议层”，不把 NextClaw 做成任何单一 backend 的 UI 壳。**

换句话说，NextClaw v1 应先拥有：

- 自己的 `session` 产品语义
- 自己的 `external session` lifecycle contract
- 自己的 `runtime binding` 数据模型
- 自己的 `capability/status` 观察模型
- 自己的 `read vs probe vs action` 边界

然后再让：

- `Codex SDK`
- `Claude Code SDK`
- `acpx`
- 未来其他 SDK / protocol backend

作为 adapter/backend 接入。

## 3. 为什么这是现在最正确的做法

### 3.1 CEO 视角

如果只继续“多接几个 runtime”，NextClaw 还是一个“支持多个外部能力的产品”。  
如果把这件事做成统一外部 Agent Session 框架，NextClaw 会升级成：

- 一个外部 agent 的产品化托管壳
- 一个 session 级别的 agent orchestration 产品
- 一个能持续吸收外部 runtime 生态、但不被其绑死的基础平台

这决定的是产品天花板，而不是短期功能数。

### 3.2 CTO 视角

现在仓库已经有：

- `native` NCP runtime
- `codex` NCP runtime plugin
- `claude` NCP runtime plugin
- 基于 `session type` 的前端感知和创建能力

这说明“插件化 runtime”已经成立。现在的真正问题不是“能不能接”，而是“缺不缺统一框架层”。

当前核心缺口有三个：

1. `NcpAgentRuntime` 还是 `run()` 型接口，偏“单轮执行器”，不是“会话框架”
2. 插件注册还是 `kind + createRuntime + describeSessionType`，没有会话级 lifecycle contract
3. runtime 私有信息还在直接写顶层 metadata，比如 `codex_thread_id`、`claude_session_id`

如果不先补框架层，接入越多，系统越会向“每个 backend 一套私有逻辑”演进。

### 3.3 产品经理视角

用户真正关心的不是：

- 这是 `SDK runtime`
- 还是 `ACP runtime`
- 还是 `CLI backend`

用户关心的是：

- 我开了什么类型的 session
- 它现在能不能用
- 它是否已经绑定到某个外部会话
- 能不能恢复
- 能不能停止
- 能不能继续
- 为什么现在不可用
- 下一步该点哪里

所以产品主语必须是 `session`。

## 4. 马斯克五步法在这件事上的落地约束

这份方案必须显式受“先质疑、先删除、再简化”的约束，避免做出看起来先进、实际上难以维护的系统。

### Step 1: Challenge Requirements

先质疑所有“看起来应该支持”的东西。

当前必须质疑掉的要求：

- “是不是应该先做 ACP/A2A/XCP 大一统协议层？”
- “是不是要先支持所有外部 agent 类型？”
- “是不是应该先做一套超通用 endpoint 体系？”
- “是不是要一开始就把 `spawn / resume / steer / approval / handoff / subagent` 全部抽象完？”

结论：

- 不需要。
- 这些都是终局讨论，不是 v1 最小正确范围。

### Step 2: Delete

优先删除不必要的目标和层级。

v1 明确删除：

- 通用多端点通信总线终局实现
- 跨所有协议统一的 transport super-layer
- runtime-specific 前端页面
- 过早的 `protocol_driver` 层
- 过早的 `approval / steer / custom command` 核心抽象
- 自动兼容一切旧 metadata 形状的长期双轨方案

### Step 3: Simplify

删完之后，保留最少的核心概念：

- `session_type`
- `runtime_family`
- `backend_id`
- `backend_profile`
- `runtime_binding`
- `capability_manifest`
- `runtime_status`

再多的概念，v1 都不应该进核心层。

### Step 4: Accelerate

只有在完成删除和简化之后，才加快执行。  
加速方式不是“并行抽更多层”，而是：

- 先建立兼容 wrapper
- 先让现有 runtime 跑在新框架壳上
- 先保持 UI 行为尽量不变
- 再逐步替换内部 contract

### Step 5: Automate

只有当 v1 contract 稳定后，才自动化：

- contract tests
- adapter smoke tests
- session metadata schema checks
- plugin registration shape validation

不能在抽象还没定之前，先自动化一堆错误结构。

## 5. Primary Contract 与行为边界

依据 `predictable-behavior-first`，这里必须先把 primary contract 说清楚。

### 5.1 Primary Contract

v1 的 primary contract 不是 `acpx contract`，也不是 `Codex SDK API`。  
v1 的 primary contract 是：

**NextClaw 的统一外部 Agent Session 产品契约。**

它包括：

- session 的创建、恢复、列出、关闭
- session 与 backend 会话之间的绑定
- 运行状态和准备状态的观察
- 明确区分 observation / probe / action

### 5.2 Read vs Probe vs Action

这里必须强制分离：

- `read/observation`
  - 纯读
  - 可自动触发
  - 无副作用
- `probe`
  - 显式探测
  - 可能访问外部系统
  - 不能伪装成 read
- `action`
  - 显式变更
  - 创建/关闭/取消/安装/启用/绑定/外部执行

这直接决定 API 形状和前端可自动调用范围。

### 5.3 v1 禁止的设计

v1 禁止以下设计：

- `GET /api/...` 在内部偷偷创建 runtime 或探测外部 backend
- 页面加载自动触发 capability probe
- 通过 runtime-specific metadata 顶层字段驱动产品逻辑
- 为某个协议或某个事故写一堆特判 fallback
- 把 `acpx` 的字段和术语直接拿来做产品中心术语

## 6. 当前代码状态的关键判断

### 6.1 已经成立的部分

以下基础已经存在，说明我们不是从零开始：

- `NcpAgentRuntime` 与 NCP agent backend 已成立
- `Codex` 与 `Claude` 已能作为可插拔 runtime 暴露给前端
- 前端已通过 `/api/ncp/session-types` 感知 session type
- 插件系统已能注册 NCP runtime

### 6.2 仍然缺失的部分

当前缺的不是“接入点”，而是“统一的会话框架层”：

1. `NcpAgentRuntime` 只表达 `run()`，不表达 session lifecycle
2. runtime registry 只知道“创建 runtime”，不知道“管理 external session”
3. session metadata 缺少统一的 runtime binding 模型
4. `session-types` 的 observation 和 probe 语义还没有彻底分裂
5. UI 还没有面向统一 capability/status contract 编排

## 7. v1 的正式目标

v1 目标必须收敛为下面这句话：

**让 NextClaw 拥有自己的统一 external session framework，并让现有 native/codex/claude 在这个框架内成立。**

v1 完成标准：

1. `native`、`codex`、`claude` 都通过统一 session framework 运行
2. session metadata 使用统一 `runtimeBinding` 结构
3. observation / probe / action 三类 API 明确分离
4. `session type` 的 ready/status/cta 来自统一 descriptor contract
5. 现有 UI 不需要按 runtime id 写业务分支
6. 后续接入 `acpx` 时不需要重做上层会话模型

## 8. v1 的非目标

v1 明确不做：

1. 不做跨所有通信端点的人/邮箱/平台/agent 统一终局协议
2. 不做 `ACP/A2A/XCP` 抽象总线
3. 不做 runtime-specific 产品页面
4. 不做多层 protocol adapter 框架
5. 不做所有外部 session 动作的一次性全抽象
6. 不做一套长期保留的 legacy metadata 双轨兼容层
7. 不做自动探测环境并悄悄修复行为的 fallback 机制

## 9. 推荐术语与统一命名

为避免语义污染，v1 统一采用以下术语。

### 9.1 产品层术语

- `session_type`
  - 用户可见会话类型
  - 例：`native`、`codex`、`claude`

### 9.2 框架层术语

- `runtime_family`
  - 执行族
  - v1 只有：`native`、`external`

- `backend_id`
  - 具体 backend 实现
  - 例：`native`、`codex-sdk`、`claude-code-sdk`、`acpx`

- `backend_profile`
  - 同一 backend 内的目标 runtime/profile
  - 例：`codex`、`claude`、`cursor`

- `runtime_binding`
  - 当前 session 绑定到哪个 backend、哪个外部会话

- `capability_manifest`
  - 当前 session/backend 的能力宣告

- `runtime_status`
  - 当前 session/backend 的运行状态

### 9.3 不再推荐直接作为核心术语的词

- `runtime kind`
  - 现有代码可保留为注册兼容字段，但不再作为上层核心词
- `agent`
  - 保留在既有包名与历史上下文中，但新的 contract 尽量不用它指代 backend/profile/session 三种不同对象

## 10. v1 核心数据模型

### 10.1 Session Runtime Binding

这是 v1 的核心收敛点，必须统一。

```ts
export type NcpSessionRuntimeBinding = {
  sessionType: string;
  runtimeFamily: "native" | "external";
  backendId: string;
  backendProfile?: string | null;
  backendSessionId?: string | null;
  bindingVersion: 1;
};
```

规则：

- 每个 session 最多只有一个当前 binding
- `backendSessionId` 可以为空，表示尚未真正创建外部 session
- `native` 也要有 binding，不能成为特例

### 10.2 Session Capability Manifest

```ts
export type NcpSessionCapabilityManifest = {
  supportsStreaming: boolean;
  supportsResume: boolean;
  supportsAbort: boolean;
  supportsClose: boolean;
  supportsToolCalls: boolean;
  supportsReasoning: boolean;
  supportsAttachments: boolean;
  supportsWorkspace: boolean;
};
```

规则：

- 这是 observation 数据
- 允许前端读取并渲染
- 不应触发外部副作用

### 10.3 Session Runtime Status

```ts
export type NcpSessionRuntimeStatus =
  | { state: "idle" }
  | { state: "ready" }
  | { state: "running"; runId?: string }
  | { state: "blocked"; reason: string; reasonMessage?: string | null }
  | { state: "error"; reason: string; reasonMessage?: string | null }
  | { state: "closed" };
```

规则：

- `ready` 不代表已运行，只代表可以运行
- `blocked` 用于 setup/config 缺失等可恢复场景
- `error` 用于实际错误状态

### 10.4 Session Type Descriptor

当前的 `ChatSessionTypeOptionView` 可以继续存在，但上游必须收敛到统一 descriptor：

```ts
export type NcpSessionTypeDescriptor = {
  value: string;
  label: string;
  ready?: boolean;
  reason?: string | null;
  reasonMessage?: string | null;
  recommendedModel?: string | null;
  supportedModels?: string[];
  cta?: {
    kind: string;
    label?: string;
    href?: string;
  } | null;
  runtimeFamily: "native" | "external";
  backendId: string;
  backendProfile?: string | null;
};
```

## 11. v1 核心接口设计

### 11.1 为什么不能继续只用 `run()`

当前 `NcpAgentRuntime` 只有：

```ts
run(input, options): AsyncIterable<NcpEndpointEvent>
```

这只能表达“一轮执行”，不能表达：

- session 是否已绑定
- 是否能 resume
- 如何 close
- 当前状态是什么
- 外部会话 id 是什么

所以 v1 必须在框架层增加 `session controller` 概念。

### 11.2 新的最小 session controller contract

```ts
export interface NcpSessionController {
  ensureBinding(): Promise<NcpSessionRuntimeBinding>;
  runTurn(
    input: NcpAgentRunInput,
    options?: NcpAgentRunOptions,
  ): AsyncIterable<NcpEndpointEvent>;
  cancelCurrentRun(): Promise<void>;
  getStatus(): Promise<NcpSessionRuntimeStatus>;
  close(): Promise<void>;
  getCapabilityManifest?(): Promise<NcpSessionCapabilityManifest>;
}
```

设计说明：

- `ensureBinding`
  - 负责保证 session 拥有明确 binding
  - 对 external backend 来说，必要时可创建/恢复外部 session
- `runTurn`
  - v1 仍保留 turn-based 运行入口，避免一次引入更复杂的多态接口
- `cancelCurrentRun`
  - 显式动作
- `getStatus`
  - observation
- `close`
  - 显式动作
- `getCapabilityManifest`
  - 可选，缺失时由 registry/session-type descriptor 提供静态能力

### 11.3 兼容旧 runtime 的过渡接口

为了降低 v1 成本，现有只实现 `run()` 的 runtime 不需要立刻全部重写。

新增一个兼容 wrapper：

```ts
export class RunOnlySessionController implements NcpSessionController {
  // 包装旧 NcpAgentRuntime
}
```

它的职责：

- 把旧 `run()` runtime 包装进新的 framework
- 为 `native` 提供零行为变化迁移路径
- 让框架先成立，再逐步迁移每个 backend

这是 v1 最关键的简化策略之一。

## 12. Observation / Probe / Action API 设计

### 12.1 Observation API

纯读、可自动触发、无副作用。

保留/新增：

- `GET /api/ncp/session-types`
  - 只做 observation
  - 不做外部 probe
- `GET /api/ncp/sessions`
- `GET /api/ncp/sessions/:sessionId`
- `GET /api/ncp/sessions/:sessionId/messages`
- `GET /api/ncp/sessions/:sessionId/runtime-status`

### 12.2 Probe API

显式触发，不可由页面默认自动触发。

新增：

- `POST /api/ncp/session-types/:sessionType/probe`
- 可选：`POST /api/ncp/sessions/:sessionId/runtime/probe`

### 12.3 Action API

显式变更路径。

新增：

- `POST /api/ncp/sessions/:sessionId/close`
- `POST /api/ncp/sessions/:sessionId/cancel`

保留：

- session create / delete / patch 等已有动作

### 12.4 禁止行为

以下行为禁止：

- `GET /api/ncp/session-types` 触发 Claude/Codex capability probe
- `status` 路径内部偷偷加载 runtime 或建立外部 session
- 前端 `useQuery` 自动请求触发外部副作用

## 13. 推荐目录与包组织

### 13.1 总原则

不新增新的顶层工作区类别。  
先在现有 `ncp-packages`、`extensions`、`openclaw-compat` 中长出正确层级。

原因：

- 结构已经足够表达这个抽象
- 现在新增顶层分类会放大迁移成本
- v1 最重要的是 contract 和 ownership，不是目录换血

### 13.2 `@nextclaw/ncp`

职责：只放纯 contract/type，不放产品组装，不放插件逻辑。

推荐新增：

```text
packages/ncp-packages/nextclaw-ncp/src/session-contract/
  session-binding.ts
  session-capability.ts
  session-status.ts
  session-controller.ts
  session-type-descriptor.ts
```

推荐修改：

- `packages/ncp-packages/nextclaw-ncp/src/index.ts`
- `packages/ncp-packages/nextclaw-ncp/src/types/index.ts`
- `packages/ncp-packages/nextclaw-ncp/src/types/session.ts`

### 13.3 `@nextclaw/ncp-toolkit`

职责：实现 session framework、registry、backend orchestration、兼容 wrapper。

推荐新增：

```text
packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/session-framework/
  session-controller-factory.ts
  session-runtime-registry.ts
  session-binding-codec.ts
  run-only-session-controller.ts
  session-status-service.ts
  test/fake-session-controller.ts
```

推荐修改：

- `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend/agent-backend-types.ts`
- `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend/agent-live-session-registry.ts`
- `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend/agent-run-executor.ts`
- `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend/agent-backend.ts`
- `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/index.ts`

### 13.4 `@nextclaw/openclaw-compat`

职责：继续做 plugin registration bridge，但不承担 session framework 业务。

推荐新增：

```text
packages/nextclaw-openclaw-compat/src/plugins/ncp-session-runtime-registration.ts
packages/nextclaw-openclaw-compat/src/plugins/ncp-session-runtime-normalizer.ts
```

推荐修改：

- `packages/nextclaw-openclaw-compat/src/plugins/types.ts`
- `packages/nextclaw-openclaw-compat/src/plugins/plugin-capability-registration.ts`
- `packages/nextclaw-openclaw-compat/src/plugins/registry.ts`
- `packages/nextclaw-openclaw-compat/src/plugins/loader.ncp-agent-runtime.test.ts`

### 13.5 `packages/extensions/*`

继续保持两层结构：

- `*-runtime-*`
  - 纯 adapter/runtime 实现
- `*-runtime-plugin-*`
  - 薄注册壳

推荐继续沿用：

```text
packages/extensions/nextclaw-ncp-runtime-codex-sdk/
packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/
packages/extensions/nextclaw-ncp-runtime-claude-code-sdk/
packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/
```

未来新增：

```text
packages/extensions/nextclaw-ncp-runtime-acpx/
packages/extensions/nextclaw-ncp-runtime-plugin-acpx/
```

注意：

- 若 v1 只实现 `acpx`，包名就写 `acpx`
- 不要提前起名 `nextclaw-ncp-runtime-acp`，否则会对未来所有 ACP backend 做过度承诺

### 13.6 `nextclaw-server` 与 `nextclaw-ui`

服务端与前端不拥有 session framework，只消费 descriptor/status/action contract。

推荐修改：

- `packages/nextclaw-server/src/ui/router/ncp-session.controller.ts`
- `packages/nextclaw-server/src/ui/chat-session-type.types.ts`
- `packages/nextclaw-server/src/ui/router.ncp-agent.test.ts`
- `packages/nextclaw-ui/src/api/config.ts`
- `packages/nextclaw-ui/src/api/types.ts`
- `packages/nextclaw-ui/src/hooks/use-ncp-chat-session-types.ts`
- 相关 ChatSidebar / session menu / setup CTA 消费组件

## 14. 插件注册接口的演进

### 14.1 当前形状

当前插件注册形状大致是：

```ts
registerNcpAgentRuntime({
  kind,
  label,
  createRuntime,
  describeSessionType
})
```

这能用，但它混合了：

- session type descriptor
- runtime 构造
- backend 行为能力

### 14.2 v1 推荐形状

保持兼容，但在框架层语义上收敛成：

```ts
registerNcpSessionRuntime({
  sessionType,
  label,
  runtimeFamily,
  backendId,
  backendProfile,
  describeSessionType,
  createSessionController
})
```

### 14.3 迁移策略

v1 不强行一次性改完所有插件 API。  
使用 normalizer 兼容旧接口：

- 旧 `createRuntime`
  - 自动包装为 `RunOnlySessionController`
- 旧 `kind`
  - 暂时映射为 `sessionType`
- 新 plugin
  - 允许直接走 `createSessionController`

这样可以保证：

- 框架先成立
- plugin 逐步迁移
- 不用同步重写所有 runtime

## 15. Session Metadata 迁移方案

### 15.1 当前问题

现在 `codex` 和 `claude` 会把私有字段直接写进 metadata 顶层：

- `session_type`
- `codex_thread_id`
- `claude_session_id`

这会导致：

- metadata 顶层不断被 backend-specific 字段污染
- 后续接入更多 backend 时膨胀不可控
- 上层很难统一读取

### 15.2 v1 统一形状

统一写入：

```ts
metadata.runtimeBinding = {
  sessionType: "codex",
  runtimeFamily: "external",
  backendId: "codex-sdk",
  backendProfile: "codex",
  backendSessionId: "thread_xxx",
  bindingVersion: 1
};
```

配套规则：

- `session_type` 顶层字段进入过渡期，只读不再写新值
- 所有新逻辑优先读取 `runtimeBinding`
- 旧字段读取封装在 codec/normalizer 中

### 15.3 迁移策略

Phase 1:

- 新建 `session-binding-codec`
- 允许同时读旧字段和新字段
- 仅新代码写新字段

Phase 2:

- `codex`、`claude` 改写为只写 `runtimeBinding`

Phase 3:

- 清理直接读取旧顶层字段的消费方

## 16. 现有 runtime 的迁移策略

### 16.1 `native`

策略：

- 不重写核心执行器
- 用 `RunOnlySessionController` 包装现有 `DefaultNcpAgentRuntime`

原因：

- `native` 不是当前复杂点
- 目标是先让 framework 成立
- 不要为了“整齐”重写最稳定路径

### 16.2 `codex`

策略：

- 继续保留现有 runtime adapter
- 将其提升为真正的 `SessionController`
- `ensureBinding` 负责确保 thread 绑定
- `runTurn` 内部调用现有事件映射逻辑
- `getStatus`/`close`/`cancel` 按最小必要补齐

### 16.3 `claude`

策略：

- 与 `codex` 同样迁移
- 统一进入 `runtimeBinding`
- 把 capability probe 继续保留在显式 `probe` 路径

### 16.4 `acpx`

策略：

- 不进入 Phase 1
- 在 `native/codex/claude` 跑稳后进入
- 作为第一个真正验证“协议型 backend 也能装进 session framework”的 backend

## 17. API 与 UI 落地建议

### 17.1 服务端

`NcpSessionRoutesController` 需要新增的能力：

- `getSessionRuntimeStatus`
- `probeSessionType`
- `closeSessionRuntime`
- `cancelSessionRuntime`

并保持：

- `getSessionTypes` 只做 observation

### 17.2 前端

前端只应消费：

- session type descriptors
- runtime status
- CTA
- action availability

前端不应：

- 按 `codex` 或 `claude` 写专有业务分支
- 自己推断 backend 是否 external
- 自动触发 probe

### 17.3 UI 需要的最小新增心智

只增加以下几个通用展示：

- `Ready`
- `Setup Required`
- `Blocked`
- `Running`
- `Closed`

以及通用动作：

- `Probe`
- `Cancel`
- `Close`

不新增 runtime-specific UI 页面。

## 18. 推荐执行阶段

### Phase 0: 术语冻结与 contract 预备

目标：

- 冻结术语
- 冻结 metadata shape
- 冻结 API 边界

**Files:**

- Create: `packages/ncp-packages/nextclaw-ncp/src/session-contract/session-binding.ts`
- Create: `packages/ncp-packages/nextclaw-ncp/src/session-contract/session-status.ts`
- Create: `packages/ncp-packages/nextclaw-ncp/src/session-contract/session-capability.ts`
- Create: `packages/ncp-packages/nextclaw-ncp/src/session-contract/session-controller.ts`
- Modify: `packages/ncp-packages/nextclaw-ncp/src/index.ts`

**Validation:**

- Type-only tests or unit tests for exported types if needed
- `pnpm lint`
- `pnpm tsc -b` for affected packages

### Phase 1: Session Framework 骨架

目标：

- 框架先成立
- 旧 runtime 暂不强制重写

**Files:**

- Create: `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/session-framework/run-only-session-controller.ts`
- Create: `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/session-framework/session-runtime-registry.ts`
- Create: `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/session-framework/session-binding-codec.ts`
- Modify: `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend/agent-backend-types.ts`
- Modify: `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend/agent-live-session-registry.ts`
- Modify: `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend/agent-run-executor.ts`

**Validation:**

- New unit tests for binding codec and run-only controller
- Existing `agent-backend` tests adjusted and passing

### Phase 2: Plugin Registration 演进

目标：

- 新旧注册形状并存
- plugin 层不再承担过多框架语义

**Files:**

- Create: `packages/nextclaw-openclaw-compat/src/plugins/ncp-session-runtime-registration.ts`
- Create: `packages/nextclaw-openclaw-compat/src/plugins/ncp-session-runtime-normalizer.ts`
- Modify: `packages/nextclaw-openclaw-compat/src/plugins/types.ts`
- Modify: `packages/nextclaw-openclaw-compat/src/plugins/plugin-capability-registration.ts`
- Modify: `packages/nextclaw-openclaw-compat/src/plugins/registry.ts`

**Validation:**

- `loader.ncp-agent-runtime.test.ts`
- plugin registration compatibility tests

### Phase 3: `native / codex / claude` 迁移

目标：

- 现有三类 runtime 都纳入统一 framework

**Files:**

- Modify: `packages/extensions/nextclaw-ncp-runtime-codex-sdk/src/index.ts`
- Modify: `packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/index.ts`
- Modify: `packages/extensions/nextclaw-ncp-runtime-claude-code-sdk/src/index.ts`
- Modify: `packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/src/index.ts`

**Validation:**

- Existing codex/claude runtime tests
- New tests for `runtimeBinding` write path
- Smoke: create native/codex/claude session and send one message

### Phase 4: Server/UI 合同对齐

目标：

- API 与 UI 只消费统一 descriptor/status/action contract

**Files:**

- Modify: `packages/nextclaw-server/src/ui/chat-session-type.types.ts`
- Modify: `packages/nextclaw-server/src/ui/router/ncp-session.controller.ts`
- Modify: `packages/nextclaw-server/src/ui/router.ncp-agent.test.ts`
- Modify: `packages/nextclaw-ui/src/api/config.ts`
- Modify: `packages/nextclaw-ui/src/api/types.ts`
- Modify: `packages/nextclaw-ui/src/hooks/use-ncp-chat-session-types.ts`
- Modify: session type and sidebar consumer components

**Validation:**

- Router tests
- UI unit tests
- Manual smoke for session type list, setup CTA, probe, close, cancel

### Phase 5: `acpx` 接入

目标：

- 用协议型 backend 验证 framework 抽象是否成立

前置条件：

- 前 4 个阶段完成
- 不再需要改动上层 session contract

**Files:**

- Create: `packages/extensions/nextclaw-ncp-runtime-acpx/*`
- Create: `packages/extensions/nextclaw-ncp-runtime-plugin-acpx/*`
- Add: plugin tests and smoke tests

## 19. 风险与控制策略

### 风险 1：抽象过早做大

表现：

- 一开始就抽 `protocol_driver`
- 一开始就想覆盖所有 agent 动作

控制：

- v1 核心 contract 只保留五个动作：`ensureBinding / runTurn / cancelCurrentRun / getStatus / close`

### 风险 2：插件层继续承担太多责任

表现：

- 每个 plugin 自己决定 session metadata 形状
- 自己定义状态与 capability 口径

控制：

- plugin 只输出 normalized registration
- metadata 只能通过 framework codec 写

### 风险 3：Read 路径副作用回潮

表现：

- `GET /session-types` 又开始自动 probe
- 前端 query 自动触发外部系统访问

控制：

- 在 router tests 中加入 pure-read 断言
- observation 和 probe 拆接口

### 风险 4：为了兼容保留长期双轨

表现：

- 顶层 metadata 老字段永久保留
- 新旧 session binding 读取逻辑散落各处

控制：

- 所有旧字段兼容都收进 `session-binding-codec`
- migration 完成后清理直接读取旧字段的代码

## 20. 为什么这比“先做 acpx”更好

`acpx-first` 看起来快，但有三个隐患：

1. 产品语义被 `acpx` 反向塑形
2. `Codex/Claude/native` 与未来其他 backend 的统一性无法沉淀为自身资产
3. 如果后面 `acpx` 合同变动，会牵动整个产品层

当前最优做法不是拒绝 `acpx`，而是给它一个正确的位置：

- 它应该成为 `Phase 5` 的 backend adapter
- 它应该验证 framework，而不是定义 framework

## 21. 为什么这比“先做协议总线”更好

`protocol-first` 在理论上更通用，但在当前阶段不划算：

- 真实 consumer 不足
- 会提前把 transport、capability、session、action 四件事耦在一起
- 会让当前最清楚的问题失焦

当前最清楚、最可验证的问题是：

**NextClaw 是否已经拥有统一 external session framework？**

只要这个问题没解决，协议总线就没有坚实 consumer。

## 22. 最终推荐的最小架构图

```text
NextClaw Product Session Layer
  -> session type / list / create / restore / close / CTA / status
  -> consumes

NCP Session Framework Layer
  -> session controller contract
  -> runtime registry
  -> binding codec
  -> status service
  -> compatibility wrapper
  -> consumes

Adapter / Backend Layer
  -> native runtime
  -> codex-sdk runtime
  -> claude-code-sdk runtime
  -> future acpx runtime
```

## 23. 最终执行建议

如果下一步就直接执行，我的建议是：

1. 先做 `Phase 0 + Phase 1`
2. 立刻补 `runtimeBinding` 和 `RunOnlySessionController`
3. 紧接着做 `Phase 2 + Phase 3`
4. 等 `native/codex/claude` 全部进入统一框架后，再做 server/UI contract 对齐
5. 最后用 `acpx` 验证这套框架，而不是反过来让 `acpx` 定义框架

一句话总结：

**先让 NextClaw 拥有自己的会话框架，再让外部协议来适配它。**

## 24. 相关文档

- [External Agent Runtime Framework Design](./2026-03-31-external-agent-runtime-framework-design.md)
- [NCP Pluggable Agent Runtime Plan](./2026-03-19-ncp-pluggable-agent-runtime-plan.md)
- [NCP Native Runtime Refactor Plan](./2026-03-18-ncp-native-runtime-refactor-plan.md)
- [NCP Positioning And Vision](../designs/2026-03-17-ncp-positioning-and-vision.md)
- [Universal Communication Protocol Brainstorm](../designs/2026-03-11-universal-communication-protocol-brainstorm.md)
