# Agent Run 旧链路彻底删除方案

## 目标

本次删除的目标是让 agent run 只剩一条标准主链路：

`发送入口 -> AgentRunClient / agentRun.send payload -> ingress agentRun.send -> KernelBranch agent-run owner -> eventBus ncpEvent`

删除后不再保留 legacy agent-run direct execution chain，不再保留 branch/legacy 开关，不再保留旧 root manager 的公开导出、旧 contribution、旧 runtime factory、旧测试入口或旧链路专用 context compaction wrapper。

## 删除范围

- 删除 `NextclawKernel` 中的 `AGENT_RUN_CHAIN` 分支选择，固定装配 `KernelBranch`。
- 删除旧 root agent-run owner：
  - `src/managers/agent-run-request.manager.ts`
  - `src/managers/session-run.manager.ts`
  - `src/managers/agent-runtime.manager.ts`
- 删除旧链路 contribution：
  - `src/contributions/legacy-agent-run`
  - `src/contributions/agent-runtime`
  - `src/contributions/session-context-window`
- 删除仅服务旧链路的 native runtime factory/context builder。
- 删除旧链路测试和依赖旧 root manager 的 server 测试。
- 清理 package public export，避免外部继续 import 旧 owner。

## 保留范围

- 保留 `features/agent-run`，这是当前单一主链路的 agent-run owner。
- 保留 `AgentRunClient` 和 `buildAgentRunSendPayload`，外部入口统一通过它们进入 ingress。
- 保留 `features/ncp-dispatch`、`features/session-request`、gateway/cron/CLI 等发送适配层，但它们只能投递 ingress，不再直连旧 runtime。
- 保留 branch 内部 runtime/session/request managers，因为它们是新链路 owner。
- 保留 `ContextWindowPreviewManager` 和 context compaction preflight service，当前 NCP session 预览和 branch compaction 仍然使用它们。
- 保留历史日志与历史迭代记录，不做追溯清理。

## 实施顺序

1. 先固定 kernel 装配：删除 legacy switch 和旧 manager 实例化，让 kernel 只拥有 `KernelBranch`。
2. 再删除旧实现文件和旧测试，避免公共 API 或测试继续拉起旧链路。
3. 清理 exports 和旧链路专用 wrapper，确保 TypeScript import 边界无法再引用旧 owner。
4. 用 `rg` 扫描代码区残留，重点确认没有旧路径、旧贡献点、旧 branch 开关和旧 root manager import。
5. 跑 TypeScript 与定向测试，确认单一链路仍然可编译、可收发、可流式事件。

## 验收标准

- 代码区不再出现 `LegacyAgentRunContribution`、`AGENT_RUN_CHAIN`、旧 root manager public export、旧 contribution 目录引用。
- `NextclawKernel` 不再构造旧 `AgentRunRequestManager`、旧 `SessionRunManager`、旧 `AgentRuntimeManager`。
- 新链路入口仍通过 `AgentRunClient` 投递 ingress，并通过 event bus 接收 NCP 事件。
- TypeScript 编译通过；agent-run ingress/client 相关定向测试通过。
