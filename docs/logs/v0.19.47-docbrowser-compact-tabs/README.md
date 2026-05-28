# v0.19.47 DocBrowser Compact Tabs

## 迭代完成说明

- 将内嵌浏览器独立标题栏收敛到标签栏：关闭、浮动/停靠按钮进入 tab 同一行，移除重复标题展示。
- 调整标签栏布局：tabs 区域作为独立横向滚动层占据剩余空间，右侧操作按钮固定在 titlebar 最右侧，不跟随 tabs 横向滚动。
- 为内嵌浏览器 tabs 添加专用薄滚动条，避免复用全局滚动条导致标签栏显得过厚。
- 将新建标签加号移入右侧固定操作区，并把默认新建内容从文档首页升级为 `nextclaw://new-tab` 导航页。
- 新建导航页第一版提供应用、服务应用、帮助文档、技能市场、MCP 市场入口；应用和文档在 doc browser 内打开，市场入口走应用内路由导航。
- 导航页视觉改为新建页/launcher 形态：主体直接使用自适应彩色图标网格，移除页面标题、副标题、卡片列表、URL meta 和孤立标题图标。
- 补充设计文档 `docs/designs/2026-05-28-doc-browser-route-registry.md`，明确 DocBrowser store、manager、route registry、renderer 的边界。
- 引入 DocBrowser route registry，统一 `home/docs/apps/content` 的 URL 归一化、默认标题、去重键、历史策略和首页导航项。
- 将 `DocBrowserManager` 的 `open/new tab/navigate/sync/back/forward` 接入 route registry，不再把前进后退硬编码为 docs 专属。
- 将 Apps / Service Apps URL 常量收敛到 DocBrowser route 层，panel apps 功能复用同一事实源。
- 将 Back / Forward 作为顶栏固定操作入口加入 tab action group，并切换为 DocBrowser 全局 active 页面历史；单个 tab 内部 URL history 继续保留为局部状态，不再驱动顶栏按钮。
- 对齐 active 页面历史交互边界：切换 tab、新建页、首页入口、Apps / Service Apps 等主动页面切换进入全局 active history；Back / Forward 只移动 active history index；主动打开新目标会先截断当前指针后的 forward 栈，再作为最新记录入栈。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui exec vitest run src/shared/components/doc-browser/doc-browser.test.tsx src/shared/components/doc-browser/doc-browser-context.test.tsx`：通过。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui exec eslint ...`：触达 TS/TSX 文件无错误；`src/index.css` 被当前 ESLint 配置忽略。
- `pnpm -C packages/nextclaw-ui lint -- ...`：包级 lint 被既有无关错误阻塞，本次改动改用触达文件 ESLint 验证。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- 本地 Vite 冒烟：复用 `http://127.0.0.1:5174`，确认 `doc-browser-tab-strip` 加载当前源码；单 tab 场景下新建标签按钮与右侧操作按钮间距为 `8px`，tabs 滚动区域应用 `doc-browser-tab-scrollbar`。
- 滚动条位置冒烟：多 tab 场景下 titlebar 高 `44px`，scroll 容器底边到 titlebar 底边距离为 `1px`，该距离等于底部分界线自身宽度，滚动条已贴近分界线。
- 右侧操作按钮定位冒烟：多 tab 场景下 actions 到 titlebar 右边距离为 `10px`，等于外层右内边距；tabs scroll 区域独立滚动，actions 不参与横向滚动。
- 新建页冒烟：点击右侧固定 `New Tab` 后打开 `Start Page`，导航卡片包含 Apps、Service Apps、Help Docs、Skill Marketplace、MCP Marketplace。
- 视觉冒烟：截图确认导航页内容靠上、入口为图标网格，正文不再出现 `Start Page`/`NextClaw` 标题区。
- 自适应网格冒烟：默认 `420px` 面板下首行 3 个入口；临时扩展到 `760px` 后首行自动展示 5 个入口，确认不再写死列数。
- route registry 定向测试：验证无组件级 options 时 `nextclaw://apps?tab=service-apps` 可解析为 `apps` tab、`dedupeKey: apps`、标题 `Service Apps`。
- active history 定向测试：验证顶栏 Back / Forward 可以在 docs、新建页、apps/service apps 等 active 页面之间切换，且 tab 内 URL history 不再作为顶栏按钮依据。
- route registry 冒烟：复用 `http://127.0.0.1:5174`，通过 Playwright 注入打开的 DocBrowser 状态，点击 `New Tab` 后再点击 `Service Apps`，确认 active tab 为 `kind: apps`、`currentUrl: nextclaw://apps?tab=service-apps`、`dedupeKey: apps`。
- 前进后退入口冒烟：通过 Playwright 注入打开的 Docs tab，点击 `New Tab` 再点击 `Service Apps` 后确认 active history 为 docs -> home -> service apps；点击 Back 回到 home，再点击 Back 回到 docs，点击 Forward 回到 home。
- 浏览器边界冒烟：通过 Playwright 从 active history 中间项开始，确认 Back / Forward 可用状态由 `activeHistoryIndex` 决定，且 index 不越界。
- 手动导航入栈测试：验证后退后再手动打开新目标时，当前指针后的 forward 栈被截断，新目标追加为 history 最新项；连续手动打开当前同一目标不会重复入栈。

## 发布/部署方式

- 未发布。
- 本次只修改前端源码与样式，后续随常规前端发布批次进入包发布或桌面打包。

## 用户/产品视角的验收步骤

1. 打开 NextClaw 桌面或 Web UI。
2. 打开内嵌浏览器。
3. 确认顶部只有一行：tabs 位于左侧滚动区，添加按钮、浮动/停靠按钮、关闭按钮固定在右侧。
4. 点击添加按钮，确认打开导航页而不是直接打开文档首页。
5. 确认导航页以自适应图标网格展示应用、服务应用、文档和市场入口，宽度变化时列数随可用空间变化。
6. 创建多个标签，确认标签区域横向滚动条贴近底部分界线且明显变薄。

## 可维护性总结汇总

- 已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 口径复核。
- 本次正向减债动作为删除与职责收敛：删除独立 `DocBrowserPanelHeader` 组件，把窗口级操作合并进现有 `DocBrowserTabStrip`，避免标题栏和标签栏重复承担顶部 chrome 职责。
- 顶部 UI owner 更集中：加号、浮动/停靠、关闭都归右侧固定 action group；tabs 只负责选择、关闭和横向滚动。
- 新增 `doc-browser-home-page.tsx` 是展示组件，不新增 manager/service 假 owner；新建页 tab 语义由 doc browser URL owner 提供。
- 新增 route registry 作为 URL/route 事实源，首页组件只负责展示与触发 target，减少组件内业务跳转规则。
- 继续保留现有 `DocBrowserStore` 和 `DocBrowserManager`，避免引入第二套平行状态系统；本次是职责补全，不是重建。
- 顶栏前进后退收敛到 `DocBrowserManager` 的全局 active history，避免继续混用单 tab URL history 与页面激活历史。
- 补充 active-history 合同测试，避免 UI 入口看起来可用但实际 active 页面切换历史漂移。

## NPM 包发布记录

不涉及 NPM 包发布。
