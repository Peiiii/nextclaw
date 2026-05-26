# Tool Provider Contribution 归位方案设计

## 背景

`KernelBranch` 是 agent run 新链路落地期间的临时分支结构。它承载了部分新链路装配，但长期目标是把稳定内核能力归位到 kernel 顶层，让 branch 逐步变薄，最终消失。

工具链路里原来同时存在两类东西：

- `contributions/tool-contribution`：主 kernel 工具注册入口，注册 file / exec / web / message / cron / session / memory / gateway / extension / asset / MCP / session search 等工具。
- `contributions/kernel-branch/contributions/tool-provider`：branch 内部的 agent-run 工具桥，把 `kernel.toolManager` 的运行时工具目录转换成 agent run 可消费的 `NcpTool[]`。

这两个名字和目录位置容易误导：一个叫 contribution，一个叫 provider contribution，但本质都在服务工具注册和 agent run 工具投递。最终应该收敛到顶层 `ToolProviderContribution`，内部再按 provider 拆分职责。

## 最终目标

工具链路只保留一个顶层 contribution：

```text
NextclawKernel
  -> ToolProviderContribution
    -> kernel.toolManager.provideTools(CoreToolProvider)
    -> kernel.toolManager.provideTools(MessagingToolProvider)
    -> kernel.toolManager.provideTools(SessionToolProvider)
    -> kernel.toolManager.provideTools(ExtensionToolProvider)
    -> kernel.toolManager.provideTools(AssetToolProvider)
    -> kernel.toolManager.provideTools(McpToolProvider)
    -> branch.toolProviderManager.register(KernelToolProvider)

AgentRunRequestManager
  -> ToolProviderManager.buildTools(...)
  -> KernelToolProvider
  -> kernel.toolManager.createRuntimeRegistry(...)
  -> runtime.run(...tools)
```

这里有两个层次：

- `ToolProviderContribution` 是生命周期 owner，负责把所有工具 provider 挂到 kernel。
- `providers/*` 是标准 provider，分别注册各自领域的工具。

`KernelToolProvider` 仍是一个过渡桥：它不重新实现工具清单，只把 `kernel.toolManager` 中已经注册好的工具转换给 agent run。等后续 agent run 的工具 resolver 也归位到顶层后，再删除这个桥。

## 本次实施范围

本次一次性完成这些事：

- 把 branch 下的 `tool-provider` contribution 目录迁移到顶层 `contributions/tool-provider`。
- 删除旧 `contributions/tool-contribution`。
- 把旧 `ToolContribution` 内的工具注册逻辑拆成标准 provider。
- `NextclawKernel` 只装配顶层 `ToolProviderContribution`。
- `KernelBranch` 不再装配自己的 `ToolProviderContribution`，只保留 `ToolProviderManager` 供 agent run 当前链路消费。
- 不改工具协议、不改 agent run runtime 入参、不改模型工具执行语义。

## Provider 拆分

```text
contributions/tool-provider/
  index.ts
  providers/
    core-tool.provider.ts
    messaging-tool.provider.ts
    session-tool.provider.ts
    extension-tool.provider.ts
    asset-tool.provider.ts
    mcp-tool.provider.ts
    kernel-tool.provider.ts
```

职责边界：

- `CoreToolProvider`：file / exec / web / memory / gateway。
- `MessagingToolProvider`：message / cron，以及 channel/account 上下文。
- `SessionToolProvider`：session spawn / request / list / history / search。
- `ExtensionToolProvider`：extension tools adapter。
- `AssetToolProvider`：asset store NCP tools。
- `McpToolProvider`：MCP tools。
- `KernelToolProvider`：agent run 过渡桥，复用 `kernel.toolManager.createRuntimeRegistry(...)` 输出 runtime tools。

## 保留项

这些不是本次要删的对象：

- `ToolManager`：仍是 kernel 工具目录 owner。
- `ToolProviderManager`：agent run 当前仍通过它聚合 runtime tools。
- `KernelToolProvider`：仍是 agent run 过渡桥，但已归位到顶层 `tool-provider/providers`，后续再替换为更直接的 resolver。

## 验证计划

本次改动触达 TypeScript、生命周期装配和工具运行链路，必须运行：

- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-kernel exec vitest run src/managers/__tests__/tool.manager.test.ts src/tools/session-spawn.tools.test.ts src/tools/session-history.tools.test.ts src/features/agent-run/managers/agent-run-request.manager.test.ts src/features/agent-run/services/agent-run-client.service.test.ts`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- maintainability guard
- `git diff --check`

## 后续可继续清理

后续如果要继续把 branch 变薄，下一步不是再新增平行工具链路，而是评估：

- `ToolProviderManager` 是否可以被顶层 agent-run tool resolver 替代。
- `KernelToolProvider` 是否可以删除。
- `KernelBranch` 内剩余 manager 哪些应归位为顶层 owner。
