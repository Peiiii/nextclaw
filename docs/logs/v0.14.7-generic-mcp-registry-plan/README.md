# v0.14.7 Generic MCP Registry Plan

## 迭代完成说明

本次迭代新增一份通用 MCP 能力规划文档，明确 Nextclaw 后续应以“平台级 MCP registry”而不是“某个 runtime 私有 MCP 配置”推进集成能力。

本次完成内容：

- 新增通用 MCP 方案文档，明确 MCP 应作为平台级能力建设，而不是 `codex` 等单一 runtime 特判。
- 在方案层一次性纳入 `stdio`、`http`、`sse` 三类 transport 的统一配置与生命周期边界。
- 明确首期不并行推进其它 runtime adapter，但保留统一 adapter 消费边界，避免后续架构返工。
- 明确推荐的实施顺序为 `registry -> CLI -> lifecycle/diagnostics -> native consumer -> UI/marketplace`。

相关方案文档：

- [Generic MCP Registry Plan](/Users/peiwang/Projects/nextbot/docs/plans/2026-03-19-generic-mcp-registry-plan.md)

## 测试 / 验证 / 验收方式

本次改动仅新增方案文档，未触达项目代码路径。

已执行：

- 结构性自检：确认方案文档与迭代目录均已新增，且迭代目录命名符合 `v<semver>-<slug>` 规范。
- 版本基线检查：扫描 `docs/logs` 有效目录，确认新增版本基于当前最大有效版本 `v0.14.6` 递增到 `v0.14.7`。

不适用：

- `build` 不适用，因为未触达构建链路。
- `lint` 不适用，因为未触达源码或可 lint 文件。
- `tsc` 不适用，因为未触达 TypeScript 代码。
- 冒烟测试不适用，因为本次未引入用户可运行行为改动。

## 发布 / 部署方式

本次迭代仅为方案沉淀，无需发布或部署。

后续若进入实施阶段，建议按方案文档中的阶段顺序推进：

1. 平台级 `mcp` config schema 与 registry
2. `nextclaw mcp` CLI
3. lifecycle 与 diagnostics
4. `native` runtime 首个消费方
5. UI 与 marketplace

## 用户 / 产品视角的验收步骤

1. 打开方案文档，确认目标已明确收敛为“通用 MCP 能力”，而不是 `codex` 私有接法。
2. 确认方案文档中已同时覆盖 `stdio`、`http`、`sse` 三类 transport。
3. 确认方案文档中已明确“暂不并行推进其它 runtime adapter”。
4. 确认方案文档中已给出配置模型、CLI 设计、生命周期、安全边界与实施顺序。
