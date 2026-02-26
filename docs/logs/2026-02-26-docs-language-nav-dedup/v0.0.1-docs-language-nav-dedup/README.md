# 2026-02-26 v0.0.1-docs-language-nav-dedup

## 迭代完成说明（改了什么）

- 调整文档站导航，移除硬编码语言菜单项，避免与内置语言切换重复：
- 移除全局导航中的 `English` / `简体中文`。
- 移除 `en` locale 导航中的 `简体中文`。
- 移除 `zh` locale 导航中的 `English`。
- 保留 VitePress 内置语言切换下拉，后续新增语言仅需在 `locales` 扩展，无需修改导航结构。
- 修改文件：`apps/docs/.vitepress/config.ts`。

## 测试 / 验证 / 验收方式

- Docs 构建：
- `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/docs build`
- 全量校验（按规则）：
- `PATH=/opt/homebrew/bin:$PATH pnpm build`
- `PATH=/opt/homebrew/bin:$PATH pnpm lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm tsc`
- 冒烟检查（构建产物）：
- 检查顶部导航仅保留业务导航与 GitHub，语言切换仅通过语言下拉出现。

## 发布 / 部署方式

- 本次仅 docs 前端导航调整，无后端/数据库变更：
- 远程 migration：不适用。
- 发布命令：
- `PATH=/opt/homebrew/bin:$PATH pnpm deploy:docs`

## 用户 / 产品视角的验收步骤

1. 打开 `https://docs.nextclaw.io/en/`，确认顶部不再出现额外的“简体中文”菜单按钮。
2. 打开 `https://docs.nextclaw.io/zh/`，确认顶部不再出现额外的“English”菜单按钮。
3. 点击语言图标下拉，确认仍可在中英文之间切换。
4. 切换到任意文档页（如 getting-started），确认语言切换能跳转对应页面。
