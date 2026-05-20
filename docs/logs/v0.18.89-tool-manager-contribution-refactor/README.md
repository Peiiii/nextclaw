# Tool Manager Contribution Refactor

## 迭代完成说明

- 将空壳 `ToolManager` 替换为真实工具 owner：负责 provider 注册、按运行上下文创建 `NcpToolRegistry`、执行 tool call、过滤不可用 core tool。
- 删除旧 `NextclawNcpToolRegistry` 文件，不保留新旧双轨。
- 新增单一 `ToolContribution`，直接依赖 `NextclawKernel`，注册 agent 可用工具，包括 file / exec / web / message / cron / session / memory / gateway / extension / asset / MCP / session_search。
- `NextclawKernel` 暴露 `toolManager`，并提供 `provideGatewayController()` / `getGatewayController()`；service 创建 gateway controller 后直接 provide 给 kernel。
- `AgentRuntimeManager` 删除 `gatewayController` 字段和 `connectGatewayController()`；`NativeAgentRuntimeFactory` 不再接触 gateway controller，只通过 `toolManager.createRuntimeRegistry()` 获取运行期 registry。
- `assetStore` / `mcpManager` 由 kernel 持有，`ToolContribution` 统一注册 asset / MCP tools，native runtime factory 不再传 `getAdditionalTools`。
- `McpManager.start()` 接管 MCP server 预热生命周期，`NextclawKernel.start()` 统一启动；service 与 `AgentRuntimeManager` 不再调度 MCP warmup。
- 新增单一 `AgentRuntimeContribution`，注册 native / NARP / plugin runtime providers；删除 `AgentRuntimeManager.registerCoreRuntimes()` 与 `PluginRuntimeRegistrationController`，让 `AgentRuntimeManager` 回到 runtime 容器、backend 启动、请求入口和会话 materialization 职责。
- `resolveTools` 注入从 `AgentRuntimeManager` 移到具体 runtime provider 注册包装里；NARP/plugin runtime 需要的 tool resolver 由 `AgentRuntimeContribution` 提供。
- `ContextCompactionPreflightService` 与相关 utils 从 `features/native-runtime` 移到 `features/context-compaction`，消除 manager 对 native-runtime 目录的误导性依赖。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-kernel exec eslint src/app/nextclaw-kernel.ts src/managers/tool.manager.ts src/managers/tool.manager.test.ts src/managers/agent-runtime.manager.ts src/contributions/tool-contribution/index.ts src/features/native-runtime/index.ts src/features/native-runtime/services/native-agent-runtime-factory.service.ts src/features/native-runtime/services/nextclaw-ncp-context-builder.service.ts vitest.config.ts`
- `pnpm -C packages/nextclaw-service exec eslint src/shared/services/gateway/nextclaw-gateway-runtime.service.ts`
- `pnpm -C packages/nextclaw-kernel exec vitest run src/managers/tool.manager.test.ts`
- `pnpm -C packages/nextclaw-kernel build && pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-service exec vitest run src/shared/services/gateway/tests/nextclaw-app.service.test.ts`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
- `pnpm lint:new-code:governance -- ...`
- `pnpm check:governance-backlog-ratchet`

## 发布/部署方式

不涉及部署。涉及 `@nextclaw/kernel` 与 `@nextclaw/service` 源码边界变更，后续随统一包发布流程发布。

## 用户/产品视角的验收步骤

- 启动 gateway runtime 后，gateway controller 应由 service provide 到 kernel。
- 发起 native agent run，默认工具列表应保持原行为，gateway tool 能读取当前 controller。
- asset / MCP tools 应由 `ToolContribution` 注册，`resolveOpenAiToolsForRuntime()` 的工具解析路径保持可用。
- `kernel.start()` 后 MCP server warmup 应由 kernel/MCP owner 后台触发；service deferred startup 只处理 plugins / plugin gateways / extensions / channels / restart sentinel。
- agent runtime session types 与 run 创建仍应能发现 native、NARP 与插件 runtime，但具体注册代码不再落在 `AgentRuntimeManager` 内。

## 可维护性总结汇总

- 已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 标准完成复核。
- 非功能改动的非测试代码净增为 `0` 行：新增 `ToolManager` / `ToolContribution` 由删除旧 `NextclawNcpToolRegistry` 与移除 `AgentRuntimeManager` gateway 搬运链路抵消。
- 正向减债动作：职责收敛与删除。工具 owner 回到 kernel `ToolManager`，默认工具组装回到单一 contribution，`NativeAgentRuntimeFactory` 与 `AgentRuntimeManager` 不再承担 gateway/tool 具体装配职责。
- 已消除 `NativeAgentRuntimeFactory` 的 additional tools 注册残留；后续剩余优化点是继续压薄 `ToolProvider` / `ToolRegistrationContext` 这类机制名词。
- 本轮继续删除 `PluginRuntimeRegistrationController` 与 service 侧 MCP warmup timer；`AgentRuntimeManager` 不再耦合具体 runtime factory 或内置 runtime 注册 service。
- 最新 maintainability guard 结果：总代码 `+180 / -282 / net -102`，非测试代码 `+179 / -222 / net -43`。

## NPM 包发布记录

未发布 NPM 包；本次状态为待后续统一发布。
