# v0.45.6 Panel App 轻量独立宿主与 Portable Runtime 跨 worktree 缓存

## 迭代完成说明

本批完成两个相关的开发体验根因修复：

- Panel App 的 standalone URL 原先仍由完整 `AppContent` 和 `AppPresenter` 启动，同时 Panel 读取热路径会对全部已启用 App 重复做 SHA-256 完整性扫描。这导致外层 HTML 虽快，iframe content 冷请求却约 5.78 秒，完整页面冷启动超过 10 秒。
- 隔离 worktree 中的 source runtime 把“需要 runner 产物”与“runner 源码发生变化”混为一件事，因此未变的 Rust/Wasmtime 底层也会在新 worktree 重复编译。

根因通过生产请求计时、Vite manifest 依赖闭包、Panel resolver 调用链与 runner build 输入链确认。修复直接改变 owner 和热路径，而不是增加 loading 遮罩或跳过完整性校验：

- 稳定 URL `/apps/panel/:appId/standalone` 映射到独立 HTML/Vite entry，只装载 Theme、最小 i18n、auth 状态和共享 `PanelAppHostPresenter` / `PanelAppRuntimeSurface`。
- 增加单目标 `GET /api/panel-apps/:id`；App Package lifecycle 维护经验证的原子 component catalog snapshot，read/list/content 只读 snapshot，完整性校验仍在 start/install/update/rollback/enable 变更边界执行。
- Portable Runtime builder 以源码、lockfile、工具链和目标平台指纹建立工作区外共享缓存；命中时原子物化已验证产物，输入变化、缓存损坏和并发构建均有确定行为。

设计与执行合同见 [Panel App 轻量独立宿主设计](../../designs/2026-09-03-panel-app-standalone-lightweight-host.design.md)、[Portable Runtime 跨 worktree 缓存设计](../../designs/2026-09-03-portable-runtime-cross-worktree-cache.design.md) 和 [执行计划](../../plans/2026-09-03-panel-app-standalone-lightweight-host.plan.md)。

## 测试/验证/验收方式

- TypeScript 与构建：UI、Client SDK、Kernel、Server 和 NextClaw 受影响范围均通过；UI 最终生产构建通过。
- 定向测试：UI 最终 7 文件 21 项通过；Server 25 项、Kernel 受影响 26 项、App Package lifecycle 22 项、Portable Runtime cache 14 项通过。
- 构建闭包：standalone 初始闭包共 18 文件，442,334 B raw / 131,715 B gzip；`AppPresenter`、主 entry、Chat、Inbox、PWA、DocBrowser、Office/图表依赖命中数均为 0。登录页仅在未认证时动态加载。
- 真实本地生产链路 30 轮：HTML p95 3.24ms，单目标 descriptor p95 5.19ms，Panel content p95 5.05ms，18 个静态资源并发闭包 p95 11.87ms；unknown id 返回结构化 404。
- `--no-build` 重启隔离 source runtime 成功，不触发未变底层依赖重建。UI lint 、新代码 governance、`git diff --check` 和 diff-only maintainability 均为 0 error。
- 用户在 NPM Web UI 验收时发现直接点击会被已安装 NextClaw PWA 捕获为专属窗口。根因是 PWA `scope: "/"` 与 Chrome 139+ 导航捕获遇到 `_blank` 默认 `noopener` 的非辅助上下文，与 Electron 无关。回归修复将同源 standalone 链接改为显式 `rel="opener"` + `referrerPolicy="no-referrer"`，并用 DOM 合同测试防止重新退化成可捕获导航。
- Codex 内置浏览器当前落在 `data:` 错误页，安全策略禁止自动跳转 localhost；未绕过该策略。因此自动化已证明资源、API、性能和错误语义，最终主观视觉保留给用户在交付 URL 验收。

## 发布/部署方式

用户完成本地验收后明确授权“合入主干”。Portable Runtime cache 和 Panel standalone 分别以 `4221f57b3` / `d3a705a09` 提交，然后合入最新 `origin/master` 并推送远端主干。没有建 PR、发布或部署。验收实例使用独立 home 和 `18899` 端口，不会重启或覆盖用户现有 `15174/18792` 实例。

## 用户/产品视角的验收步骤

1. 打开 `http://127.0.0.1:18899/apps/panel/inline-todo/standalone`，确认页面只有“今日待办” Panel App，没有 NextClaw 主工作台的侧栏、Chat 或头部。
2. 刷新页面，确认 Panel 快速恢复，无数秒级 loading。
3. 回到 Panel Apps 列表或已打开 Panel 的更多菜单，确认 Web 显示“在新标签页中打开”，Desktop 显示“在浏览器中打开”。
4. 对需要 Client/Service Action 权限的 Panel 执行允许、拒绝和重试，确认与主 App 内表面一致。

## 可维护性总结汇总

本批删除了 standalone 对完整 `AppPresenter` / `AppContent` 的依赖，把 Panel 宿主行为收敛到共享 presenter/runtime surface，把授权状态从 Service Apps 迁回 Panel Apps owner，并把 theme 与 PWA projection、Panel i18n 与全领域 catalog 分离。后端 catalog 使 lifecycle mutation 和 query 纯读边界更清晰；runner cache 没有创建第二套构建语义，只缓存可验证产物。

diff-only maintainability 检查 59 个变更文件，0 error、11 warning；warning 是 runner cache 测试的明显增长、已登记目录例外和若干既有/接近文件预算。本批没有为压缩数字引入无事实价值的 wrapper；新文件命名、角色和 feature 归属已通过全部新代码 governance 检查。

## 红区触达与减债记录

### `packages/nextclaw-kernel/src/managers/app-package.manager.ts`

- 本次是否减债：是。
- 说明：将请求级完整性扫描改为 lifecycle 维护的原子 component snapshot，但该 lifecycle owner 已接近 600 行预算。
- 下一步拆分缝：后续在有独立需求时把 package component catalog lifecycle projection 提取为窄协调 owner，不在本批为减行数强行拆分。

### `packages/nextclaw-ui/src/app/index.tsx`

- 本次是否减债：是。
- 说明：standalone route 从主 App 移除，并将 Account/Service Apps 的重表面改为公共延迟 loader，防止 feature barrel 污染独立入口。
- 下一步拆分缝：主工作台新增装配责任时，优先从 `AppContent` 拆出独立 shell composition，不回流到 standalone entry。

## NPM 包发布记录

本地实现产生了用户可见变更的 changeset，但本批未授权发布；当前不涉及 NPM 包发布。若后续合入发布批次，由 release owner 根据 changeset 统一决定包版本与 Runtime/Desktop 投影。
