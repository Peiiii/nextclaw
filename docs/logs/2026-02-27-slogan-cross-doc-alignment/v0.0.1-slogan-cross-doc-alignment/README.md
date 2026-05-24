# 2026-02-27 v0.0.1-slogan-cross-doc-alignment

## 迭代完成说明（改了什么）

- 以落地页主视觉最新 slogan 为基准，统一对齐 Readme 与项目文档文案。
- 已同步到：
- `README.md` / `README.zh-CN.md` 顶部口号与首段定位描述
- docs 站首页中英文 tagline：`apps/docs/en/index.md`、`apps/docs/zh/index.md`
- docs 站 introduction 中英文开场定位：`apps/docs/en/guide/introduction.md`、`apps/docs/zh/guide/introduction.md`
- npm readme 源文案：`docs/npm-readmes/nextclaw.md`
- 项目定位文档一句话描述：`docs/feature-universe.md`
- 执行 `release:sync-readmes`，同步更新 `packages/nextclaw/README.md`，避免 npm 包文案滞后。

### 2026-05-24 追加对齐

- 将对外主 slogan 更新为：`Turn your computer into a powerful AI assistant that coordinates agents, skills, CLI tools, automations, and messaging apps.`
- 中文口径更新为：`把你的电脑变成一个强大的 AI 助手，协调 Agent、技能、CLI 工具、自动化和消息应用。`
- 同步根 README、中文 README、docs 首页、landing hero/SEO、npm README 源与 `packages/nextclaw` 包描述。
- 清理同一批对外短文案里的 `OpenClaw-compatible` / `完全兼容其插件生态` 旧口径，避免继续暗示当前产品是 OpenClaw 兼容层。

## 测试 / 验证 / 验收方式

- `PATH=/opt/homebrew/bin:$PATH pnpm release:sync-readmes`
- `PATH=/opt/homebrew/bin:$PATH pnpm docs:i18n:check`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/docs build`
- 2026-05-24 追加验证：
  - `pnpm -C apps/landing tsc`
  - `pnpm release:check-readmes`
  - `pnpm -C apps/landing lint`（0 error，保留既有 `max-lines` / `max-lines-per-function` warning）
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths apps/landing/src/main.ts`
  - `pnpm lint:new-code:governance`
  - `pnpm check:governance-backlog-ratchet`

## 发布 / 部署方式

- 本次为文案与文档对齐，不涉及 migration 或后端部署。
- 如需发布 npm，按项目流程执行：`changeset -> release:version -> release:publish`。
- 如需发布文档站，执行：`pnpm deploy:docs`。
- 2026-05-24 追加：未执行发布；landing/docs/npm 包描述将在后续正常发布或站点部署流程中生效。

## 用户 / 产品视角的验收步骤

1. 打开仓库根 README，确认顶部口号与首段定位已对齐新版 slogan。
2. 打开 docs 首页中英文版本，确认 hero tagline 已对齐新版 slogan 语义。
3. 打开 docs introduction 中英文，确认开场定位与新版 slogan 一致。
4. 打开 `packages/nextclaw/README.md`，确认 npm 包 readme 已同步最新描述。
5. 2026-05-24 追加：打开 landing 中英文首页，确认 hero 与 SEO metadata 不再使用旧的 “omnipotent / 全能管家 / OpenClaw-compatible” 口径。

## 可维护性总结汇总

- 2026-05-24 追加改动为文案替换和元信息对齐，未新增文件、函数、分支或目录。
- `apps/landing/src/main.ts` 本次行数 `+6 / -6 / net 0`，未继续放大既有大文件问题；maintainability guard 仅提示该文件原本超预算。
- 本次顺手减债：清理对外短文案中的过期 OpenClaw 兼容表述，降低产品定位维护成本。
- `post-edit-maintainability-review` 结论：通过；no maintainability findings；需关注的既有债务仍是 landing `main.ts` 过长，后续若继续触达 landing 应拆分文案数据、渲染逻辑与页面组件边界。

## NPM 包发布记录

- 不涉及 NPM 包发布。
- 2026-05-24 仅更新 `packages/nextclaw/package.json` description 与 npm README 文案；是否发布交由后续统一 release 流程判断。
