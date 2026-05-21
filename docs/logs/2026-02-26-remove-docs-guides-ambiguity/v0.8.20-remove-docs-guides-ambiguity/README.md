# 2026-02-26 v0.8.20-remove-docs-guides-ambiguity

## 迭代完成说明（改了什么）

- 清理 `docs/guides/**` 目录，避免与 `apps/docs/guide/**` 语义冲突。
- 将原 `docs/guides/**` 内容迁移到内部目录 `docs/designs/**`：
  - `2026-02-23-hot-plugin-runtime-v1-checklist.md`
  - `2026-02-21-openclaw-alignment-gap-report.md`
  - `multi-agent-architecture-reference.md`
- 用户向文档链接统一改为 docs 站点：
  - `docs/USAGE.md` 中多 Agent 文档链接改为 `https://docs.nextclaw.io/guide/multi-agent`
  - `docs/feature-universe.md` 中对应链接改为 docs 站点
- 同步更新历史日志中的相关路径，确保仓库内不再出现 `docs/guides/**` 引用。
- 同步模板文档：执行 `packages/nextclaw/scripts/sync-usage-template.mjs` 更新 `packages/nextclaw/templates/USAGE.md`。

## 测试 / 验证 / 验收方式

- 路径与引用验证：
  - `rg -n "docs/guides/|guides/multi-agent-architecture" docs README.md packages --glob '!**/dist/**' --glob '!**/node_modules/**'`
  - 预期：无匹配结果。
- 文档构建冒烟：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/docs build`
  - 观察点：文档站构建成功。
- 全仓验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm tsc`

## 发布 / 部署方式

- 本次为文档结构治理，不涉及后端/数据库变更：
  - 远程 migration：不适用
- 如需发布，按标准流程：
  1. `pnpm changeset`
  2. `pnpm release:version`
  3. `pnpm release:publish`

## 用户 / 产品视角的验收步骤

1. 打开 `apps/docs/guide/multi-agent.md`，确认用户阅读入口在 docs 站点体系。
2. 打开 `docs/designs/` 下迁移后的内部文档，确认内容仍可访问。
3. 全局搜索 `docs/guides`，确认仓库无残留引用。

