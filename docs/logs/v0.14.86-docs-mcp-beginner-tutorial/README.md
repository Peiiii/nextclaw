# v0.14.86-docs-mcp-beginner-tutorial

## 迭代完成说明

- 在文档站新增面向小白用户的 MCP 教程，中英文各一篇：
  - [中文教程](/Users/peiwang/Projects/nextbot/apps/docs/zh/guide/tutorials/mcp-marketplace.md)
  - [English tutorial](/Users/peiwang/Projects/nextbot/apps/docs/en/guide/tutorials/mcp-marketplace.md)
- 教程聚焦“不碰命令行”的使用路径，覆盖：
  - 进入 `Marketplace -> MCP`
  - 安装 MCP
  - 使用 `Doctor` 检查可用性
  - 回到聊天中实际使用
  - 以 `Chrome DevTools MCP` 为例解释“安装成功不等于已可用”
- 同步补齐文档站入口，确保用户能从多个入口发现该教程：
  - 教程总览页（中英文）
  - Tools 页面（中英文）
  - VitePress 侧边栏 Learn & Resources / 学习与资源

## 测试/验证/验收方式

- 双语镜像检查：
  - `PATH=/opt/homebrew/bin:$PATH node scripts/docs-i18n-check.mjs`
  - 结果：通过，输出 `OK: 29 mirrored markdown pages in en/ and zh/`
- 文档站构建：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/docs build`
  - 结果：通过
- 线上可达性检查：
  - `PATH=/opt/homebrew/bin:$PATH curl -I -s https://26c4525a.nextclaw-docs.pages.dev/zh/guide/tutorials/mcp-marketplace | head -n 5`
  - `PATH=/opt/homebrew/bin:$PATH curl -I -s https://26c4525a.nextclaw-docs.pages.dev/en/guide/tutorials/mcp-marketplace | head -n 5`
  - 结果：两条路由均返回 `HTTP/2 200`

## 发布/部署方式

- 本次为文档站内容更新，按既有 docs 发布流程执行：
  - `PATH=/opt/homebrew/bin:$PATH pnpm deploy:docs`
- 实际部署结果：
  - Cloudflare Pages preview: `https://26c4525a.nextclaw-docs.pages.dev`
- 说明：
  - 本次仅文档站变更，不涉及后端、数据库、worker 或 npm 包发布。

## 用户/产品视角的验收步骤

1. 打开文档站中文教程总览，确认能看到 `MCP 教程（不碰命令行）`。
2. 打开文档站英文教程总览，确认能看到 `MCP Tutorial (No Command Line)`。
3. 分别进入中英文教程页，确认内容都覆盖：
   - Marketplace 安装
   - Doctor 检查
   - 聊天中使用
   - Chrome DevTools MCP 的特殊说明
4. 打开 Tools 页面，确认也能跳到这篇 MCP 教程。
5. 按教程步骤在 UI 中实际操作一次，确认新用户不需要先接触命令行就能理解 MCP 的基本使用路径。
