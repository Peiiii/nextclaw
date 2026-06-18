# v0.20.87 Sidebar Collapse Rail

## 迭代完成说明

本次为 NextClaw 左侧边栏增加收起/展开能力，并将收起状态持久化到现有 viewport layout store 的 localStorage 持久化合同中。

实现原则：

- 不新增独立 sidebar store，复用 `viewport-layout.store` 与 `viewport-layout.manager` 作为前端布局状态 owner。
- 收起态采用简约 rail 规范：56px rail、36px 命中区、16px 图标、默认透明无边框无阴影，hover/active/focus 才给反馈。
- 同组纵向间距压到 4px，主要分组间距控制在 6-8px，避免按钮自身留白叠加后显得松散。
- 聊天侧栏、设置侧栏、桌面 Windows chrome、定时任务/技能/Agent 管理入口和底部设置菜单保持同一套 rail 展示规范。
- 收起状态刷新后保持，持久化 key 为 `nextclaw.app.viewport-layout`，仅持久化 `isSidebarCollapsed`，不持久化运行时宽度和布局模式。

## 测试/验证/验收方式

定向测试：

- `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter @nextclaw/ui exec vitest run src/app/components/layout/__tests__/sidebar.layout.test.tsx src/features/chat/components/layout/__tests__/chat-sidebar.test.tsx src/features/chat/components/layout/__tests__/chat-sidebar-read-state.test.tsx src/platforms/desktop/components/__tests__/desktop-app-shell.test.tsx`
- 结果：4 个 test files 通过，36 个 tests 通过。

类型与 lint：

- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/ui lint`
- `pnpm --filter @nextclaw/ui exec prettier --check ...`
- 结果：lint 通过，保留另一批未跟踪 conversation 代码中的 2 个 warning；Prettier 通过；`tsc` 被非本次 sidebar 改动阻塞。
- `tsc` 阻塞项：`packages/nextclaw-ui/src/features/chat/components/conversation/*`、未跟踪的 `packages/nextclaw-ui/src/features/chat/features/conversation/`、以及 welcome 测试存在类型不一致；未出现 sidebar 相关文件错误。

治理检查：

- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
- 结果：0 errors，3 warnings。已将 `chat-sidebar.tsx` 的 desktop 展示组件拆到 `chat-sidebar-desktop-layout.tsx`，并将 `chat-sidebar.test.tsx` 压回预算线内。
- `pnpm check:governance-backlog-ratchet`
- 结果：通过。
- `pnpm lint:new-code:governance`
- 结果：被非本次 sidebar 改动阻塞，错误来自未跟踪 conversation 目录的 parent-relative import 规则；未出现 sidebar 相关治理错误。

浏览器验收：

- 启动：`pnpm --filter @nextclaw/ui dev --host 127.0.0.1 --port 5177`
- 页面：`http://127.0.0.1:5177/chat`
- 量测结果：rail 宽度 56px；收起、创建、会话类型、定时任务、技能、Agent 管理、底部设置入口均为 36x36；默认透明、无 shadow、无 border；同组间距 4px，主要分组间距 6-8px。
- 持久化验证：刷新后仍保持收起，localStorage `nextclaw.app.viewport-layout` 中 `state.isSidebarCollapsed` 为 `true`。

## 发布/部署方式

本次执行源码提交，不执行发布，不推送。

发布判断：

- 这是用户可见 UI 能力增强，已添加 `.changeset/sidebar-collapsed-rail.md`。
- 影响包：`@nextclaw/ui` patch。
- 后续统一 NPM 发布时由 changesets 聚合版本。

## 用户/产品视角的验收步骤

1. 打开聊天页面。
2. 点击左侧顶部收起按钮。
3. 预期左侧栏变为 56px rail，入口只展示图标，hover 有浅色反馈。
4. 检查定时任务、技能、Agent 管理三个入口：尺寸一致、间距紧凑、默认无边框无阴影。
5. 刷新页面，预期仍保持收起状态。
6. 点击展开按钮，预期恢复完整侧栏。

## 可维护性总结汇总

本次是新增用户可见能力，允许生产代码净增长。

正向减债动作：

- 将 collapsed rail 的宽度、按钮尺寸、图标尺寸、surface、active 与 primary 样式收敛到 `sidebar-rail.styles.ts`，避免后续入口各写各的。
- 将收起/展开状态归入现有 viewport layout store/manager，避免新增平行 sidebar store。
- 修正 collapsed nav link 的 DOM class 问题：从 `NavLink className function` 切到显式 `Link + useLocation`，确保 class 字符串真实落到 DOM，同时补回 `aria-current="page"`。

代码增减报告：

- 总代码：新增 1379 行，删除 420 行，净增 959 行。
- 非测试代码：新增 1141 行，删除 305 行，净增 836 行。
- 测试代码：新增 238 行，删除 115 行，净增 123 行。

可维护性复核结论：

- 增长主要来自双侧栏收起态、持久化合同、桌面 chrome 对齐和测试覆盖；属于新增用户能力而非非功能改动。
- 已将聊天侧栏 desktop 展示组件拆到 `chat-sidebar-desktop-layout.tsx`，避免 `chat-sidebar.tsx` 继续超过文件预算。
- 后续如果 sidebar 继续增加入口，应优先复用 `sidebar-rail.styles.ts` 和 `SidebarNavLinkItem` / `SidebarActionItem` / `SidebarSelectItem`，不要在业务组件内新增散落的 collapsed class。

## NPM 包发布记录

本次未发布 NPM 包。

需要进入后续统一发布：

- `@nextclaw/ui`：patch，原因是新增左侧边栏收起/展开能力，并统一收起态 rail 展示规范。
