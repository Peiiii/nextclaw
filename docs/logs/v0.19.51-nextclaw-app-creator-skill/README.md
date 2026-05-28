# v0.19.51 NextClaw App Creator Skill

## 迭代完成说明

本次迭代将 Panel App 与 Service App 的开发指引收敛成“总入口 + 专项自包含 skill”的结构。

完成内容：

- 新增内置 `nextclaw-app-creator` skill，作为创建 NextClaw 轻量应用的总入口。
- `nextclaw-app-creator` 负责判断应用形态：Panel-only、Service-only、Panel + Service。
- `panel-app-creator` 保持为 Panel App UI 专项 skill，并明确应由总入口判断是否需要配套 Service App。
- `service-app-creator` 保持为 Service App backend actions 专项 skill，并明确应由总入口判断是否需要配套 Panel App。
- 更新内置 skills README，补充三个 NextClaw app 相关 skill 的职责。
- 增加 loader 测试，确认 `nextclaw-app-creator` 可加载，并包含对两个专项 skill、Service Actions、Agent API 与 sessionId 约束的导航。

## 测试/验证/验收方式

已执行：

- `pnpm -C packages/nextclaw-core test -- src/features/agent/features/tests/skills.test.ts`
- `pnpm -C packages/nextclaw-core tsc`
- `pnpm exec eslint packages/nextclaw-core/src/features/agent/features/tests/skills.test.ts`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `git diff --check`

验收覆盖：

- 新总入口 skill 可被 builtin `SkillsLoader` 加载。
- 新总入口 skill 能引导 Panel-only、Service-only、Panel + Service 三种形态。
- 新总入口 skill 能指向 `panel-app-creator` 与 `service-app-creator`。
- 新总入口 skill 保留关键 runtime API 约束：`window.nextclaw.serviceActions.invoke()`、`window.nextclaw.agent.generateObject()`、不外部生成稳定 `sessionId`。

## 发布/部署方式

待执行整体 NPM 正式发布。

## 用户/产品视角的验收步骤

1. 用户提出“帮我做一个 NextClaw 小应用”。
2. Agent 应优先读取 `nextclaw-app-creator`。
3. Agent 根据是否需要 UI、文件读写、外部 API、本地命令或权限动作，选择 Panel-only、Service-only 或 Panel + Service。
4. Agent 再按需读取 `panel-app-creator` 或 `service-app-creator`，而不是在一个超长 skill 里混杂所有细节。

## 可维护性总结汇总

本次不是新增产品 runtime 能力，而是内置 skill 结构治理。

可维护性动作：

- 用 `nextclaw-app-creator` 承接产品级形态判断，避免 Panel App skill 继续承担所有入口判断。
- 保留 `panel-app-creator` 与 `service-app-creator` 的专项自包含性，避免单体大 skill 膨胀。
- 通过测试锁定新总入口的关键导航和约束。

维护性检查结果：

- maintainability guard 通过。
- 非测试代码净增为 0。
- governance 检查通过。

## NPM 包发布记录

待统一发布。
