# v0.22.44-multi-source-skill-groups

## 迭代完成说明

本批完成 NC-116 的多来源技能合同。技能目录现在由同一个 `SkillsLoader` 统一识别项目、NextClaw workspace、用户全局与内建四类来源；会话技能 API 保留来源身份，聊天框输入 `/` 打开的统一选择器与底部技能选择器都会按来源分组展示，Agent 可用技能索引也按相同来源分组注入。

项目专属技能的标准位置明确为 `<project>/.agents/skills/<skill-name>/SKILL.md`。项目根目录的 `AGENTS.md` 继续由现有 Agent Bootstrap Context owner 加载，不被伪装成技能。实现同时修复了请求级 `requested_skill_refs` 没有合入运行上下文的问题，保证用户从选择器选中的技能真正进入本轮 `Active Skills`。

## 测试/验证/验收方式

- `@nextclaw/core` 技能来源定向测试 10 项通过，覆盖四类来源、顺序、引用和分组索引。
- `@nextclaw/kernel` 上下文合同测试 1 项通过，覆盖项目与 NextClaw `AGENTS.md`、来源说明、分组索引和请求级 Active Skills。
- `@nextclaw/server` 会话技能 API 路由测试 14 项通过，覆盖隔离用户目录下的全局技能返回合同。
- `@nextclaw/ui` 的技能投影与斜杠插件 2 个定向测试文件共 18 项通过；`@nextclaw/agent-chat-ui` 的统一选择器渲染测试确认“技能”筛选可以同时包含多个 `skills:<source>` section，并实际渲染来源分组标题。
- 精确真实基线来自用户报告的 `http://127.0.0.1:5174/chat/sid_bmNwLW1xa21zNGp5LWIzZjM5OGFl`：聊天框输入 `/` 打开的统一选择器只有一个“技能”标题，没有来源分组。根因是 `buildChatSlashItems` 已携带 `groupKey/groupLabel`，但 `buildSlashSkillItems` 又把每条技能强制覆盖成同一个 `sectionKey: skills`。
- 先前在 `http://127.0.0.1:18888/chat` 点击底部“技能”按钮看到四个分组，只证明了另一个 consumer；它不是用户点名的聊天框斜杠选择器，不能作为本项验收证据。该错误验收已经撤销。
- 修复后统一斜杠插件保留来源 section，技能筛选器动态包含全部来源 section key；浏览器自动化当前不能生成该组件要求的原生 `beforeinput` 创建原因，因此本轮没有把自动化插入 `/` 后未打开菜单的结果伪报为可见验收。精确组件链路由“投影 → 插件 → 统一菜单渲染”三层测试闭合，真实入口仍以相同 5174 URL 和“聊天框输入 `/`”为手工验收动作。
- `@nextclaw/core`、`@nextclaw/agent-chat-ui`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/ui` 的 TypeScript 检查通过。
- 五个受影响包的包级 ESLint 均为 0 error；现有 warning 未落在本批新增生产逻辑上。
- `git diff --check` 与 `pnpm check:governance-backlog-ratchet` 通过；`pnpm lint:new-code:governance` 对本批命名、目录、owner、参数修改和 React effect 等检查均通过，但全仓命令最终被并发工作区的 `server-paths.service.ts` 与 `use-server-path-read.ts` 两项 context destructuring 违规拦住，未归因到本批技能分组文件。
- scoped maintainability guard 检查 18 个本批 TypeScript 文件，0 error、7 warning；server 路由测试经夹具收敛后从阻塞态回到 899/900 行预算内。

## 发布/部署方式

本次未执行发布或部署。已新增 `.changeset/multi-source-skill-groups.md`，后续随受影响的六个 NPM 包统一发布。

无数据库、migration 或线上 API 部署操作；用户使用文档与打包资源副本已经通过 `sync-usage-resource` 保持一致。

本地源码实例曾完成构建与重启，但只覆盖了底部技能选择器，不构成聊天框斜杠选择器的验收，也不构成 NPM 或线上发布。

## 用户/产品视角的验收步骤

1. 在绑定项目的会话中分别准备项目 `.agents/skills`、NextClaw workspace `skills`、用户 `~/.agents/skills` 及内建技能。
2. 聚焦聊天输入框并输入 `/`，切到“技能”筛选，确认列表依次看到“项目技能”“NextClaw 技能”“全局技能”“内建技能”分组，且每条技能保留对应来源徽标；不要用点击底部“技能”按钮打开的选择器代验。
3. 选择一个项目技能并发送请求，确认本轮上下文的 `Active Skills` 包含其唯一 ref，项目 `AGENTS.md` 同时出现在 Agent Bootstrap Context 中。
4. 在项目内新增技能时，将其写入 `<project>/.agents/skills/<skill-name>/SKILL.md`，重新加载会话后确认它进入项目技能分组。

## 可维护性总结汇总

- 复用并扩展既有 `SkillsLoader → session API → chat/context` 单一链路，没有新增第二套扫描器、registry 或 UI 数据源。
- 来源分组只是现有技能记录的展示投影；项目 `AGENTS.md` 继续归 bootstrap context owner，避免技能系统与项目指令系统双写。
- 请求级技能选择通过既有 metadata 与 run context 合同闭合，没有在 provider 内读取 UI 私有状态。
- 新增的公共类型从所属 package 正式导出，消费者不维护平行声明。
- 代码增减报告：新增 336 行、删除 75 行、净增 261 行；非测试代码新增 172 行、删除 51 行、净增 121 行。增长来自四来源加载/分组合同、请求级激活修复和公共类型扩展，测试资产占主要增量。
- `post-edit-maintainability-guard` 结论为 0 error、7 warning；警告均为已有目录豁免或接近预算文件。本批没有新增文件型 owner，server 路由测试 899/900、会话输入组件 490/500，后续继续扩展时分别以路由测试迁入 `__tests__`、输入标签/集合投影拆出纯 view-model 为拆分缝。
- `post-edit-maintainability-review` 结论：通过，no maintainability findings。正向动作是复用现有 `ChatSkillPickerOptionGroup` 展示合同、收敛重复技能测试夹具，并显式隔离 global 与 marketplace 安装生命周期；没有靠新增 manager、adapter 或平行扫描器承载功能。
- 验收复盘：本批先后把组件级证据和底部技能选择器误报为聊天框斜杠选择器的可见证据。通用缺口已收敛到 `nextclaw-validation-workflow`：可见 UI 证据必须记录精确 URL/端口、触发手势与目标控件身份；同一数据的相邻 consumer 不能互相代验。未新增窄治理脚本，因为表面身份和原生交互依赖运行时入口，明确的验收合同比静态扫描更可靠。

## NPM 包发布记录

本次未发布 NPM 包，以下包均为 patch、待统一发布：

- `@nextclaw/agent-chat-ui`
- `@nextclaw/core`
- `@nextclaw/kernel`
- `@nextclaw/server`
- `@nextclaw/ui`
- `nextclaw`
