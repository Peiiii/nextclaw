# v0.14.60-mcp-marketplace-installed-state-fix

## 迭代完成说明

- 修复 MCP marketplace catalog 中“已安装实例仍显示安装按钮”的状态判断问题。
- 根因是 MCP 页面之前只用 `catalogSlug` 做已安装匹配；当已安装记录没有 `catalogSlug`、只有 `spec/id/label` 时，页面会误判为未安装。
- 本次改为与 `skills/plugins marketplace` 同级别的多键匹配策略，按 `catalogSlug/spec/id/label` 建立 installed lookup，再用 `slug/install.spec/id/name` 识别 catalog item 对应的已安装实例。
- 新增回归测试，覆盖“已安装记录没有 `catalogSlug` 但 `spec` 相同”时，catalog 卡片不再出现 `Install` 按钮，而是切到管理按钮。

## 测试/验证/验收方式

- 定向回归测试：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui test -- src/components/marketplace/mcp/McpMarketplacePage.test.tsx`
- 可维护性自检：
  - `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/components/marketplace/mcp/McpMarketplacePage.tsx packages/nextclaw-ui/src/components/marketplace/mcp/McpMarketplacePage.test.tsx`
- 说明：
  - `packages/nextclaw-ui` 当前全量 `tsc/build` 被工作区中与本次无关的 chat 偏好治理并行改动阻塞，不属于本次修复引入，已保持不触碰。

## 发布/部署方式

- 本次为前端逻辑修复与测试更新，不涉及后端、数据库或 worker 发布。
- 交付方式：
  - 提交 UI 源码修复
  - 后续待 UI 工作区恢复到可全量构建状态后，再统一刷新产物并走前端发布流程

## 用户/产品视角的验收步骤

1. 本地已有一个已安装的 marketplace MCP，例如 `chrome-devtools`。
2. 打开 Marketplace 的 MCP 页面并停留在 catalog tab。
3. 找到对应的 `Chrome DevTools MCP` 卡片。
4. 确认卡片右侧不再显示 `Install`，而是显示 `Disable` / `Doctor` / `Remove` 等已安装管理按钮。
5. 刷新页面后再次确认状态仍然正确，不会回退成“未安装”。
