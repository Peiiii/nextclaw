# v0.16.54-marketplace-skills-dual-domain-cli

## 迭代完成说明

- 为 skill CLI 引入了明确的双域模型：
  - 本地已安装域：`nextclaw skills installed`、`nextclaw skills info <selector>`
  - Marketplace 目录域：`nextclaw marketplace skills search|info|recommend|install`
- 保留了现有 `nextclaw skills install <slug>` 作为兼容安装入口，但 CLI 输出和 self-management guide 现在默认引导到显式的 marketplace 域。
- 新增了 [`docs/plans/2026-04-17-marketplace-skills-dual-domain-cli-design.md`](../../plans/2026-04-17-marketplace-skills-dual-domain-cli-design.md)，把“双域模型而非模糊 skills list”定为本次正式方案。
- 新增了 [`packages/nextclaw/src/cli/commands/skills.controller.ts`](../../../packages/nextclaw/src/cli/commands/skills.controller.ts)，把 skill 与 marketplace skill 命令从 [`packages/nextclaw/src/cli/index.ts`](../../../packages/nextclaw/src/cli/index.ts) 和 [`packages/nextclaw/src/cli/runtime.ts`](../../../packages/nextclaw/src/cli/runtime.ts) 中抽出，减少入口文件继续膨胀。
- 新增了 [`packages/nextclaw/src/cli/skills/skills-query.service.ts`](../../../packages/nextclaw/src/cli/skills/skills-query.service.ts)，统一承载本地 skill 查询和 marketplace 远端查询。
- 对 marketplace skill 的 CLI 视图增加了安装命令归一化：即便上游 API 仍返回旧命令，也会在 CLI JSON 结果里归一成 `nextclaw marketplace skills install <slug>`。
- `marketplace skills info <slug>` 在远端条目存在但 `content` 缺失时不再整体失败，而是返回 `item + content: null + contentUnavailableReason`，避免 AI 因上游内容缺失而无法稳定查询目录。
- 更新了以下文档与自管理指引，使 AI 正式把“已安装”和“marketplace 目录”视作两种不同域：
  - [`docs/USAGE.md`](../../../docs/USAGE.md)
  - [`packages/nextclaw/resources/USAGE.md`](../../../packages/nextclaw/resources/USAGE.md)
  - [`packages/nextclaw-core/src/agent/skills/nextclaw-self-manage/SKILL.md`](../../../packages/nextclaw-core/src/agent/skills/nextclaw-self-manage/SKILL.md)
  - [`docs/feature-universe.md`](../../../docs/feature-universe.md)
  - [`docs/prd/current-feature-list.md`](../../../docs/prd/current-feature-list.md)

## 测试 / 验证 / 验收方式

已通过：

- `pnpm -C packages/nextclaw exec vitest run src/cli/skills/skills-query.service.test.ts src/cli/skills/marketplace.install.test.ts`
- `pnpm -C packages/nextclaw tsc`
- `pnpm -C packages/nextclaw exec tsx src/cli/index.ts skills installed --json`
- `pnpm -C packages/nextclaw exec tsx src/cli/index.ts skills info nextclaw-self-manage --json`
- `pnpm -C packages/nextclaw exec tsx src/cli/index.ts marketplace skills search --query weather --page 1 --page-size 3 --json`
- `pnpm -C packages/nextclaw exec tsx src/cli/index.ts marketplace skills info weather --json`
- `pnpm -C packages/nextclaw exec tsx src/cli/index.ts marketplace skills recommend --limit 3 --json`
- `node packages/nextclaw/scripts/sync-usage-resource.mjs`

已执行但未能全绿：

- `pnpm lint:maintainability:guard`

阻塞原因：

- 当前 worktree 存在本次改动之外的既有未提交变更，守卫在全量 diff 上被这些文件阻断：
  - `packages/nextclaw-hermes-acp-bridge/src/hermes-acp-route-bridge/nextclaw-hermes-acp-runtime-route.py`
  - `packages/nextclaw-hermes-acp-bridge/src/hermes-acp-route-bridge/nextclaw-hermes-acp-session-snapshot.py`
  - `packages/nextclaw-ncp-runtime-stdio-client/src/test-fixtures/failing-agent.mjs`
  - 以及已被用户修改中的 `packages/nextclaw/src/cli/runtime.ts`
- 本次变更相关的针对性 ESLint 已通过到“仅 warnings、无 errors”的状态：
  - `pnpm -C packages/nextclaw exec eslint src/cli/index.ts src/cli/runtime.ts src/cli/commands/skills.controller.ts src/cli/types.ts src/cli/skills/skills-query.service.ts src/cli/skills/skills-query.service.test.ts`

## 发布 / 部署方式

- 无需单独部署 worker 或 UI。
- 若要把这批能力带入可发布 CLI 包，执行：
  - `pnpm -C packages/nextclaw build`
- 若要让运行时内置 guide 同步，保持 [`docs/USAGE.md`](../../../docs/USAGE.md) 为单一编辑源，并在打包前运行：
  - `node packages/nextclaw/scripts/sync-usage-resource.mjs`

## 用户 / 产品视角的验收步骤

1. 在本地执行 `nextclaw skills installed --json`，确认返回的是当前实例已经具备的 skill，而不是 marketplace 目录。
2. 执行 `nextclaw skills info nextclaw-self-manage --json`，确认读取的是本地 builtin skill 的详情与内容。
3. 执行 `nextclaw marketplace skills search --query weather --json`，确认返回的是远端 marketplace 目录数据。
4. 检查第 3 步输出里的 `install.command`，确认已规范为 `nextclaw marketplace skills install weather`，而不是旧的 `nextclaw skills install ...`。
5. 执行 `nextclaw marketplace skills info weather --json`，确认即使 `content` 不可用，也会返回 `item`，同时 `content` 为 `null`，并带 `contentUnavailableReason`。
6. 执行 `nextclaw marketplace skills recommend --limit 3 --json`，确认能返回远端推荐视图。
7. 打开 [`packages/nextclaw-core/src/agent/skills/nextclaw-self-manage/SKILL.md`](../../../packages/nextclaw-core/src/agent/skills/nextclaw-self-manage/SKILL.md)，确认 AI 自管理指引已把 installed 与 marketplace skills 分成两个域。

## 可维护性总结汇总

### 长期目标对齐 / 可维护性推进

- 本次是否顺着“代码更少、架构更简单、边界更清晰、复用更通用、复杂点更少”的长期方向推进了一小步：是。
- 关键推进点不是“只加命令”，而是把原本语义混杂的 skill 查询入口拆成了本地已安装域与 marketplace 目录域，并把新命令从 `index.ts` / `runtime.ts` 抽到独立 owner 文件，减少入口文件继续膨胀。
- 剩余阻碍在于仓库当前 worktree 存在本次改动之外的治理债务与未提交变更，导致全量维护性守卫无法完全作为这次改动的纯净信号。

### 可维护性复核结论

- 结论：保留债务经说明接受
- 本次顺手减债：是
- no maintainability findings

### 代码增减报告

- 新增：1213 行
- 删除：247 行
- 净增：+966 行

说明：

- 该统计包含本次新增的设计文档、迭代文档、运行时 guide 同步与新命令实现文件。

### 非测试代码增减报告

- 新增：757 行
- 删除：232 行
- 净增：+525 行

说明：

- 该统计排除了 `*.test.*`。
- 本次属于真实新增能力，不是单纯重命名；净增主要来自：
  - 新的 skill 查询 service
  - 新的 skills command owner
  - 文档 / self-management contract 同步
- 在接受增长前，已经同步删除并抽离了大量原本堆在 `index.ts` / `runtime.ts` 里的命令实现，避免继续把高热点文件做大。

### 强制判断

- 本次是否已尽最大努力优化可维护性：是，但受到当前 worktree 里与本次无关的既有变更阻断，无法让全量维护性守卫完全变绿。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。尽管总量净增，但已通过抽取 `skills.controller.ts` 让 `index.ts` 净减 48 行、`runtime.ts` 净减 177 行。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：热点大文件显著下降，但目录文件数有净增长，因为本次引入了新的独立 owner 文件与测试文件；这部分增长用于换取更清晰的职责边界，且已同步偿还 `index.ts` / `runtime.ts` 的膨胀债务。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。CLI 查询逻辑集中到 `SkillsQueryService`，命令装配与输出集中到 `SkillsCommands`，避免继续在 `CliRuntime` 中补丁式追加。
- 目录结构与文件组织是否满足当前项目治理要求：部分满足。当前 `packages/nextclaw/src/cli` 与 `packages/nextclaw/src/cli/commands` 目录仍处于预算警戒或超限状态，本次未继续新增扁平入口文件，而是把增量收敛到已有命令域目录中。后续整理入口是继续拆分 `runtime.ts` 的残余职责，并为 `commands/` 建立更细的子域分层。
- 若本次涉及代码可维护性评估，是否基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写：是，本节基于实现完成后的独立复核，而非只复述守卫输出。

### 可维护性总结

- 这次改动虽然新增了能力代码，但不是简单堆命令，而是把最容易继续膨胀的 `index.ts` 与 `runtime.ts` 明显收缩，并让 skill 查询职责首次形成稳定边界。
- 保留的债务主要是仓库当前 worktree 中与本次无关的治理阻断，以及 `runtime.ts` 本身仍然超预算；下一条最自然的整理 seam 是继续把剩余 runtime orchestration 从 `CliRuntime` 中抽离到更细的命令 owner。
