# 工具管理器与工具贡献重构方案

**目标：**把当前事实上的 `NextclawNcpToolRegistry` 收敛为 kernel 级 `ToolManager`，删除空壳 `ToolManager`，并用单个 kernel contribution 负责注册 agent 可用工具，从而先切掉 `AgentRuntimeManager` 对 gateway / tool 装配细节的耦合。

**架构方向：**现有 `NextclawNcpToolRegistry` 已经是真正的工具 owner：它按运行上下文准备工具、提供 `NcpToolRegistry`、执行工具调用，并处理 extension / additional tools。改造时不新增平行 manager，而是把这套真实实现迁回 `packages/nextclaw-kernel/src/managers/tool.manager.ts`。具体工具注册逻辑集中到一个 `ToolContribution`，该 contribution 直接依赖 `NextclawKernel`，由 kernel 管理生命周期；asset store / `McpManager` 作为 kernel 能力暴露给 contribution，避免 native runtime factory 继续承担工具注册职责。

**成功标准：**
- `NextclawKernel` 暴露 `readonly toolManager: ToolManager`，不再暴露空壳 `tools`。
- `NextclawKernel` 提供一个简单的可选 `GatewayController` provide / 读取入口，service 创建 controller 后提供给 kernel。
- 旧空壳 `ToolManager` 被真实实现替换，不保留新旧双轨。
- `NativeAgentRuntimeFactory` 不再直接构造 `NextclawNcpToolRegistry`。
- `AgentRuntimeManager` 不再持有 `gatewayController` 字段，也不再提供 `connectGatewayController()`。
- 默认工具注册由一个 `ToolContribution` 完成，不提前拆成多个 contribution。
- 现有 agent run、gateway tool、session tools、extension tools、MCP tools、asset tools 行为保持不变。

## 当前结构

当前相关文件：

- `packages/nextclaw-kernel/src/managers/tool.manager.ts`
  - 当前是空壳，方法全部未实现。
- `packages/nextclaw-kernel/src/features/native-runtime/services/nextclaw-ncp-tool-registry.service.ts`
  - 当前是真正工具 owner，但位置和命名都让它看起来只是 native runtime 的私有 registry。
  - 它直接注册 file / exec / web / message / cron / session / memory / gateway / extension / additional tools。
- `packages/nextclaw-kernel/src/features/native-runtime/services/native-agent-runtime-factory.service.ts`
  - 当前每次创建 native runtime 时 new `NextclawNcpToolRegistry`。
  - 通过 `resolveGatewayController` 把 gateway controller 注入 tool registry。
- `packages/nextclaw-kernel/src/managers/agent-runtime.manager.ts`
  - 当前持有 `gatewayController`，通过 `connectGatewayController()` 接收 service 侧 controller。
- `packages/nextclaw-service/src/shared/services/gateway/nextclaw-gateway-runtime.service.ts`
  - 当前调用 `kernel.agentRuntimeManager.connectGatewayController(this.gatewayController)`。
- `packages/nextclaw-kernel/src/app/nextclaw-kernel.ts`
  - 当前暴露 `readonly tools: ToolManager`，但这个 manager 没有真实能力。
  - 当前已有 contribution 生命周期数组。

## 目标结构

目标结构：

```text
NextclawKernel
  readonly toolManager: ToolManager
  provideGatewayController(controller)
  getGatewayController()
  contributions = [
    new ToolContribution(this),
    ...
  ]

ToolContribution
  constructor(kernel: NextclawKernel)
  start() 注册默认 agent 可用工具提供者到 kernel.toolManager
  创建 GatewayTool 时从 kernel.getGatewayController() 读取可选 controller
  dispose() 在需要时清理 / 释放自己的注册

ToolManager
  拥有工具提供者注册
  按运行上下文准备工具
  为 runtime 提供 NcpToolRegistry 行为
  执行 tool calls

NativeAgentRuntimeFactory
  接收 toolManager
  向 toolManager 请求本次运行的工具 / registry
  不知道 GatewayController

NextclawGatewayRuntime
  创建 GatewayControllerImpl
  调用 kernel.provideGatewayController(gatewayController)
```

## 非目标

- 不拆多个 contribution；本轮只引入一个 `ToolContribution`。
- 不重做工具 schema、工具名称、工具可用性策略。
- 不改变 NCP event、session、backend、runtime registry 语义。
- 不引入动态 tool 卸载产品能力；如果注册 API 需要 disposer，只用于 contribution dispose 防重复。
- 不把 contribution 内部 helpers 作为公共 API 暴露。
- 不新增 `GatewayControllerManager`，也不引入 service 侧 tool provider 注册体系；gateway controller 只作为可选能力提供给 kernel。

## 实施任务

### 任务 1：用真实 owner 替换空壳 ToolManager

修改：

- `packages/nextclaw-kernel/src/managers/tool.manager.ts`
- `packages/nextclaw-kernel/src/features/native-runtime/services/nextclaw-ncp-tool-registry.service.ts`
- `packages/nextclaw-kernel/src/features/native-runtime/index.ts`

步骤：

1. 把 `NextclawNcpToolRegistry` 的真实 manager 逻辑迁入 `ToolManager`。
2. 保持现有运行上下文行为不变。
3. `CoreToolNcpAdapter` 默认留在 `tool.manager.ts` 内部，除非测试需要更窄的内部文件。
4. 删除或压缩 `nextclaw-ncp-tool-registry.service.ts`，确保不存在第二个工具 owner。
5. 更新导出，让调用方只指向 `ToolManager`。

预期结果：

- kernel 内只有一个工具 owner：`ToolManager`。
- 不再有空壳 manager。

### 任务 2：把 kernel 表面从 `tools` 改为 `toolManager`

修改：

- `packages/nextclaw-kernel/src/app/nextclaw-kernel.ts`
- 所有 `kernel.tools` 引用

步骤：

1. 把 `readonly tools: ToolManager` 改成 `readonly toolManager: ToolManager`。
2. 实例化真实 `ToolManager`。
3. 更新引用。
4. 不保留 `tools` alias。

预期结果：

- kernel API 命名表达 owner，而不是工具集合。

### 任务 3：在 kernel 上提供简单 GatewayController 提供点

修改：

- `packages/nextclaw-kernel/src/app/nextclaw-kernel.ts`
- `packages/nextclaw-service/src/shared/services/gateway/nextclaw-gateway-runtime.service.ts`

步骤：

1. 在 `NextclawKernel` 上增加一个私有可选字段保存 `GatewayController`。
2. 增加 `provideGatewayController(controller: GatewayController): void`。
3. 增加 `getGatewayController(): GatewayController | undefined`。
4. `NextclawGatewayRuntime` 创建 `GatewayControllerImpl` 后，改为调用 `kernel.provideGatewayController(this.gatewayController)`。
5. 不新增 `GatewayControllerManager`，不把 controller 传给 `AgentRuntimeManager`。

预期结果：

- gateway controller 成为 kernel 上的可选能力，供 contribution 读取。
- `AgentRuntimeManager` 不再作为 gateway controller 的搬运层。

### 任务 4：新增单个 Tool Contribution

新增：

- `packages/nextclaw-kernel/src/contributions/tool-contribution/index.ts`

只有确实需要时才新增内部文件：

- `packages/nextclaw-kernel/src/contributions/tool-contribution/types/tool-context.types.ts`
- `packages/nextclaw-kernel/src/contributions/tool-contribution/utils/*.utils.ts`

步骤：

1. 创建 `ToolContribution implements KernelContribution`。
2. 构造器只接收 `NextclawKernel`。
3. `start()` 把现有默认 agent 可用工具提供者注册到 `kernel.toolManager`。
4. 创建 `GatewayTool` 时直接读取 `kernel.getGatewayController()`，controller 不存在时沿用当前 `GatewayTool(undefined)` 的降级行为。
5. `dispose()` 只在注册 API 返回 disposer 时移除注册；否则至少由 manager 防止重复 start 注册。
6. contribution root 不导出内部 helpers。

预期结果：

- kernel 只管理 contribution 生命周期。
- 外部代码不知道 tools 如何组装。

### 任务 5：让 Native Runtime Factory 接入 ToolManager

修改：

- `packages/nextclaw-kernel/src/features/native-runtime/services/native-agent-runtime-factory.service.ts`
- `packages/nextclaw-kernel/src/managers/agent-runtime.manager.ts`

步骤：

1. 用 `toolManager` 替换 `NativeAgentRuntimeFactoryOptions.resolveGatewayController`。
2. 用 tool manager 调用替换直接构造 `NextclawNcpToolRegistry`。
3. asset / MCP tools 也由 `ToolContribution` 注册，native runtime factory 不再传 `getAdditionalTools`。
4. 保持 `resolveOpenAiToolsForRuntime(input)` 行为不变，由同一条 tool manager 准备路径承接。
5. 保持 `updateToolCallResult` 通过工具执行上下文回写的行为不变。

预期结果：

- native runtime factory 使用 tool manager，不再装配默认工具类别，也不再接触 gateway controller。

### 任务 6：从 AgentRuntimeManager 删除 GatewayController 搬运链路

修改：

- `packages/nextclaw-kernel/src/managers/agent-runtime.manager.ts`
- `packages/nextclaw-service/src/shared/services/gateway/nextclaw-gateway-runtime.service.ts`

步骤：

1. 删除 `private gatewayController`。
2. 删除 `connectGatewayController()`。
3. 删除 `resolveGatewayController` 透传。
4. 将 gateway controller 可用性移动到 `NextclawKernel.provideGatewayController()` / `getGatewayController()`。
5. 禁止把 gateway controller 传进 contribution 构造器或 `NativeAgentRuntimeFactory`。

预期结果：

- `AgentRuntimeManager` 不再运输 gateway tool 依赖。

### 任务 7：更新测试

可能需要更新或新增的测试：

- `packages/nextclaw-kernel/src/features/native-runtime/services/nextclaw-ncp-tool-registry.service.*`
- `packages/nextclaw-kernel/src/managers/tool.manager.*`
- `packages/nextclaw-kernel/src/app/nextclaw-kernel.*`
- `packages/nextclaw-service/src/shared/services/gateway/tests/nextclaw-app.service.test.ts`

覆盖目标：

1. Tool manager 能按运行上下文准备默认工具。
2. kernel 获得 gateway controller 后，tool contribution 准备的工具里包含可用的 gateway tool。
3. native runtime factory 能通过 tool manager 解析 OpenAI 工具定义。
4. `AgentRuntimeManager` bootstrap 不再要求 gateway controller。
5. 现有 agent send 测试仍通过。

## 验证

实现后最小验证：

```bash
pnpm -C packages/nextclaw-kernel tsc
pnpm -C packages/nextclaw-kernel test
pnpm -C packages/nextclaw-service test -- --runInBand
pnpm lint:new-code:governance
pnpm check:governance-backlog-ratchet
```

如果 package test 命令不同，使用最接近的 package-level `tsc` 和定向 vitest 命令。

因为这会触达 TypeScript 源码和运行链路装配，`tsc` 必跑。因为它改变工具装配和 gateway tool 访问路径，至少要有一个定向测试覆盖 agent 工具准备，或覆盖包含工具定义的运行路径。

## 可维护性合同

这是非新增用户能力的结构重构。实现阶段应通过删除以下内容，尽量保证非测试生产代码净增 `<= 0`：

- 空壳 `ToolManager` 实现。
- 迁移后的 `NextclawNcpToolRegistry` 重复 owner。
- `AgentRuntimeManager.connectGatewayController`。
- `AgentRuntimeManager.gatewayController`。
- `NativeAgentRuntimeFactoryOptions.resolveGatewayController`。
- 现在已经冗余的 import / export 路径。

除非公共 package export 证明必须保留，否则不要保留 `kernel.tools` 或 `NextclawNcpToolRegistry` 这类兼容 alias。当前证据显示二者都是内部路径，应直接改调用方。
