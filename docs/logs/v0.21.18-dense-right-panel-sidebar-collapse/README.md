# v0.21.18 Dense Right Panel Sidebar Collapse

## 迭代完成说明

本次新增窄桌面布局下的右侧双面栏协调能力：

- 当 docked DocBrowser 与会话 workspace 右侧面栏同时打开，且桌面 viewport 宽度不超过 `1800px` 时，一次性自动收起左侧 sidebar。
- 自动收起只在“打开右侧面栏”动作后检测：DocBrowser 的 `open/openTarget/toggleMode` 与 chat workspace 的 `openChildSessionPanel/openSideChatDraft/openFilePreview/openSessionCronPanel` 都会通知 app layout coordinator。
- 不在 render 中持续派生折叠状态，不在 resize 时反复抢用户操作，也不在关闭右侧面栏后自动展开左侧栏。
- Floating DocBrowser 不占横向 docked 空间，因此不会触发左侧栏自动收起。

核心 owner：

- `ViewportLayoutManager` 拥有一次性折叠意图 `collapseSidebarForDenseRightPanels`。
- `AppPresenter` 读取 DocBrowser store 与 chat workspace store 的当前事实，作为 app 级协调 owner。
- `DocBrowserManager` 与 `ChatThreadManager` 只在自己的打开动作完成后发出通知，不互相依赖。

## 测试/验证/验收方式

- 定向测试：`pnpm --filter @nextclaw/ui test -- src/app/managers/__tests__/viewport-layout.manager.test.ts src/shared/components/doc-browser/__tests__/doc-browser-context.test.tsx src/features/chat/managers/__tests__/chat-thread.manager.test.ts`
  - 结果：通过，3 个 test files、45 个 tests。
- 类型检查：`pnpm --filter @nextclaw/ui tsc`
  - 结果：通过。
- 触达文件 ESLint：`pnpm --filter @nextclaw/ui exec eslint ...`
  - 结果：通过。
- 包级 lint：`pnpm --filter @nextclaw/ui lint`
  - 结果：通过。
- 治理检查：`pnpm lint:new-code:governance -- ...`
  - 结果：通过。
- Governance backlog ratchet：`pnpm check:governance-backlog-ratchet`
  - 结果：通过。
- 可维护性守卫：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
  - 结果：Errors 0，Warnings 3；警告均为接近预算文件：`chat-thread.manager.test.ts`、`chat-thread.manager.ts`、`doc-browser.manager.ts`。
- 生成物清理：`pnpm clean:generated`
  - 结果：generated artifacts are clean。
- 浏览器 smoke：启动 `pnpm -C packages/nextclaw-ui dev --host 127.0.0.1 --port 5188 --strictPort`，用 Playwright 打开 `http://127.0.0.1:5188/chat`，viewport `1500x900`。
  - 结果：先打开 docked DocBrowser 时 `beforeWorkspaceOpen=false`；随后打开 workspace file panel 后 `afterWorkspaceOpen=true`，页面真实 `aside[data-sidebar-collapsed]` 变为 `"true"`。

## 发布/部署方式

本次未执行发布、部署、提交或推送。

发布判断：

- 这是 `@nextclaw/ui` 的用户可见交互能力，已新增 `.changeset/dense-right-panel-sidebar-collapse.md`。
- 后续统一 NPM 发布时由 changesets 聚合。

## 用户/产品视角的验收步骤

1. 在宽度不超过 `1800px` 的桌面布局打开聊天页。
2. 打开 docked DocBrowser。
3. 打开会话内部 workspace 右侧面栏，例如 child session、side chat draft、文件预览或 session cron 面板。
4. 预期左侧 chat sidebar 自动收起为 rail。
5. 若 DocBrowser 是 floating 模式，预期不会触发自动收起。
6. 手动再次展开左侧 sidebar 后，系统不应因为 render 或 resize 持续计算而立刻抢回折叠状态；只有下一次打开右侧面栏动作才会重新检测。

## 可维护性总结汇总

可维护性复核结论：通过。

- 代码增减报告：新增 204 行，删除 5 行，净增 199 行。
- 非测试代码增减报告：新增 80 行，删除 4 行，净增 76 行。
- 本次顺手减债：否；这是新增用户可见能力，净增主要来自明确 owner 接线、一次性布局检测和测试覆盖。
- 可维护性总结：没有新增状态镜像、effect 补丁或跨 feature 反向依赖；DocBrowser 与 chat workspace 只通知 app 层协调者，实际折叠策略仍归 `ViewportLayoutManager`。剩余观察点是 `chat-thread.manager.ts` 与 `doc-browser.manager.ts` 已接近预算，后续继续扩展时应优先拆状态迁移 helper 或测试 fixture。

## NPM 包发布记录

本次未发布 NPM 包。

需要进入后续统一发布：

- `@nextclaw/ui`：patch，原因是新增窄桌面下 docked DocBrowser 与 chat workspace 双右侧面栏同时打开时自动一次性收起左侧 sidebar 的用户可见交互能力。
