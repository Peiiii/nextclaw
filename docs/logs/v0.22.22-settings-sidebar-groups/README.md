# v0.22.22 设置侧边栏分组

## 迭代完成说明

本次为设置页左侧导航增加语义分组：

- “基础配置”包含模型、提供商、渠道。
- “高级配置”包含搜索渠道、外观、安全、路由与运行时、更新、远程访问、密钥管理和 MCP。
- 原有设置项顺序保持不变，折叠 rail 状态仍保持扁平图标导航，避免在窄侧栏里塞不可读标题。
- 导航事实源继续归 `app-navigation.config.ts`，桌面侧栏只负责展示；主侧栏导航项也收敛到同一个导航配置 owner。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui exec vitest run src/app/components/layout/__tests__/sidebar.layout.test.tsx`：通过，1 个测试文件 / 5 个测试。
- `pnpm --filter @nextclaw/ui tsc`：通过。
- `pnpm --filter @nextclaw/ui lint`：通过，0 error；仅保留既有 `chat-thread.manager.test.ts` 超 800 行 warning。
- `pnpm --filter @nextclaw/ui build`：通过；仅保留既有 Browserslist、dynamic import 和 chunk size 提示。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `git diff --check -- <changed files>`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <changed files>`：通过，0 error / 1 warning；warning 为 `sidebar.tsx` 接近 500 行预算，已通过把列表展示沉到 `sidebar-items.tsx` 将主文件控制在 456 行。
- Playwright 访问 `http://127.0.0.1:5184/model`：通过，左侧导航显示“基础配置 / 高级配置”，当前激活项为“模型”。

## 发布/部署方式

本次未执行发布或部署。改动已完成本地源码、构建和页面冒烟验证，等待后续统一发布。

## 用户/产品视角的验收步骤

1. 打开设置页或直接访问 `/model`。
2. 查看左侧设置导航，确认前三项位于“基础配置”下。
3. 确认搜索渠道及后续设置项位于“高级配置”下。
4. 折叠侧边栏，确认 rail 模式仍保持图标导航，不出现挤压文字。

## 可维护性总结汇总

本次使用既有导航配置作为分组事实源，没有新增并行菜单或路由入口。设置侧栏的分组展示逻辑保持在桌面侧栏层，导航列表复用 `sidebar-items.tsx` 的展示组件，主侧栏文件从预算越界风险收回到 500 行以内。

`post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 已用于收口判断。当前保留的维护关注点是 `sidebar.tsx` 仍接近 500 行预算；下一次继续扩展侧栏时应优先拆出更明确的 sidebar section/container。

## NPM 包发布记录

本次涉及 `@nextclaw/ui` 用户可见变化，已新增 `.changeset/settings-sidebar-groups.md`，类型为 patch。

当前未执行 NPM 发布；状态为待后续统一发布。
