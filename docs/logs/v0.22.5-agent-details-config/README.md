# v0.22.5 Agent Details Config

## 迭代完成说明

本次完成 Agent 管理页的信息查看与编辑职责拆分。

核心交付：

- 新增只读 Agent 详情弹窗，用于查看身份、runtime、上下文窗口、预留上下文、最大工具迭代、默认思考强度、runtime config 和模型覆盖等当前可见事实。
- Agent 卡片操作拆成“查看详情”和“编辑”，避免把浏览 Agent 信息等同于进入 mutation 流程。
- 编辑弹窗保留名称、描述、头像、模型、runtime 等常用字段；高级配置默认收起，并只保留“上下文窗口大小”这一项。
- Agent 卡片不再展示上下文窗口信息，保持卡片摘要轻量；上下文配置只在详情或编辑高级区出现。
- server/core 写入合同收窄为只允许 Agent context window override，详情读模型仍透出完整 profile 字段。
- 详情弹窗已从“分区卡片 + 字段卡片”的嵌套结构改为更宽的全宽分组标题 + 缩进字段网格；字段内部使用同行 label/value，不加字段横线，字段名不截断，来源说明展示在 value 后的括号里，分区之间使用轻量分割线，避免卡片套卡片、字段表格化横线噪音、标题列浪费空间和字号层级混乱。

关键取舍：

- 详情页偏“事实呈现”，不承载写操作。
- 编辑页偏“高频低风险配置”，不暴露 thinking、models、runtime JSON、reserved context、max tool iterations 等低频或易误配字段。
- 前端不复制配置 schema；复杂配置仍由 config/kernel owner 负责，UI 只提交明确允许编辑的字段。

## 测试/验证/验收方式

已通过：

- `pnpm tsc`（`packages/nextclaw-core`）
- `pnpm tsc`（`packages/nextclaw-server`）
- `pnpm tsc`（`packages/nextclaw-ui`）
- `pnpm test src/features/config/utils/agent-profiles.utils.test.ts`（14 tests）
- `pnpm test src/app/router.agents.test.ts`（5 tests）
- `pnpm test src/features/agents/components/__tests__/agents-page.test.tsx`（4 tests）
- `pnpm lint`（`packages/nextclaw-core`，0 errors，既有 warnings）
- `pnpm lint`（`packages/nextclaw-server`，0 errors，既有 warnings）
- `pnpm lint`（`packages/nextclaw-ui`，0 errors，既有 warnings）
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/features/agents/components/agent-details-dialog.tsx packages/nextclaw-ui/src/features/agents/components/__tests__/agents-page.test.tsx docs/logs/v0.22.5-agent-details-config/README.md`

说明：

- `packages/nextclaw-server` 曾运行 `pnpm build` 同步本地 `dist` 类型，便于 `nextclaw-ui` 类型检查读取最新 server API 类型；构建成功，仅有第三方依赖声明相关 warning。
- UI 定向测试覆盖：详情只读入口、从详情进入编辑、高级配置默认收起、高级配置仅展示上下文窗口字段、保存 payload 不包含其它高级字段。
- UI 定向测试补充覆盖：详情弹窗使用 `sm:max-w-2xl`，详情内容使用 `dl` 字段网格，不再出现旧的字段小卡片样式，也不允许 `dl` 回退到 `divide-y` / `border-t` 的字段行分隔形态；section 使用轻量分区分割线和内容缩进，不使用浪费空间的标题列；字段内部必须同行展示，字段名不截断，来源说明必须在 value 内，详情主体字段字号统一为 `text-xs`。
- 当前收尾重跑全量 `pnpm lint:new-code:governance` 已通过。

## 发布/部署方式

不涉及远程部署、数据库 migration 或运行时服务迁移。

已新增 `.changeset/agent-details-context-config.md`，影响：

- `@nextclaw/ui`
- `@nextclaw/server`
- `@nextclaw/core`

本次未执行 NPM 发布；后续随统一 release batch 发布。

## 用户/产品视角的验收步骤

1. 打开 Agent 管理页。
2. 在某个 Agent 卡片的更多菜单中点击“查看详情”，应打开只读详情弹窗。
3. 详情弹窗应能看到上下文窗口大小等配置事实，并标明继承默认或 Agent 覆盖。
4. 在更多菜单中点击“编辑”，应打开编辑弹窗，而不是详情弹窗。
5. 编辑弹窗默认只显示常用字段；展开“高级配置”后，只能看到“上下文窗口大小”。
6. Agent 卡片本身不展示上下文窗口大小。

## 可维护性总结汇总

已使用 `post-edit-maintainability-guard` 与主观复核。

本次是新增用户可见能力，生产代码有净增长；增长主要来自：

- 详情弹窗独立成 `agent-details-dialog.tsx`，避免把只读信息堆进编辑弹窗。
- 详情弹窗内部改为更宽的全宽分组标题 + 缩进字段网格，字段内部同行展示且无分隔线，字段名完整展示，来源说明归属到字段值，分区之间有轻量边界，减少视觉层级、嵌套容器、字段横线噪音、标题列空间浪费和字号层级混乱。
- 高级配置字段独立成 `agent-advanced-config-fields.tsx`，让编辑弹窗保持连接和提交职责。
- server Agent API 类型拆到 `server-api-agent.types.ts`，降低 `server-api.types.ts` 膨胀。
- Agent form shape 和序列化辅助拆到 `features/agents/types` 与 `features/agents/utils`。

本次减债：

- `agent-dialogs.tsx` 从接近预算处下降，编辑弹窗不再承担所有配置展示职责。
- `server-api.types.ts` 净减少，Agent API 类型有独立 owner。
- 新增写入合同收窄为 context window override，避免前端或 API 暗中暴露不该编辑的低频配置。

剩余 warning：

- 当前触达范围 maintainability guard 剩余 warning：`packages/nextclaw-ui/src/features/agents/components/__tests__/agents-page.test.tsx` 本批增长明显；增长来自详情弹窗 read/edit、字段布局、字段名完整展示、来源说明归属 value 等 DOM/CSS 回归断言。
- 当前工作区仍存在与本任务无关的 landing、chat、kernel/context compaction 等改动；本次没有触碰或回退这些无关 WIP。
- `agent-profiles.utils.ts` 接近 400 行预算；后续继续改 Agent profile 时应优先拆分 create/update 或 home/avatar 子 owner。
- `packages/nextclaw-ui/src/shared/lib/api` 和 `packages/nextclaw-server/src/app` 是既有目录预算债务，已有 exception 记录。

## NPM 包发布记录

不涉及 NPM 包发布。

已新增 changeset，状态为待统一发布：

- `@nextclaw/ui`
- `@nextclaw/server`
- `@nextclaw/core`
