# Tool Manager Contribution Refactor

## 迭代完成说明

- 将空壳 `ToolManager` 替换为真实工具 owner：负责 provider 注册、按运行上下文创建 `NcpToolRegistry`、执行 tool call、过滤不可用 core tool。
- 删除旧 `NextclawNcpToolRegistry` 文件，不保留新旧双轨。
- 新增单一 `ToolContribution`，直接依赖 `NextclawKernel`，注册默认 agent 可用工具，包括 file / exec / web / message / cron / session / memory / gateway / extension / session_search。
- `NextclawKernel` 暴露 `toolManager`，并提供 `provideGatewayController()` / `getGatewayController()`；service 创建 gateway controller 后直接 provide 给 kernel。
- `AgentRuntimeManager` 删除 `gatewayController` 字段和 `connectGatewayController()`；`NativeAgentRuntimeFactory` 不再接触 gateway controller，只通过 `toolManager.createRuntimeRegistry()` 获取运行期 registry。
- `asset` / MCP tools 保留为 native runtime 私有 additional tools，仍进入同一条 `ToolManager` registry 路径。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-kernel exec eslint src/app/nextclaw-kernel.ts src/managers/tool.manager.ts src/managers/tool.manager.test.ts src/managers/agent-runtime.manager.ts src/contributions/tool-contribution/index.ts src/features/native-runtime/index.ts src/features/native-runtime/services/native-agent-runtime-factory.service.ts src/features/native-runtime/services/nextclaw-ncp-context-builder.service.ts vitest.config.ts`
- `pnpm -C packages/nextclaw-service exec eslint src/shared/services/gateway/nextclaw-gateway-runtime.service.ts`
- `pnpm -C packages/nextclaw-kernel exec vitest run src/managers/tool.manager.test.ts`
- `pnpm -C packages/nextclaw-kernel build && pnpm -C packages/nextclaw-service tsc`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
- `pnpm lint:new-code:governance -- ...`
- `pnpm check:governance-backlog-ratchet`

## 发布/部署方式

不涉及部署。涉及 `@nextclaw/kernel` 与 `@nextclaw/service` 源码边界变更，后续随统一包发布流程发布。

## 用户/产品视角的验收步骤

- 启动 gateway runtime 后，gateway controller 应由 service provide 到 kernel。
- 发起 native agent run，默认工具列表应保持原行为，gateway tool 能读取当前 controller。
- asset / MCP tools 应继续由 native runtime 运行期追加，`resolveOpenAiToolsForRuntime()` 的工具解析路径保持可用。

## 可维护性总结汇总

- 已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 标准完成复核。
- 非功能改动的非测试代码净增为 `0` 行：新增 `ToolManager` / `ToolContribution` 由删除旧 `NextclawNcpToolRegistry` 与移除 `AgentRuntimeManager` gateway 搬运链路抵消。
- 正向减债动作：职责收敛与删除。工具 owner 回到 kernel `ToolManager`，默认工具组装回到单一 contribution，`NativeAgentRuntimeFactory` 与 `AgentRuntimeManager` 不再承担 gateway/tool 具体装配职责。
- 已知保留债务：`asset` / MCP tools 暂作为 native runtime 私有 additional tools 接入，后续若 asset store / MCP runtime support 成为 kernel 级能力，再评估迁入 contribution。

## NPM 包发布记录

未发布 NPM 包；本次状态为待后续统一发布。
