# Tool Provider Contribution 归位方案设计

## 纠偏结论

这次清理必须对齐新链路现状：`ToolProviderManager` 已经是标准形态。

当前标准形态是：

```ts
export class ToolProviderManager {
  private readonly providers = new Set<ToolProvider>();

  register = (provider: ToolProvider): (() => void) => {
    this.providers.add(provider);
    return () => {
      this.providers.delete(provider);
    };
  };

  buildTools = async (request: AgentRunRequest): Promise<readonly NcpTool[]> => {
    const tools: NcpTool[] = [];
    const seen = new Set<string>();
    for (const provider of [...this.providers]) {
      for (const tool of await provider.provide(request)) {
        if (seen.has(tool.name)) {
          continue;
        }
        seen.add(tool.name);
        tools.push(tool);
      }
    }
    return tools;
  };

  dispose = (): void => {
    this.providers.clear();
  };
}
```

provider contract 是：

```ts
export type ToolProvider = {
  provide: (
    request: AgentRunRequest,
  ) => Promise<readonly NcpTool[]> | readonly NcpTool[];
};
```

所以正确方案不是扩展 `ToolProviderManager` 外部表面，也不是新增另一个 tool set / registry API。正确方案是：所有工具 provider 都直接实现当前 `provide(request)` contract，并注册到当前 `ToolProviderManager`。

## 明确禁止

本次方案不引入这些新概念：

- 不新增 `buildToolSet`。
- 不新增 `buildToolDefinitions`。
- 不新增 `registerTools`。
- 不新增 `ToolRegistrationContext`。
- 不新增新的 registry API。
- 不把旧 `ToolManager` 改名保留。
- 不保留 `Tool -> NcpTool` 适配层。
- 不保留 `ToolRegistry`。

provider 直接产出 `NcpTool[]`。core 工具也应直接按 `NcpTool` 合同实现，而不是先创建旧 `Tool` 再转换。

## 当前问题

现在实际链路是：

```text
ToolProviderContribution
  -> kernel.toolManager.provideTools(CoreToolProvider / ...)
  -> branch.toolProviderManager.register(KernelToolProvider)

AgentRunRequestManager
  -> branch.toolProviderManager.buildTools(request)
  -> KernelToolProvider.provide(request)
  -> kernel.toolManager.createRuntimeRegistry(...)
  -> runtime.run(...tools)
```

这里的问题是：

- 标准 provider 被注册到了旧 `ToolManager`，没有直接进入新链路。
- `ToolProviderManager` 里只注册了一个 `KernelToolProvider` 临时桥。
- `KernelToolProvider` 又绕回旧 `ToolManager`。
- 所以现在仍然是双 owner：`ToolProviderManager` + `ToolManager`。

这违反单一 owner：工具 provider 领域只应该有一个标准 owner，也就是当前 `ToolProviderManager`。

## 最终目标链路

最终只保留：

```text
ToolProviderContribution
  -> branch.toolProviderManager.register(CoreToolProvider)
  -> branch.toolProviderManager.register(MessagingToolProvider)
  -> branch.toolProviderManager.register(SessionToolProvider)
  -> branch.toolProviderManager.register(ExtensionToolProvider)
  -> branch.toolProviderManager.register(AssetToolProvider)
  -> branch.toolProviderManager.register(McpToolProvider)

AgentRunRequestManager
  -> branch.toolProviderManager.buildTools(request)
  -> runtime.run(...tools)

KernelContextProvider
  -> branch.toolProviderManager.buildTools(request)
  -> tools.map(toToolDefinition)
  -> prompt tool catalog
```

这里 `ToolProviderManager` 当前仍然挂在 `KernelBranch` 上，因为 agent run 当前还在 branch 内。后续如果 agent run 整体归位到顶层，再把同一个 `ToolProviderManager` owner 迁到顶层，不能再造第二套。

## 要删除的东西

### 删除旧 `ToolManager`

删除：

```text
packages/nextclaw-kernel/src/managers/tool.manager.ts
packages/nextclaw-kernel/src/managers/__tests__/tool.manager.test.ts
```

删除引用：

```text
NextclawKernel.toolManager
new ToolManager()
kernel.toolManager.provideTools(...)
kernel.toolManager.createRuntimeRegistry(...)
```

旧 `ToolManager` 中仍有价值的行为迁到新 owner：

- core tool 的 class 实现继续保留在 `@nextclaw/core`，但执行合同升级为 NCP 可直接调用。
- extension tool 旧适配链路没有当前加载来源，删除 `ExtensionToolAdapter` / `ExtensionToolProvider` / `ExtensionNcpTool` / `ExtensionToolRegistration`，当前 extension 只保留真实使用的 channel contribution。
- duplicate tool name 的处理策略下沉到 `ToolProviderManager.buildTools(request)`，按注册顺序 first wins。

这些能力不能再作为 manager 级 API 暴露。

## 旧 `@nextclaw/core` Tool 的具体处置

`@nextclaw/core` 里的旧工具体系是：

```text
Tool abstract class
ToolRegistry
ReadFileTool / WriteFileTool / EditFileTool / ListDirTool
ExecTool
WebSearchTool / WebFetchTool
MemorySearchTool / MemoryGetTool
GatewayTool
MessageTool / CronTool
```

这些类不再通过 `ToolManager / ToolRegistry / Tool -> NcpTool adapter` 进入 agent run。新链路事实源仍然只能是 `ToolProviderManager` 里注册的 provider 返回的 `NcpTool[]`。

最终采用的更干净方案是：把 `@nextclaw/core` 的 `Tool` 执行合同拓宽成 NCP 可直接调用的形态，让已有工具 class 直接满足 `NcpTool` 的结构合同，而不是在 kernel 复制一套同名工具实现。

具体合同调整：

```ts
export abstract class Tool {
  abstract execute(params: unknown, context?: ToolExecutionContext): Promise<unknown>;
}
```

同时新增 `normalizeToolParams(args)`，让已有 core tool 可以接受 NCP runtime 传入的 `unknown` 参数。旧 `ToolRegistry` 仍可给需要 tool call context 的旧调用方传 `ToolExecutionContext`，但 agent run 新链路不再依赖它。

具体处置：

| 工具域 | 新链路实现 | 旧 core Tool 处置 |
| --- | --- | --- |
| filesystem | `CoreToolProvider` 直接返回 `ReadFileTool` / `WriteFileTool` / `EditFileTool` / `ListDirTool` | core class 执行签名改为 NCP 可直接调用，不经过 adapter |
| exec | `CoreToolProvider` 直接返回 `ExecTool`，并在 provider 内设置 run context | `ExecTool` 继续承载 guard / result 构造，不复制实现 |
| web | `CoreToolProvider` 直接返回 `WebSearchTool` / `WebFetchTool` | 继续复用 core class；`undici` 仍只属于 `@nextclaw/core` 自身依赖，不在 kernel 新增依赖 |
| memory | `CoreToolProvider` 直接返回 `MemorySearchTool` / `MemoryGetTool` | 继续复用 core class |
| gateway | `CoreToolProvider` 直接返回 `GatewayTool`，并在 provider 内设置 session context | 继续复用 core class |
| message / cron | `MessagingToolProvider` 直接返回 `MessageTool` / `CronTool`，并在 provider 内设置 channel/chat/account context | 继续复用 core class |
| session | 将 `SessionSpawnTool` / `SessionRequestTool` / list / history / search 改为直接 `implements NcpTool`，或新增对应 NCP-native class 后替换旧类 | 不通过旧 `Tool` execution context |
| extension tool | 删除旧链路 | 当前 extension manifest 只产出 channel contribution，`extensionRegistry.tools` 永远为空，没有真实工具加载来源 |
| asset / MCP | 已经是 `NcpTool` | 直接保留 |

命名重点：kernel 自己新增的 NCP 工具文件用 `*-ncp.tools.ts`。已有 core 工具 class 不改文件名，因为它们本来就是稳定工具 owner；这次只升级合同，不复制实现。

### 为什么这比复制 NCP-native core tools 更好

上一版方案曾考虑在 kernel 下新增一整套 `ReadFileNcpTool / ExecNcpTool / MessageNcpTool / CronNcpTool`。落地验证后这个方案不够简洁：

- 会复制 `@nextclaw/core` 已有工具业务逻辑。
- 非功能改动会大幅增加代码量。
- `contributions/tool-provider/tools` 会快速变成新的大目录。
- 后续 core tool 行为变更需要双改，反而制造第二事实源。

最终方案保留已有 class owner，把“旧合同问题”修在合同源头：`Tool` 支持 NCP 的 `execute(args)` 调用，同时旧 registry 仍可传可选 context。这样 agent run 新链路没有 adapter / registry / manager 中间层，provider 返回的就是 runtime 要执行的工具实例。

### 删除 `KernelToolProvider`

删除：

```text
packages/nextclaw-kernel/src/contributions/tool-provider/providers/kernel-tool.provider.ts
```

删除注册：

```ts
this.branch.toolProviderManager.register(new KernelToolProvider(...))
```

原因：`KernelToolProvider` 只是让新 `ToolProviderManager` 绕回旧 `ToolManager` 的临时桥。六个标准 provider 直接注册进 `ToolProviderManager` 后，它就没有存在价值。

## Provider 应该怎么写

六个 provider 都实现当前 `ToolProvider` contract：

```text
packages/nextclaw-kernel/src/contributions/tool-provider/providers/core-tool.provider.ts
packages/nextclaw-kernel/src/contributions/tool-provider/providers/messaging-tool.provider.ts
packages/nextclaw-kernel/src/contributions/tool-provider/providers/session-tool.provider.ts
packages/nextclaw-kernel/src/contributions/tool-provider/providers/extension-tool.provider.ts
packages/nextclaw-kernel/src/contributions/tool-provider/providers/asset-tool.provider.ts
packages/nextclaw-kernel/src/contributions/tool-provider/providers/mcp-tool.provider.ts
```

示例：

```ts
export class AssetToolProvider implements ToolProvider {
  constructor(private readonly kernel: NextclawKernel) {}

  provide = async (_request: AgentRunRequest): Promise<readonly NcpTool[]> => {
    return createAssetTools({ assetStore: this.kernel.assetStore });
  };
}
```

`McpToolProvider`：

```ts
export class McpToolProvider implements ToolProvider {
  constructor(private readonly kernel: NextclawKernel) {}

  provide = async (request: AgentRunRequest): Promise<readonly NcpTool[]> => {
    const session = request.sessionId
      ? await this.branch.sessionRepository.getSession(request.sessionId)
      : null;
    const requestMetadata = buildAgentRunRequestMetadata({ request, session });
    const runContext = resolveNextclawNcpRunContext({
      configManager: this.kernel.configManager,
      sessionId: session?.sessionId ?? request.sessionId ?? request.message.sessionId ?? "",
      requestMetadata,
      sessionMetadata: session?.metadata ?? requestMetadata,
      storedAgentId: request.agentId ?? session?.agentId,
    });
    return this.kernel.mcpManager.listToolsForRun({
      agentId: runContext.profile.agentId,
    });
  };
}
```

`CoreToolProvider` 直接产出可被 NCP runtime 执行的 core tool class 实例：

```ts
export class CoreToolProvider implements ToolProvider {
  constructor(
    private readonly kernel: NextclawKernel,
    private readonly branch: KernelBranch,
  ) {}

  provide = async (request: AgentRunRequest): Promise<readonly NcpTool[]> => {
    const context = await this.resolveToolContext(request);
    const execTool = new ExecTool({
      workingDir: context.workspace,
      timeout: context.execTimeoutSeconds,
      restrictToWorkspace: context.restrictToWorkspace,
    });
    execTool.setContext({
      sessionKey: context.sessionId,
      channel: context.channel,
      chatId: context.chatId,
    });
    const gatewayTool = new GatewayTool(this.kernel.getGatewayController());
    gatewayTool.setContext({ sessionKey: context.sessionId });
    return [
      new ReadFileTool(context.allowedDir),
      new WriteFileTool(context.allowedDir),
      new EditFileTool(context.allowedDir),
      new ListDirTool(context.allowedDir),
      execTool,
      new WebSearchTool(context.searchConfig),
      new WebFetchTool(),
      new MemorySearchTool(context.workspace),
      new MemoryGetTool(context.workspace),
      gatewayTool,
    ];
  };
}
```

这些 class 仍由 `@nextclaw/core` 维护。kernel 不复制 core tools，只负责按 request/run context 组装它们。

## `ToolProviderContribution` 应该怎么改

当前错误形态：

```ts
for (const provider of this.createKernelToolProviders()) {
  this.cleanups.push(this.kernel.toolManager.provideTools(provider).dispose);
}

this.cleanups.push(
  this.branch.toolProviderManager.register(new KernelToolProvider(this.kernel, this.branch)),
);
```

改成当前标准形态：

```ts
this.cleanups.push(
  this.branch.toolProviderManager.register(new CoreToolProvider(this.kernel, this.branch)),
  this.branch.toolProviderManager.register(new MessagingToolProvider(this.kernel, this.branch)),
  this.branch.toolProviderManager.register(new SessionToolProvider(this.kernel, this.branch)),
  this.branch.toolProviderManager.register(new ExtensionToolProvider(this.kernel, this.branch)),
  this.branch.toolProviderManager.register(new AssetToolProvider(this.kernel, this.branch)),
  this.branch.toolProviderManager.register(new McpToolProvider(this.kernel, this.branch)),
);
```

不再注册 `KernelToolProvider`，不再碰 `kernel.toolManager`。

## `AgentRunRequestManager` 应该怎么改

`AgentRunRequestManager` 当前已经是正确消费形态，继续保留：

```ts
const tools = await this.toolProviderManager.buildTools(providerRequest);
```

不要改成 `buildToolSet`。

如果 provider 内部需要 session / run context，就在 provider 内部基于 `AgentRunRequest` 和 `SessionRepository` 解析。这样对齐当前 `provide(request)` contract。

### 工具调用上下文与异步工具结果回写

`toolCallId` 和 `updateToolCallResult` 不属于 provider contract，也不属于 `AgentRunRequestManager` 外部绑定参数。它们是 agent loop 在“真正调用某个 tool call”这一刻才拥有的运行时事实。

正确 owner 是 runtime 的工具调用点：

```text
AgentRunRequestManager
  -> toolProviderManager.buildTools(request)
  -> runtime.run(...tools)
  -> agent loop 收集 tool call
  -> executeToolCall(...)
  -> tool.execute(args, { toolCallId, updateToolCallResult })
```

因此不允许再出现：

```ts
runtime.run(spec, {
  tools,
  updateToolCallResult: ...
})
```

也不允许在生产链路里用占位函数撑合同：

```ts
updateToolCallResult: async () => undefined
```

正确写法是由 runtime 在 `executeToolCall` 内部创建真实 `NcpToolExecutionContext`：

```ts
await tool.execute(args, {
  toolCallId: toolCall.toolCallId,
  updateToolCallResult: async (updatedResult) => {
    const result = this.toolResultContentManager.normalizeToolCallResult({
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      args,
      rawArgsText: toolCall.args,
      result: updatedResult,
    });
    await sessionRun.applyAndPublishEvents([{
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId,
        toolCallId: toolCall.toolCallId,
        correlationId: spec.correlationId,
        content: result.result,
        contentItems: result.contentItems,
      },
    }], { source: "agent-runtime-tool-call-update" });
  },
});
```

这里的 `applyAndPublishEvents` 只服务“工具执行返回之后还有后台结果更新”的场景，例如 `sessions_request notify="none"` 先返回 started，再由目标 session 完成后更新原工具调用结果。普通 runtime yield 出来的事件仍由 `AgentRunRequestManager` 维持现有发布顺序，避免改变 session preview 的事件时序。

工具自身不再额外校验“是否拿到了 updateToolCallResult”。生产 runtime 必须传真实函数；直接单测或非 agent loop 调用时允许该字段为空，工具按现有语义继续执行，不新增报错分支。

## `KernelContextProvider` 应该怎么改

当前错误形态：

```ts
const toolRegistry = this.kernel.toolManager.createRuntimeRegistry(...);
toolRegistry.prepareForRun(runContext.toolRunContext);
buildToolCatalogEntries(toolRegistry.getToolDefinitions())
```

改成复用当前标准入口：

```ts
const tools = await this.branch.toolProviderManager.buildTools(request);
const definitions = tools.map((tool) => ({
  name: tool.name,
  description: tool.description,
  parameters: tool.parameters,
}));

buildToolCatalogEntries(definitions)
```

这样 prompt catalog 和 runtime tools 来自同一条 `ToolProviderManager.buildTools(request)` 链路。

## 推荐落地顺序

### Step 1：修 provider contract

- 六个 provider 改成实现当前 `ToolProvider.provide(request)`。
- provider 直接返回 `NcpTool[]`。
- core provider 直接返回可作为 `NcpTool` 执行的 core tool class，不保留 `ToolManager` adapter / registry。

### Step 2：切装配

- `ToolProviderContribution` 直接向 `branch.toolProviderManager` 注册六个 provider。
- 删除 `KernelToolProvider` 注册。

### Step 3：切 prompt catalog

- `KernelContextProvider` 改用 `branch.toolProviderManager.buildTools(request)`。
- 从返回的 `NcpTool[]` 映射 prompt definitions。

### Step 4：删除旧对象

- 删除 `ToolManager` 文件和测试。
- 删除 `KernelToolProvider` 文件。
- 删除 `NextclawKernel.toolManager` 字段和构造。
- 删除所有 `kernel.toolManager` 引用。

## 验收标准

残留搜索：

```text
rg "toolManager|ToolManager|KernelToolProvider|createRuntimeRegistry|provideTools|buildToolSet|registerTools|ToolRegistrationContext|adaptCoreTool|ExtensionToolAdapter" packages/nextclaw-kernel/src
```

结果应为空，或只剩无关历史文档。

运行验证：

- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw-core exec vitest run src/features/agent/tools/cron.tools.test.ts src/features/agent/tools/shell.tools.test.ts src/features/agent/tools/message.tools.test.ts src/features/agent/tools/web.tools.test.ts src/features/agent/features/tests/filesystem.tool.test.ts`
- `pnpm -C packages/nextclaw-kernel exec vitest run src/features/agent-run/managers/agent-run-request.manager.test.ts src/features/agent-run/services/agent-run-client.service.test.ts src/tools/session-spawn.tools.test.ts src/tools/session-history.tools.test.ts`
- 新增或迁移 `ToolProviderManager` 定向测试，覆盖：
  - 多 provider 注册后 `buildTools(request)` 能聚合所有工具。
  - core tools 能作为 `NcpTool` 返回。
  - NCP tools 能原样返回。
  - prompt definitions 从同一批 `NcpTool[]` 映射出来。
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-core lint`
- `pnpm -C packages/nextclaw-kernel build`
- `pnpm -C packages/nextclaw-core build`
- `git diff --check`

## 一句话设计原则

新链路标准 owner 已经是当前 `ToolProviderManager`。这次清理只让旧工具能力适配它的 `register / buildTools / provide(request)` 形态，不改变它。
