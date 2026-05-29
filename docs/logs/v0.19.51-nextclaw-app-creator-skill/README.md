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
- 后续根据真实 Panel App 创建失败案例继续收敛：内置开发 skill 只教目录式 Panel App，`panel-app.json` 成为标题、入口、图标、Agent capabilities 和 Service action allowlist 的唯一事实源。

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
- Panel App creator skill 不再引导 `.panel.html`、HTML manifest meta、`nextclaw-panel-actions` 或 `nextclaw-panel-capabilities`；目录式 `panel-app.json.actions` 与 `panel-app.json.capabilities` 是唯一推荐路径。

## 发布/部署方式

已执行整体 NPM 正式发布：

- `pnpm release:auto:changeset`
- `pnpm release:version`
- `pnpm release:publish`
- `pnpm release:verify:published`
- `npm view nextclaw dist-tags --json`
- `npm view nextclaw version --json`

发布结果：

- `nextclaw@0.19.32` 已发布到 `latest`。
- `@nextclaw/core@0.12.26` 已发布。
- `@nextclaw/ui@0.12.36` 已发布。
- 本批次共 46 个 public workspace package 已发布并通过 registry 验证。

## 用户/产品视角的验收步骤

1. 用户提出“帮我做一个 NextClaw 小应用”。
2. Agent 应优先读取 `nextclaw-app-creator`。
3. Agent 根据是否需要 UI、文件读写、外部 API、本地命令或权限动作，选择 Panel-only、Service-only 或 Panel + Service。
4. Agent 再按需读取 `panel-app-creator` 或 `service-app-creator`，而不是在一个超长 skill 里混杂所有细节。
5. 新建 Panel App 时必须创建 `panels/<app-id>.panel/panel-app.json`，并把 `actions`、`capabilities` 都写入该 manifest。

## 可维护性总结汇总

本次不是新增产品 runtime 能力，而是内置 skill 结构治理。

可维护性动作：

- 用 `nextclaw-app-creator` 承接产品级形态判断，避免 Panel App skill 继续承担所有入口判断。
- 保留 `panel-app-creator` 与 `service-app-creator` 的专项自包含性，避免单体大 skill 膨胀。
- 通过测试锁定新总入口的关键导航和约束。
- 删除 skill 层面的多形态教学，避免 AI 在目录式 Panel App 里把 Service action allowlist 写到 HTML meta，导致宿主识别为未声明。

维护性检查结果：

- maintainability guard 通过。
- 非测试代码净增为 0。
- governance 检查通过。

## NPM 包发布记录

已统一发布完整 public workspace stable 批次。

关键包：

- `nextclaw@0.19.32`
- `@nextclaw/core@0.12.26`
- `@nextclaw/ui@0.12.36`

发布后验证：

- `pnpm release:verify:published`：46/46 package versions published。
- `npm view nextclaw dist-tags --json`：`latest` 指向 `0.19.32`。
- 临时目录真实安装 `nextclaw@latest` 成功。
- 安装包中存在 `resources/update-bundle-public.pem`、launcher entry 和 app entry。
- 隔离 `NEXTCLAW_HOME` 执行 `nextclaw update --check` 成功，结果为 runtime already up to date。

### 后续修正发布

为避免 AI 继续生成目录式 Panel App 但把 Service action allowlist 写入 HTML meta，本迭代后续又发布一次正式版本：

- `nextclaw@0.19.33`
- `@nextclaw/core@0.12.27`
- `@nextclaw/ui@0.12.37`

验证结果：

- `pnpm release:publish`：发布 46 个 public workspace package。
- `pnpm release:verify:published`：46/46 package versions published。
- `npm view nextclaw dist-tags --json`：`latest` 指向 `0.19.33`。
- 临时目录真实安装 `nextclaw@latest` 成功，`nextclaw --version` 输出 `0.19.33`。
- 安装包中存在 `resources/update-bundle-public.pem`、launcher entry 和 app entry。
- 隔离 `NEXTCLAW_HOME` 执行 `nextclaw update --check` 成功，结果为 runtime already up to date。
