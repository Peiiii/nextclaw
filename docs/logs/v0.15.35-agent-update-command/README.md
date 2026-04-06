# v0.15.35 Agent Update Command

## 迭代完成说明

- 为 CLI 正式补齐 `nextclaw agents update <agent-id>`，不再只支持 `list / new / remove`。
- `agents update` 当前支持更新以下 Agent 元信息：
  - `--name <display-name>`
  - `--description <description>`
  - `--avatar <http-url-or-local-file>`
  - `--json`
- `agents update` 允许更新内建 `main` Agent。
- 对空字符串的处理收敛为明确语义：
  - `--name ""` 清除自定义名称覆盖，恢复到 UI 的默认展示回退
  - `--description ""` 清除描述覆盖
  - `--avatar ""` 清除头像覆盖
- core 层新增 `updateAgentProfile()`，将更新逻辑集中在 Agent profile 单一数据源，而不是继续暴露给用户 `config set agents.list[...]` 这种底层路径。
- 顺手把 avatar 资产处理从 [`agent-profiles.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw-core/src/config/agent-profiles.ts) 拆到 [`agent-avatar.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw-core/src/config/agent-avatar.ts)，把 profile 管理与头像文件处理分开，避免 `agent-profiles.ts` 继续膨胀超预算。
- 更新 [docs/USAGE.md](/Users/tongwenwen/Projects/Peiiii/nextclaw/docs/USAGE.md)，把 `agents update` 纳入正式命令说明，并明确建议优先用该命令修改 Agent 名称/描述/头像。
- 补齐 self-management guide 同步链路，避免开发态/运行态 AI 继续读取旧命令：
  - 手动执行 `node packages/nextclaw/scripts/sync-usage-resource.mjs`，将 `docs/USAGE.md` 同步到 [`packages/nextclaw/resources/USAGE.md`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw/resources/USAGE.md)
  - 更新 [`nextclaw-self-manage/SKILL.md`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw-core/src/agent/skills/nextclaw-self-manage/SKILL.md)，把 Agent 高频意图与执行规则补齐为 `list/new/update/remove`
  - 在 [`AGENTS.md`](/Users/tongwenwen/Projects/Peiiii/nextclaw/AGENTS.md) 新增项目规则，要求今后凡触达自管理命令表面，必须同步作者源 guide、运行时 guide 与 self-manage skill，并在 repo 开发态手动运行同步脚本

## 测试/验证/验收方式

- core 测试：
  - `pnpm -C packages/nextclaw-core test -- --run src/config/agent-profiles.test.ts`
- CLI 测试：
  - `pnpm -C packages/nextclaw test -- --run src/cli/commands/agent/agent-commands.test.ts`
- 类型检查：
  - `pnpm -C packages/nextclaw-core tsc`
  - `pnpm -C packages/nextclaw tsc`
- 可维护性守卫：
  - `pnpm lint:maintainability:guard`
- guide 同步：
  - `node packages/nextclaw/scripts/sync-usage-resource.mjs`
- 结果说明：
  - 上述命令均已通过
  - 守卫仍提示若干既有目录/大文件预算 warning，但无新增 error
  - `sync-usage-resource` 已执行，运行时 guide 与作者源 guide 已同步
  - 未直接通过 `dev:build` 做 CLI 入口冒烟，因为当前工作区同时存在未完成的 `self-cli` 相关改动；本次以 core + CLI 命令层测试覆盖新能力主链

## 发布/部署方式

- 本次未执行发布或部署。
- 后续随 `nextclaw` / `@nextclaw/core` 常规发布流程一起发布即可。
- 不涉及数据库、migration 或远程环境变更。

## 用户/产品视角的验收步骤

1. 执行 `nextclaw agents list --json`，确认目标 Agent 已存在。
2. 执行：
   `nextclaw agents update engineer --description "负责工程实现与代码改造" --json`
3. 确认返回 JSON 中：
   - `agent.id = "engineer"`
   - `agent.description = "负责工程实现与代码改造"`
   - `restartRequired = true`
4. 再执行 `nextclaw agents update main --avatar "https://example.com/main.png" --json`，确认内建 `main` 也可被更新。
5. 执行 `nextclaw agents list --json` 或打开 `/agents` 页面，确认更新后的名称/描述/头像已经体现在展示层。
6. 如服务正在运行，执行 `nextclaw restart`，确认运行时使用新的 Agent 元信息。

## 可维护性总结汇总

- 是否已尽最大努力优化可维护性：是。没有把 `update` 做成对 `config set` 的命令级包装，而是补到 Agent profile 的正式核心能力里。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。相比继续让用户记住 `agents.list[<index>]` 这样的底层路径，`agents update` 直接把能力提升为一等命令，删掉了不必要的心智负担。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：部分做到。虽然为了补齐缺失能力新增了最小必要代码，并新增 [`agent-avatar.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw-core/src/config/agent-avatar.ts)，但同时把 [`agent-profiles.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw-core/src/config/agent-profiles.ts) 从超预算压回预算内，并避免继续在 CLI 层堆配置路径特判。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。profile 更新留在 core，CLI 只负责命令参数与重启提示，avatar 文件处理独立拆出，边界更清楚。
- 目录结构与文件组织是否满足当前项目治理要求：部分未满足但本次已控制恶化。`packages/nextclaw-core/src/config` 目录仍超过预算，本次新增 `agent-avatar.ts` 属于为降低单文件复杂度而做的必要拆分；CLI 测试已放到 [`commands/agent`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw/src/cli/commands/agent) 子目录，未继续把 `commands` 根目录摊平。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已执行独立复核。
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - no maintainability findings
  - 可维护性总结：这次改动不仅补齐了 `agents update`，也把自管理 guide 的作者源、运行时副本和 AI skill 提示重新收敛成同一套口径，减少了“功能已改但 AI 仍按旧文档行动”的隐性维护风险。保留债务主要是 repo 开发态仍依赖手动执行同步脚本，这属于当前机制的显式约束，已通过项目规则固化。
