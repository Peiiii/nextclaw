# v0.14.41 MCP Plan Refactor Alignment

## 迭代完成说明

本次迭代基于项目最近的非 legacy 主链路重构，重新校正了通用 MCP 方案的首个接入点与包边界。

本次补充的核心调整包括：

- 明确当前非 legacy 主链路的核心已经下沉到 `NCP toolkit / agent backend / agent runtime / tool registry`，因此 MCP 首期不应挂到 UI 或 session router 层。
- 明确 native 的首个 MCP consumer 不应被笼统描述为“runtime consumer”，而应更准确地收敛为“tool assembly consumer”。
- 明确 MCP 首期不应直接侵入 `DefaultNcpAgentBackend`、`AgentLiveSessionRegistry`、`NcpSessionRoutesController` 等已趋于纯粹的 session/runtime 生命周期层。
- 在原有 `packages/nextclaw-mcp` 平台级 domain 包之外，新增建议的极薄 NCP-facing adapter 层：
  - `packages/ncp-packages/nextclaw-ncp-mcp`
- 明确 `create-ui-ncp-agent.ts` 与 `nextclaw-ncp-tool-registry.ts` 在首期只应承担薄组合职责，不承接 MCP domain 复杂度。

相关方案文档：

- [Generic MCP Registry Plan](/Users/peiwang/Projects/nextbot/docs/plans/2026-03-19-generic-mcp-registry-plan.md)

## 测试 / 验证 / 验收方式

本次改动仅补充方案文档与新增迭代记录，未触达项目代码路径。

已执行：

- 结构对齐检查：确认方案文档已明确把 native 首期接缝修正为 `NcpToolRegistry / NextclawNcpToolRegistry` 一侧。
- 边界检查：确认方案文档已明确把 backend/session/router/controller/frontend 页面排除在 MCP 首期接入点之外。
- 版本基线检查：扫描 `docs/logs` 有效目录，确认新增版本从当前最大有效版本 `v0.14.40` 递增到 `v0.14.41`。

不适用：

- `build` 不适用，因为未触达构建链路。
- `lint` 不适用，因为未触达源码或可 lint 文件。
- `tsc` 不适用，因为未触达 TypeScript 代码。
- 冒烟测试不适用，因为本次未引入用户可运行行为改动。

## 发布 / 部署方式

本次迭代仅为方案与架构边界对齐，无需发布或部署。

后续若进入实施阶段，建议先按调整后的路径推进：

1. `packages/nextclaw-mcp`
2. `packages/ncp-packages/nextclaw-ncp-mcp`
3. `nextclaw mcp` CLI
4. native tool assembly 薄组合
5. 再考虑其它 consumer

## 用户 / 产品视角的验收步骤

1. 打开方案文档，确认已明确“忽略 legacy，仅看非 legacy 主链路”。
2. 确认文档中已把 native 首期 MCP consumer 改写为 `tool assembly` 而不是泛泛的 runtime 替换。
3. 确认文档中已明确排除 backend/session/router/frontend 作为 MCP 首期接入点。
4. 确认文档中已新增建议的极薄 `packages/ncp-packages/nextclaw-ncp-mcp` 适配层。
