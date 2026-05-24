# Agent Run 核心运行态骨架临时方案

关联大方案：[会话运行态与持久化架构设计草案](../../../designs/2026-05-23-session-runtime-architecture-design.md)。

## 当前目标

本轮先不改 session summary event、context-window API，也不接管现有 agent run 主链路。

目标是先在 kernel 内部建立一套新的核心运行态骨架，让后续迁移有稳定形状可对齐：

- `SessionRun`：纯运行态 owner，内部持有现有 `ConversationStateManager`，只暴露 `applyEvents(...)` 和 `getSnapshot()`。
- `MessageInbox`：通用 FIFO 队列，供用户新消息进入运行中的 agent loop。
- `SessionRunManager`：只管理 `sessionId -> SessionRun`，不碰存储、不发布 eventBus、不创建 runtime。
- `AgentRunRequest` / `AgentRunSpec`：区分系统请求原料和 agent loop 必需参数。
- `ContextProviderManager`：按 request 构造 prompt context blocks。
- `ToolProviderManager`：按 request 构造本轮可用 tools。
- `AgentRuntimeManager`：注册制 runtime owner，按 `agentRuntimeId` 解析并缓存新形态 runtime 实例。
- `AgentRunRequestManager`：作为未来上层编排者，先保留 contract 形状，后续再接 ingress 和旧链路替换。

## 非目标

- 不修改旧 `packages/nextclaw-kernel/src/managers/session-run.manager.ts`。
- 不修改旧 `packages/nextclaw-kernel/src/managers/agent-run-request.manager.ts`。
- 不改 `NcpAgentRuntime` 公共协议。
- 不迁移持久化格式。
- 不把 `contextWindow` 放入 `SessionRun` 或 `ConversationStateManager`。
- 不新增临时兼容 alias。

## 落点

新增隔离 feature root：

```text
packages/nextclaw-kernel/src/features/agent-run/
  index.ts
  types/agent-run.types.ts
  managers/session-run.manager.ts
  managers/agent-runtime.manager.ts
  managers/context-provider.manager.ts
  managers/tool-provider.manager.ts
  managers/agent-run-request.manager.ts
```

暂不从 `packages/nextclaw-kernel/src/index.ts` 导出，避免和旧 manager 公共入口冲突。

## 第一批验收

当前设计仍在快速讨论期，第一批先用 TypeScript、lint 和治理检查约束基本形状，不写大量细粒度行为测试，避免过早把不稳定 API 冻住。

第一批只要求：

- `SessionRun` / `SessionRunManager` / `MessageInbox` 的类型边界能表达纯运行态职责。
- `AgentRuntimeManager` 是注册制 owner，而不是 constructor 注入单个 factory。
- 业务 manager 直接持有稳定依赖，不使用 `options` / `params` / `deps` 容器隐藏真实 owner 拓扑。
- `ContextProviderManager` / `ToolProviderManager` 都采用 `register(...) -> unregister` 形态。
- `AgentRunRequestManager` 保留未来上层编排者形状，但暂不接管旧 ingress 主链路。
- `AgentRunRequestManager` 直连 `Ingress`、`EventBus` 和当前 session owner，不使用 `loadSessionRunSeed` / `publishEvent` 这类流程 callback。
- `AgentRunRequestManager.send` 保持主流程直写：session get/create、SessionRun get/create、inbox 入队、spec 构造、runtime 获取和后台事件桥接应能在一个方法里顺序读完；不要拆出 `resolveSessionRunSeed` / `toRunSpec` 这类只用一次且无稳定边界的小私有函数。
- `AgentRunRequestManager` 只在 ingress 边界做请求转换；内部 manager/runtime/session 之间按明确 contract 协作，不做多套 metadata alias fallback，不在 runtime event payload 上补字段，不用调用方层层防卫掩盖 contract owner 的责任。
- `AgentRunRequest.model` / `maxTokens` 是请求者可选材料，不是 request 必填项；最终 `AgentRunSpec` 在 `AgentRunRequestManager` 内结合系统配置解析，默认 model 来自 `config.agents.defaults.model`，默认 max tokens 优先来自当前模型的 `agents.defaults.models[model].params.max_tokens`，再落到运行态默认值。
- `AgentRunRequestManager.send` 接受请求后尽快返回 run handle，runtime event stream 在后台桥接到 eventBus。
- 新骨架暂不从 kernel 根入口导出，避免对外形成未稳定合同。

等 `AgentRunRequest`、`AgentRunSpec`、provider 输入、runtime 事件 apply 归属讨论稳定后，再补少量合同测试。

## 后续迁移顺序

1. 用新 `AgentRunRequestManager` 接一条测试用 ingress 链路。
2. 增加旧 `NcpAgentRuntime -> AgentRuntime` adapter。
3. 将旧 `AgentRunRequestManager` 的核心 run 流程迁到新 request manager。
4. 将旧 `SessionRunManager` 中的运行态职责迁入新 `SessionRunManager`。
5. 删除旧 `liveSession / activeExecution` 混合职责。
