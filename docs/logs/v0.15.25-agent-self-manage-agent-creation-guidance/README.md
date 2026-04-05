# v0.15.25-agent-self-manage-agent-creation-guidance

## 迭代完成说明

- 补齐了 NextClaw AI 自管理链路里对 Agent 创建能力的正式暴露，避免 AI 知道有多 Agent 能力，却不知道该如何实际创建新的 Agent。
- 更新了 [docs/USAGE.md](../../../USAGE.md)，把自管理范围明确扩展到 `agents`，并新增“Agent creation flow for AI self-management”操作手册，给出 `nextclaw agents new` 的标准执行与验证闭环。
- 继续收敛了 [docs/USAGE.md](../../../USAGE.md) 里的旧多 Agent 叙述，避免 AI 再把“创建 Agent”误导到 `Routing & Runtime`、`nextclaw config set agents.list ...`、`contextTokens`、`maxToolIterations` 这条旧路径。
- 同步更新了 [packages/nextclaw/templates/USAGE.md](../../../../packages/nextclaw/templates/USAGE.md)，保证新初始化 workspace 里的 `USAGE.md` 也带上同样指引。
- 收敛了内建 skill 加载语义：[packages/nextclaw-core/src/agent/skills.ts](../../../../packages/nextclaw-core/src/agent/skills.ts) 现在直接加载包内 builtin skills，并在同名情况下屏蔽 workspace 旧副本继续劫持运行时。
- 删除了 workspace 初始化时对 builtin skill 的复制种子：[packages/nextclaw/src/cli/workspace.ts](../../../../packages/nextclaw/src/cli/workspace.ts) 不再把 `nextclaw-self-manage` 等内建技能复制进 `skills/`。
- 更新了内建 skill [packages/nextclaw-core/src/agent/skills/nextclaw-self-manage/SKILL.md](../../../../packages/nextclaw-core/src/agent/skills/nextclaw-self-manage/SKILL.md)，把它收缩成稳定路由 skill：只负责把自管理意图引到 `USAGE.md`，不再承载易变的细碎操作说明。
- 更新了系统提示注入位置 [packages/nextclaw-core/src/agent/context.ts](../../../../packages/nextclaw-core/src/agent/context.ts) 与 [packages/nextclaw-core/src/agent/skill-context.ts](../../../../packages/nextclaw-core/src/agent/skill-context.ts)，明确 self-management 意图优先于 generic skills，避免 “create agent” 被错误路由到 `skill-creator`。
- 进一步补上了“历史复制的 builtin skill 已废弃”的正式说明：在 [docs/USAGE.md](../../../USAGE.md) 与 [packages/nextclaw-core/src/agent/context.ts](../../../../packages/nextclaw-core/src/agent/context.ts) 中明确这类 workspace 残留文件不是当前真相源。
- 收敛了 builtin marketplace skill 语义：[packages/nextclaw/src/cli/skills/marketplace.ts](../../../../packages/nextclaw/src/cli/skills/marketplace.ts) 与 [packages/nextclaw/src/cli/commands/service.ts](../../../../packages/nextclaw/src/cli/commands/service.ts) 不再把 builtin skill 复制进 workspace，而是统一视为“已内建可用”。
- 更新了 workspace 模板 [packages/nextclaw/templates/AGENTS.md](../../../../packages/nextclaw/templates/AGENTS.md)，避免新工作区的 AI 行为说明继续漏掉 `agents`。
- 更新了会话技能视图与前端类型，让 builtin/project/workspace 三种来源在 UI 契约上保持一致，但不再通过 workspace 副本表达 builtin 身份。

## 测试/验证/验收方式

- 文档模板同步：
  - `node packages/nextclaw/scripts/sync-usage-template.mjs`
  - 结果：通过，`docs/USAGE.md` 已同步到 `packages/nextclaw/templates/USAGE.md`
- 文档核对：
  - 检查 `docs/USAGE.md` 与 `packages/nextclaw/templates/USAGE.md`
  - 结果：创建 Agent 的正式路径已收敛为 `Agents` 页面或 `nextclaw agents new`；同时 `Skill loading contract` 已更新为 “builtin 自动可用，workspace `skills/` 只承载自定义/市场技能”
- Core 测试：
  - `pnpm -C packages/nextclaw-core test -- --run src/agent/tests/context.test.ts src/agent/tests/skills.test.ts`
  - 结果：通过
- CLI 测试：
  - `pnpm -C packages/nextclaw test -- --run src/cli/workspace.test.ts`
  - 结果：通过
- Core 类型检查：
  - `pnpm -C packages/nextclaw-core tsc`
  - 结果：通过
- Server / UI / CLI 类型检查：
  - `pnpm -C packages/nextclaw-server tsc`
  - `pnpm -C packages/nextclaw-ui tsc`
  - `pnpm -C packages/nextclaw tsc`
  - 结果：通过
- 新代码治理：
  - `pnpm lint:new-code:governance`
  - 结果：通过；仅保留既有 `packages/nextclaw-ui/src/components/chat/ncp` 目录 warning
- 定向可维护性检查：
  - 首轮 `pnpm lint:maintainability:guard`
  - 结果：发现一个新增错误：`packages/nextclaw/src/cli/skills/marketplace.ts` 的安装函数超出函数预算
  - 处理：已继续拆分为“目录解析 / builtin 结果 / 目标目录准备 / 文件写入 / 完整性校验”几个 helper
  - 复跑情况：`pnpm lint:new-code:governance` 通过；`check-maintainability.mjs` 在当前环境复跑时持续卡住，未返回最终文本结果，因此这里如实记录为“新增错误已修复，但未拿到守卫二次完整输出”

## 发布/部署方式

- 本次不涉及独立部署动作。
- 若后续发布 `nextclaw` / `@nextclaw/core`，本次改动会随包内模板与 built-in skill 一并进入发布产物。
- 不适用项：
  - 数据库 migration：不适用
  - 服务部署：不适用
  - 线上 API 冒烟：不适用

## 用户/产品视角的验收步骤

1. 打开 [docs/USAGE.md](../../../USAGE.md)，确认 `AI Self-Management Contract` 已包含 `agents`。
2. 在同一文档中确认存在 “Agent creation flow for AI self-management” 章节，并包含 `nextclaw agents new <agent-id> --json`。
3. 确认文档不再把“创建 Agent”引导到 `Routing & Runtime`、`nextclaw config set agents.list ...`、`contextTokens`、`maxToolIterations`。
4. 在同一文档中确认 `Skill loading contract` 已明确 builtin skills 自动可用，不再要求复制到 workspace。
5. 打开 [packages/nextclaw-core/src/agent/skills/nextclaw-self-manage/SKILL.md](../../../../packages/nextclaw-core/src/agent/skills/nextclaw-self-manage/SKILL.md)，确认它现在只保留“先读 `USAGE.md`、不要被 generic skill 抢路由、执行后验证”这类稳定规则。
6. 打开 [packages/nextclaw-core/src/agent/context.ts](../../../../packages/nextclaw-core/src/agent/context.ts)，确认系统提示里的 self-management guide 已显式要求先读 `USAGE.md`，且不要先打开无关 generic skills。
7. 在一个已有旧 workspace skill 副本的环境里，让 NextClaw AI 执行“帮我创建一个新的 Agent”，确认它优先引用 `USAGE.md` / self-manage skill，并能给出或执行 `nextclaw agents new ...` 的正式路径，而不是继续发明配置写法。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。本次真正解决的是“builtin / workspace / USAGE / self-manage skill 各说各话”的根因，而不是继续往旧链路上打补丁。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。删除了 builtin skill seed 机制，删除了 builtin marketplace skill 的复制安装语义，收缩了 `nextclaw-self-manage` 的职责，把动态说明收回到单一 `USAGE.md`。
- 本次额外减债：builtin skill 现在直接从包内加载，workspace 同名旧副本不会再劫持运行时；这笔债比“继续更新 skill 文案”更根本。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：整体控制在最小必要范围内。虽然新增了 2 个测试文件与少量 helper，但同时删除了整套 builtin seed / 复制路径，并把一个超长安装函数继续拆小，没有引入新的平行机制。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。现在职责更清楚：`SkillsLoader` 负责 builtin 解析，`WorkspaceManager` 只负责模板目录，`nextclaw-self-manage` 只做稳定路由，`USAGE.md` 承载动态操作知识。
- 目录结构与文件组织是否满足当前项目治理要求：基本满足。本次新增测试文件位于既有测试目录，没有新增新的热点扁平目录；治理检查仅保留既有 `packages/nextclaw-ui/src/components/chat/ncp` warning。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。独立复核结论为 `通过`，`no maintainability findings`；唯一被守卫指出的新增问题是 `packages/nextclaw/src/cli/skills/marketplace.ts` 函数预算超标，已继续拆解后修复。保留债务为若干既有大文件/大目录 warning，与本次问题域无直接新增关系。
