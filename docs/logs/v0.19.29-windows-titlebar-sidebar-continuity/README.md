# v0.19.29 Windows Titlebar 与 Sidebar 视觉连续性

## 迭代完成说明

- 修复 Windows 桌面端 title bar 与左侧 sidebar 之间出现可见横向分割线的问题。
- 根因：`DesktopWindowChrome` 的 header 自身带全宽 `border-b`，导致下边框从窗口左侧贯穿到右侧，左侧 title bar 和左侧 sidebar 被视觉切开。
- 确认方式：检查 Windows chrome 结构，发现 `desktop-window-chrome` 的 `border-b` 作用于整个 title bar；左侧 sidebar chrome 和 chat sidebar 背景同为 `bg-secondary`，真正制造左侧断层的是全宽下边框。
- 修复方式：移除 header 全宽下边框，改用 header `after` 伪元素从 `--desktop-sidebar-width` 之后开始绘制右侧内容区分隔线。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test src/platforms/desktop/components/desktop-app-shell.test.tsx`：通过，1 个测试文件 4 个测试通过。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui exec eslint src/platforms/desktop/components/desktop-window-chrome.tsx src/platforms/desktop/components/desktop-app-shell.test.tsx`：通过。
- `pnpm -C packages/nextclaw-ui lint`：被既有无关 lint errors 阻塞，错误不来自本次触达文件。
- `curl -fsS http://127.0.0.1:5174/src/platforms/desktop/components/desktop-window-chrome.tsx | rg -n 'after:left|border-b|desktop-window-chrome-sidebar'`：确认 dev server 实际源码中分隔线从 `--desktop-sidebar-width` 之后开始。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/platforms/desktop/components/desktop-window-chrome.tsx packages/nextclaw-ui/src/platforms/desktop/components/desktop-app-shell.test.tsx`：通过，0 errors。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。

## 发布/部署方式

- 未发布。
- 本次是前端 Windows 桌面 chrome 视觉修复，等待后续统一前端或桌面发布批次带出。

## 用户/产品视角的验收步骤

1. 在 Windows 桌面端打开 NextClaw。
2. 进入聊天主界面。
3. 观察左侧 title bar 品牌区域和下方左侧 sidebar 的衔接。
4. 预期：左侧区域没有横向分割线或视觉断层；右侧内容区仍保留 title bar 与内容之间的分隔。

## 可维护性总结汇总

- 已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 规则做收尾判断。
- 总代码增减：新增 5 行，删除 2 行，净增 3 行。
- 非测试代码增减：新增 1 行，删除 1 行，净增 0 行，满足非功能改动门槛。
- 正向减债动作：简化。分隔线从全局 header 边框变为按布局变量定位的单一视觉合同，避免左侧区域再被全宽边框误切开。
- 未新增组件、状态或分支，未扩大 Windows chrome 的职责边界。

## NPM 包发布记录

不涉及 NPM 包发布。
