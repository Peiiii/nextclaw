# v0.15.41-multi-agent-unified-npm-release

相关文档：

- [Resumable Release Check Plan](../../plans/2026-04-06-resumable-release-check-plan.md)
- [NPM Release Process](../../workflows/npm-release-process.md)

## 迭代完成说明

- 完成最近两天积压变更的一次性统一 NPM 发布，并将 `nextclaw` 提升到 `0.17.0` minor 版本，以承接多 Agent 能力的对外语义升级。
- 将 `scripts/check-release-batch.mjs` 从“整批无状态串行校验”收敛成“同批次可恢复执行器”：按 `name@version` 冻结 batch、为每个包落盘 `build/lint/tsc` checkpoint，并在上游内部依赖变更时自动让下游缓存失效。
- 新增 [`scripts/release-checkpoints.mjs`](/Users/tongwenwen/Projects/Peiiii/nextclaw/scripts/release-checkpoints.mjs)，把 release checkpoint 的读取与解析抽为共享基础设施，避免 `release:check` 与 `release:verify:published` 各自维护一套批次事实来源。
- 让 [`scripts/verify-release-published.mjs`](/Users/tongwenwen/Projects/Peiiii/nextclaw/scripts/verify-release-published.mjs) 在 publish 之后优先回退到最近的 release checkpoint，而不是继续依赖 publish 后已经失真的 tag/changeset 推导结果，彻底打通“发布成功但闭环失败”的结构性卡点。
- 同步完成本轮被治理守卫阻断的目录命名债收敛：解决 file-directory basename collision，并在不改对外入口的前提下收拢若干内部实现目录命名。

## 红区触达与减债记录

### packages/nextclaw-core/src/agent/loop.ts

- 本次是否减债：否。
- 说明：本轮只因为 `thinking.ts -> agent-thinking.ts` 的命名收敛而触达该文件，没有继续把新的会话编排职责叠加进去；热点仍然存在，但至少没有为了发布问题继续向里塞新分支。
- 下一步拆分缝：先拆 session lookup、tool loop orchestration、response finalization 三段。

### packages/nextclaw/src/cli/commands/diagnostics.ts

- 本次是否减债：否。
- 说明：本轮只因为 CLI 命令目录重命名与引用修正而触达该文件，没有在发布补救过程中继续扩张诊断链路；热点债务仍保留。
- 下一步拆分缝：先拆 diagnostics collector、runtime status mapper、user-facing renderer。

## 测试/验证/验收方式

- 语法与脚本校验：
  - `node --check scripts/check-release-batch.mjs`
  - `node --check scripts/release-checkpoints.mjs`
  - `node --check scripts/verify-release-published.mjs`
- 发布闭环验证：
  - `node scripts/verify-release-published.mjs --attempts=2 --delay-ms=1000`
  - 结果：从 checkpoint `0dd3cb6861be7b07` 恢复出本轮批次，确认 npm registry 已存在 `34/34` 个目标版本。
- 仓外冒烟：
  - 在 `/tmp/nextclaw-release-smoke.*` 执行 `pnpm dlx nextclaw@0.17.0 --version`
  - 在 `/tmp/nextclaw-release-smoke.*` 执行 `pnpm dlx nextclaw@0.17.0 --help`
  - 结果：输出版本 `0.17.0`，CLI 帮助正常展示。
- 维护性守卫：
  - `pnpm lint:maintainability:guard`
  - 结果：通过；保留的仅是既有热点 warning。
- 本轮发布前已完成的受影响包校验：
  - `pnpm -C packages/nextclaw-openclaw-compat lint`
  - `pnpm -C packages/nextclaw-openclaw-compat tsc`
  - `pnpm -C packages/nextclaw-server lint`
  - `pnpm -C packages/nextclaw-server tsc`
  - `pnpm -C packages/nextclaw-ui lint`
  - `pnpm -C packages/nextclaw-ui tsc`
  - `pnpm -C packages/nextclaw lint`
  - `pnpm -C packages/nextclaw tsc`

## 发布/部署方式

- 本轮不涉及 migration，也不涉及服务端部署。
- 已执行：
  - `pnpm release:version`
  - `pnpm release:publish`
- 已完成 registry 发布并校验的关键版本：
  - `nextclaw@0.17.0`
  - `@nextclaw/ui@0.12.0`
  - `@nextclaw/server@0.12.0`
  - `@nextclaw/core@0.12.0`
  - `@nextclaw/agent-chat-ui@0.3.0`
  - `@nextclaw/ncp@0.5.0`
  - `@nextclaw/ncp-toolkit@0.5.0`
  - `@nextclaw/openclaw-compat@1.0.0`
- 本轮 publish 过程中已自动生成对应 git tag，无需额外重复执行 tag 补打。

## 用户/产品视角的验收步骤

1. 在任意非仓库临时目录执行 `pnpm dlx nextclaw@0.17.0 --version`，确认能直接拿到 `0.17.0`。
2. 在同一临时目录执行 `pnpm dlx nextclaw@0.17.0 --help`，确认 CLI 命令列表正常输出。
3. 在仓库根目录执行一次 `pnpm release:check`，若前序步骤已经成功且输入未变，应看到大量 `cached success`，而不是整批从零重跑。
4. 若故意修改某个上游内部包后再次执行 `pnpm release:check`，确认只有受影响包及其下游重新校验，其余包继续命中缓存。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。核心问题不是“某个命令慢”，而是发布闭环缺少批次级持久状态；本次直接把无状态整批脚本改成可恢复执行器，并补齐了 publish 后的 checkpoint-based registry 校验。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。没有继续追加第二套批次识别逻辑，而是抽出单一的 release checkpoint 基础设施给 `check` 和 `verify` 共用；同时借这轮发布把 basename collision 的历史结构债继续收拢，而不是在旧结构上再打补丁。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：总代码量净增，但这是把“失败后整批重跑”和“publish 后批次失忆”两处结构性缺陷真正消除所需的最小必要增量。与此同时，本轮删除/重命名了多处冲突目录与旧路径，收敛了命名歧义债，而不是只额外新增脚本。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：更清晰。新增的 `release-checkpoints.mjs` 只承载 checkpoint 事实读取，不负责批次推导、构建执行或 registry 查询；`check-release-batch.mjs` 和 `verify-release-published.mjs` 各自回到单一职责，没有引入新的“万能 release helper”。
- 目录结构与文件组织是否满足当前项目治理要求：基本满足。`scripts/` 目录总文件数仍偏高，但本次新增脚本属于仓库级发布基础设施，且通过共享模块减少了逻辑重复；后续若 release 自动化继续演进，应把 release 相关脚本收拢到更明确的子域。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。独立复核结论为“通过”；无新的补丁式分支扩张，净增主要来自可恢复执行与发布批次事实抽象，已经压到当前可行的最小范围，但下一步仍应继续解决 `verify-release-published` 串行 registry 查询过慢，以及 `nextclaw` CLI 首次安装依赖面过重这两个剩余瓶颈。
