# v0.14.262-topology-governance-report

## 迭代完成说明

- 新增 `scripts/topology-governance-report.mjs` 命令入口，用于输出仓库拓扑治理报告。
- 新增 `scripts/topology-governance-graph.mjs` 与 `scripts/topology-governance-shared.mjs`，将拓扑解析拆成共享解析层、图构建层、CLI 层，避免新增脚本本身变成超长文件。
- 新增根脚本命令：
  - `pnpm report:topology`
  - `pnpm check:topology`
- 首期统计覆盖：
  - 最大 fan-in
  - 最大 fan-out
  - 同 workspace 内的跨层 import 违规
  - 疑似孤儿模块

## 测试/验证/验收方式

- 运行 `pnpm report:topology`
  - 预期输出模块总数、内部依赖边数、跨层 import 违规数、疑似孤儿模块数，以及 top fan-in / fan-out 列表。
- 运行 `node scripts/topology-governance-report.mjs --fail-on-violations`
  - 预期在存在跨层 import 违规时返回非零退出码。
- 运行 `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths scripts/topology-governance-report.mjs scripts/topology-governance-graph.mjs scripts/topology-governance-shared.mjs`
  - 预期确认本次新增脚本未引入新的超长文件或其它 diff-only 维护性阻塞项。

## 发布/部署方式

- 本次改动为仓库治理脚本与根级命令补充，不涉及 npm 发布、服务部署或数据库迁移。
- 合入后开发者可直接在仓库根目录使用：
  - `pnpm report:topology`
  - `pnpm check:topology`

## 用户/产品视角的验收步骤

1. 在仓库根目录执行 `pnpm report:topology`。
2. 确认输出中能看到 `Top fan-in`、`Top fan-out`、`Cross-layer violations`、`Suspected orphans` 四类结果。
3. 执行 `pnpm check:topology`。
4. 确认当仓库存在跨层 import 违规时，命令返回失败，说明该命令可作为后续治理闭环的可选阻断入口。
