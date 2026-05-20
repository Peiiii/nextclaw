# Agent Run Request Manager Refactor

## 背景

这次改造服务于 NextClaw 的“统一入口”和“能力编排”主线：用户发起一个 Agent run 请求时，系统应该有一个清晰、稳定、可治理的请求入口，而不是让 HTTP adapter、deferred service、AgentRuntimeManager、NCP backend 各自承担一段不成体系的业务职责。

当前 `AgentRuntimeManager` 的名字和实际职责已经错位。它本应是 agent runtime 的管理容器，负责 runtime provider 注册、配置刷新、runtime 解析和生命周期装配；但现在它还承担了 send envelope materialization、HTTP send 兼容 endpoint、ingress session message handler、backend event 转发等请求处理职责。

这份方案替代 `docs/designs/2026-05-14-chat-session-materialization-design.md` 中“由 AgentRuntimeManager 负责 materialization”的 ownership 判断。严格 backend contract 仍然正确，但 materialization 的 owner 应该上移到 Agent run request 领域，而不是继续塞在 runtime manager 里。

## 当前有效链路

### HTTP send

```text
frontend
  -> POST /api/ncp/agent/send
  -> NcpHttpAgentController.handleSend
  -> UiNcpAgent.agentClientEndpoint.send
  -> ServiceDeferredNcpAgent.activeAgent.agentClientEndpoint.send
  -> AgentRuntimeManager.createMaterializingAgentClientEndpoint(...).send
  -> AgentRuntimeManager.materializeAgentSendEnvelope(...)
  -> DefaultNcpAgentBackend.send(materializedRequest)
```

问题是：HTTP send 进入的是 `agentClientEndpoint` 这个协议适配面，但 NextClaw 产品层真正需要的是“处理一次 Agent run 请求”。因此请求 materialization 被迫写进 `AgentRuntimeManager` 的临时 endpoint wrapper。

### session request ingress

```text
SessionRequestDispatcher
  -> ingress.handle(agent-runtime.session-message.request)
  -> AgentRuntimeManager.handleSessionMessageRequest
  -> DefaultNcpAgentBackend.send(materialized existing-session request)
  -> backend emits NCP events
  -> dispatcher waits on eventKeys.ncpEvent
```

这里的 ingress 不是只出不进；`Ingress.handle(...)` 本身支持返回 `Promise<TResult>`。只是当前这个 key 的 handler 返回 `void`，最终回复通过 NCP event correlation 获得。

### runtime execution

```text
DefaultNcpAgentBackend
  -> AgentLiveSessionRegistry.ensureSession(...)
  -> createRuntime(runtimeParams)
  -> AgentRuntimeRegistry.createRuntime(...)
  -> concrete runtime
```

这里要特别谨慎：`DefaultNcpAgentBackend` 目前不只是“backend”。它还拥有 live session registry、runtime state manager、event normalization、stream、abort、session persistence、tool result update、run status、context window preview 等执行不变量。不能在第一阶段简单绕过它。

## 设计问题

当前设计主要违反这些原则：

- `single-domain-owner`：Agent run request 处理没有独立 owner，被塞到 runtime manager 和 HTTP adapter 中。
- `information-expert`：创建会话、补全 `sessionId`、从 metadata 生成 session 字段，是 request materialization 领域，不是 runtime registry 领域。
- `complete-owner`：`AgentRuntimeManager` 不是完整 request owner，却在处理 request 前置步骤。
- `responsibility-surface-minimization`：外层通过 `agentClientEndpoint` 进入 NextClaw 产品请求链路，暴露了偏协议的接口形状。
- `deletion-first`：正确方向不是再加一个 backend wrapper，而是删除 `createMaterializingAgentClientEndpoint` 这类过渡职责。

## 目标边界

### AgentRunRequestManager

`AgentRunRequestManager` 是 kernel 上的顶层 manager，负责 Agent run 请求链路。

它应该负责：

- 接收产品层的 raw send request，包括无 `sessionId` 的新会话请求。
- 创建或识别 session。
- 把 `NcpAgentSendEnvelope` materialize 成严格的 `NcpRequestEnvelope`。
- 维护 request correlation，例如 `correlationId/requestId` 与最终 event 的对应关系。
- 暴露直接的处理方法，例如 `send(...)`、`sendToSession(...)`、`abort(...)`，供 HTTP route、session request、未来 ingress handler 调用。
- 在过渡阶段通过 `AgentRuntimeManager` 进入当前执行链路，而不是直接持有 `DefaultNcpAgentBackend`。

它不应该负责：

- 注册 runtime provider。
- 读取 runtime 配置并维护 runtime registry。
- 感知具体 NARP/Hermes/native runtime 的创建细节。
- 直接持有或暴露 `DefaultNcpAgentBackend`。
- 做 generic NCP HTTP adapter 的协议解析。

### AgentRuntimeManager

`AgentRuntimeManager` 收敛为 runtime 管理容器。

它应该负责：

- 注册 runtime provider。
- 刷新 config 中的 runtime entries。
- 解析一次 request 应该使用哪个 runtime。
- 创建 runtime 所需的执行对象或执行上下文。
- 管理 runtime/backend 执行基础设施的 start/stop/dispose。

它不应该负责：

- 从 raw user request 创建 NextClaw session。
- 为 HTTP send 包一层 materializing endpoint。
- 订阅 Agent run request ingress 并处理用户消息。
- 把 request 领域逻辑藏进 `AgentRuntimeHandle.agentClientEndpoint`。

目标上的直观 API 可以是：

```ts
const runtime = agentRuntimeManager.resolveRuntime(requestEnvelope);
```

但实现时要承认当前 runtime 创建并不是只靠 `requestEnvelope` 就能安全完成。今天 backend 会同时准备 live session、state manager、session metadata updater、abort controller、persistence、event stream 等上下文。因此第一阶段可以先保留执行基础设施，由 `AgentRuntimeManager` 暴露一个不泄漏 backend 的执行入口；等这些上下文被明确建模后，再把 `resolveRuntime(requestEnvelope)` 落成真正的 runtime 解析 API。

### DefaultNcpAgentBackend

短期内它仍然是执行基础设施，不能直接删掉或绕过。

长期目标有两个可选方向：

- 保留为 toolkit 内部的 generic execution engine，但 NextClaw kernel 不把它当作产品 request owner。
- 拆出 live session / realtime / persistence / executor 等更小 owner，让 `AgentRunRequestManager -> AgentRuntimeManager.resolveRuntime(...) -> runtime.run(...)` 成为主链路。

无论选择哪条路，`DefaultNcpAgentBackend` 都不应该继续成为上层产品请求入口的名字和概念中心。

## 推荐改造路径

### 阶段一：先抽出 request owner，不绕过执行基础设施

新增 kernel 级 `AgentRunRequestManager`。

第一阶段它做三件事：

1. 接管 `materializeAgentSendEnvelope(...)` 及其 helper。
2. 接管 `handleSessionMessageRequest(...)` 这类 existing-session request 处理。
3. 通过 `AgentRuntimeManager` 发起 materialized request，`AgentRuntimeManager` 内部仍可暂时委托当前 backend 执行。

这一阶段应该删除：

- `AgentRuntimeManager.createMaterializingAgentClientEndpoint(...)`
- `AgentRuntimeManager.materializeAgentSendEnvelope(...)`
- `AgentRuntimeManager.handleSessionMessageRequest(...)`
- `AgentRuntimeManager` 对 `ingressKeys.agentRuntime.sessionMessageRequest` 的直接订阅

阶段一的关键约束：

- `AgentRunRequestManager` 不直接拿 `DefaultNcpAgentBackend`。
- `AgentRuntimeManager` 可以保留 backend 字段作为内部执行基础设施，但对外暴露的是明确业务方法，例如执行已 materialize 的 run request。
- 不新建 `RuntimeToolRegistry`、`ToolProvider`、`AgentRuntimeRequestService` 这类无必要中间抽象。

### 阶段二：让 HTTP send 走 manager 直接 API

把 NextClaw 产品层的 HTTP send 链路从 `agentClientEndpoint.send` 切到 `AgentRunRequestManager.send`。

目标链路：

```text
frontend
  -> POST /api/ncp/agent/send
  -> NextClaw agent send route/controller
  -> kernel.agentRunRequestManager.send(envelope)
  -> kernel.agentRuntimeManager.executeMaterializedRun(...)
```

`ncp-http-agent-server` 作为 generic protocol package 可以暂时保留 `agentClientEndpoint` contract；但 NextClaw 自己的产品 send route 不应该长期被这个 generic adapter 反向决定内部 owner。

这一阶段再评估：

- `ServiceDeferredNcpAgent` 是否仍需要作为 active handle proxy。
- `AgentRuntimeHandle.agentClientEndpoint` 是否只是外部兼容字段。
- `UiNcpAgent` 类型是否应该改成暴露 `agentRunRequests`，而不是只暴露 `agentClientEndpoint`。

### 阶段三：重新设计 ingress 入口

当 manager 直接 API 稳定后，再把 ingress 从旧 key 收敛到 Agent run request 领域。

建议的新 key 语义：

```text
agent.run.send
agent.run.session-message
agent.run.abort
```

取舍：

- kernel 内部强依赖对象图的调用，优先直接调用 `kernel.agentRunRequestManager.send(...)`，简单、清晰、可测试。
- 跨 owner、extension、channel 或外部来源的请求，使用 ingress 发布请求，由 `AgentRunRequestManager` 订阅并执行。
- 不用 ingress 代替所有直接方法调用；ingress 是边界解耦工具，不是 manager 内部 API 的替身。

### 阶段四：再拆 backend 执行不变量

只有当前三类入口都收敛后，才拆 `DefaultNcpAgentBackend`。

需要先显式建模的能力包括：

- live session registry
- runtime state manager
- session metadata read/write
- event normalization
- session realtime stream
- abort lifecycle
- session persistence
- tool call result update
- context window preview
- run status event

完成这一步后，才适合把主链路推进到更直观的形态：

```ts
const requestEnvelope = agentRunRequestManager.materialize(envelope);
const runtime = agentRuntimeManager.resolveRuntime(requestEnvelope);
return agentRunRequestManager.execute(runtime, requestEnvelope);
```

或者如果执行上下文必须和 runtime 一起返回，也可以收敛成：

```ts
const execution = agentRuntimeManager.resolveRuntimeExecution(requestEnvelope);
return agentRunRequestManager.execute(execution, requestEnvelope);
```

这不是增加抽象，而是避免把 backend 现在隐式维护的不变量丢掉。

## 命名建议

推荐：

- `AgentRunRequestManager`
- `agentRunRequestManager`
- `send(...)`
- `sendToSession(...)`
- `abort(...)`
- `materializeSendEnvelope(...)`
- `executeMaterializedRun(...)`
- `resolveRuntime(...)`
- `resolveRuntimeExecution(...)`

避免：

- `AgentRuntimeRequestService`
- `AgentRuntimeRequestEndpoint`
- `ToolProvider`
- `RuntimeToolRegistry`
- `install`
- 任何只包装一个转发方法的 `BackendGateway/BackendOwner/RuntimeRequestBridge`

## 删除清单

本次改造应该以删除旧入口为验收条件，而不是只把新 manager 接上。

优先删除：

- `AgentRuntimeManager.createMaterializingAgentClientEndpoint`
- `AgentRuntimeManager.materializeAgentSendEnvelope`
- `AgentRuntimeManager.handleSessionMessageRequest`
- `AgentRuntimeManager.unsubscribeAgentRuntimeRequestIngress`
- `AgentRuntimeHandle` 对 `agentClientEndpoint` 的主路径依赖
- `ServiceDeferredNcpAgent` 中只为转发 active handle endpoint 而存在的逻辑

暂不直接删除：

- `createAgentClientFromServer(...)`，它是 generic NCP toolkit adapter，是否删除要看 toolkit 外部契约。
- `DefaultNcpAgentBackend`，它当前仍是执行不变量 owner。
- `NcpHttpAgentController` 的 generic contract，除非决定同步修改 NCP HTTP package 的公共协议。

## 风险

最大风险不是代码迁移量，而是误删执行语义。

如果第一阶段直接让 `AgentRunRequestManager` 拿到 runtime 并调用 runtime，可能会丢掉：

- live session 恢复与缓存
- state manager 初始化
- session metadata 更新
- message accepted/completed/failed event normalization
- SSE stream 与 session realtime
- abort controller 生命周期
- session snapshot 和 append-only event persistence
- context window preflight
- tool result update 入口

所以推荐路径是：先改 owner 和入口，再拆执行内核。

## 验收标准

阶段一完成后：

- `AgentRuntimeManager` 不再创建 materializing agent client endpoint。
- `AgentRuntimeManager` 不再订阅 Agent run request ingress。
- `AgentRuntimeManager` 不再创建 NextClaw session。
- raw send envelope 到 strict request envelope 的转换只存在于 `AgentRunRequestManager`。
- existing-session request 也由 `AgentRunRequestManager` 处理。
- HTTP send 行为保持不变：无 `sessionId` 的 root chat send 仍会创建真实 session。

阶段二完成后：

- NextClaw 产品 HTTP send 主路径调用 `AgentRunRequestManager.send(...)`。
- `agentClientEndpoint` 不再是产品 send 主路径的 owner。
- generic NCP HTTP adapter 是否保留由公共 contract 决定，而不是为了 NextClaw 内部链路继续保留。

阶段三完成后：

- ingress key 语义从 `agent-runtime.*` 收敛到 `agent.run.*`。
- session request dispatcher 不再引用 runtime manager 语义。

阶段四完成后：

- `AgentRuntimeManager.resolveRuntime(requestEnvelope)` 或等价 runtime execution API 成为真实主链路。
- backend 的剩余职责有明确名字和 owner；如果没有剩余必要性，则删除。

## 验证计划

至少覆盖：

- `pnpm --filter @nextclaw/kernel tsc`
- `pnpm --filter @nextclaw/service tsc`
- `pnpm --filter @nextclaw/server tsc`
- `pnpm --filter @nextclaw/ncp-http-agent-server test`
- 与 agent backend / in-memory backend 相关的 toolkit 测试
- `service-deferred-ncp-agent` tests
- `service-ncp-agent-send-http-contract` tests
- `router.ncp-agent` tests
- session request dispatcher tests
- root chat send 冒烟：`POST /api/ncp/agent/send` 可省略 `sessionId`，返回真实 materialized session id

改造完成后还要跑项目标准治理：

- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- maintainability guard / review

## 待确认问题

1. 阶段二里，NextClaw HTTP send 是先直接调用 `AgentRunRequestManager.send(...)`，还是同步改成通过 ingress？推荐先直接调用，ingress 放阶段三。
2. `AgentRuntimeHandle.agentClientEndpoint` 是阶段二直接删除，还是先标成仅 generic NCP compatibility？推荐若没有外部 package contract 阻塞，直接删除主路径依赖。
3. `resolveRuntime(requestEnvelope)` 最终是否必须只返回 runtime？如果 execution context 仍有必要，建议命名为 `resolveRuntimeExecution(...)`，避免 runtime 对象被迫承载 session/persistence/stream 上下文。
4. `ncp-http-agent-server` 是否要同步调整公共接口？推荐先不要让 generic package 改造阻塞 kernel owner 收敛，等 NextClaw 主路径稳定后再评估。
