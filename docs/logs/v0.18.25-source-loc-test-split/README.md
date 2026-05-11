# v0.18.25-source-loc-test-split

## 迭代完成说明

- 根因：`Source LOC` headline 之前统计 `src/` 下所有代码文件，测试文件也进入主 LOC，容易把补测试误判为生产复杂度增长；同时默认 source profile 仍保留 `.vitepress` 候选目录，语义上不够收敛。
- 修复：默认 source profile 移除 `.vitepress`；metrics snapshot 将 `codeLines` 收敛为生产 LOC，并新增 `testCodeLines` 单独输出。
- Project Pulse 已适配生产 LOC / 测试 LOC 展示，生成数据同步刷新。
- 补充修复：Project Pulse 曲线之前仍直接读取 `history.jsonl` 的旧总 LOC，导致当天曲线继续显示 `245505`；现在生成链路会用 `latest.json` 的生产 LOC 覆盖当天历史点，并输出测试 LOC 独立趋势。
- 文档站信息架构补齐：Project Pulse 合并进同一套侧边栏目录；顶部保留 `Project/项目` 入口，侧边栏也保留 `Project/项目` 目录，避免丢掉原有导航入口。
- 治理补齐：`apps/docs/.vitepress/data/*.generated.mjs` 属于文档站生成物，file-role-boundary 不再要求它使用业务角色后缀，并补了回归测试。
- 失败复盘：第一次修复只验了 hero 当前值，没有把趋势曲线的最后一点纳入验收；本次把这个缺口落到 `scripts/project-pulse/data-core.test.mjs`，后续数据 owner 测试会自动覆盖同类回归。

## 测试/验证/验收方式

- `node --test scripts/metrics/code-volume-metrics.test.mjs scripts/governance/lint-new-code-file-role-boundaries.test.mjs`：通过。
- `node --test scripts/project-pulse/data-core.test.mjs scripts/metrics/code-volume-metrics.test.mjs`：通过，覆盖历史旧总 LOC 被最新生产 LOC 替换、测试 LOC 独立读取。
- Targeted ESLint：通过。
- `pnpm -C apps/docs build`：通过；保留 VitePress chunk size warning。
- Project Pulse 生成数据验收：`hero.currentLoc = 187293`，`trends.locDaily.at(-1).value = 187293`，`trends.testLocDaily.at(-1).value = 59141`。
- `pnpm exec eslint apps/docs/.vitepress/config.ts --max-warnings=0`：通过。
- `pnpm -C apps/docs build`：通过，确认统一侧边栏配置可正常构建；保留 VitePress chunk size warning。
- `pnpm deploy:docs`：通过，Cloudflare Pages 部署完成，最新预览地址 `https://f6e320c3.nextclaw-docs.pages.dev`。
- 线上冒烟：`https://f6e320c3.nextclaw-docs.pages.dev/zh/project/project-pulse` 与 `https://docs.nextclaw.io/zh/project/project-pulse` 均返回 `200`；预览页和正式域名 HTML 中确认顶部仍有 `项目`，侧边栏也有 `项目` 与 `Project Pulse`。
- `node scripts/governance/lint-new-code-governance.mjs --staged`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `post-edit-maintainability-guard --non-feature --paths ...`：通过，非测试代码净增 `-2`。
- 补充修复的标准 maintainability guard：通过，非测试代码净增 `+37`；原因是新增用户可见的测试 LOC 趋势卡与数据 owner 回归测试，未按纯非功能改动口径关闭。

## 发布/部署方式

已部署到 Cloudflare Pages 项目 `nextclaw-docs`：

- 预览地址：`https://f6e320c3.nextclaw-docs.pages.dev`
- 正式域名：`https://docs.nextclaw.io`
- 本次不涉及数据库 migration、后端 worker 发布或 NPM 包发布。

## 用户/产品视角的验收步骤

1. 运行 `pnpm metrics:local`。
2. 确认输出包含 `Production code lines (LOC)` 与 `Test code lines`。
3. 打开 Project Pulse，确认主 LOC 文案与生产 LOC 曲线最后一点都是 `187293`，测试 LOC 单独显示为 `59141`。
4. 打开任意指南页与 `/zh/project/project-pulse`，确认顶部仍有 `项目`，左侧目录也包含同一组 `项目` 入口。

## 可维护性总结汇总

- 本次使用 `post-edit-maintainability-review` 口径复核：生产代码净增未增加。
- 正向减债动作：简化统计口径并移除 `.vitepress` source 候选，避免主指标继续承载非生产代码。
- 治理规则与 workflow 真实产物对齐，避免生成文件触发不合理角色命名阻断。
- 补充修复增加了少量用户可见 Pulse 表达与数据 owner 测试；没有引入双路径，历史覆盖逻辑集中在 `mergeLatestLocSnapshot`，避免组件层临时修数。
- 本次导航纠偏已沉淀到 `nextclaw-clean-implementation`：调整导航、侧边栏、菜单或入口时，默认保留既有可用入口和用户已接受的命名，除非用户明确要求删除或改名。

## NPM 包发布记录

不涉及 NPM 包发布。
