# v0.23.16 HTML 内联预览自然化

## 迭代完成说明

- 聊天中的 rendered HTML 预览不再展示文件标题和路径，也不再使用边框与阴影卡片外壳；仅保留与图片预览一致的轻微圆角，使 HTML 内容像 Markdown 正文一样自然进入消息流。
- HTML 预览外部正上方新增水平居中的悬浮工具条；静止时零视觉、零布局占位、零点击命中，仅在 hover 或键盘聚焦后完整显示。
- 工具条与 iframe 内容区域之间保留不可见的 hover bridge，鼠标从预览移向外部工具条时不会因离开内容边界而闪退，工具条也不会遮挡 HTML 页面。
- 工具条提供“展开到侧栏”和“打开源码”两个入口，分别在右侧工作区打开 rendered HTML 与源码视图。
- rendered HTML iframe 加载后通过同源 `ResizeObserver` 测量桥上报真实内容高度；内联预览从 `240px` 起步，随内容升高，并以 `min(80vh, 720px)` 作为接近一屏的硬上限，超过后继续使用 iframe 内部滚动。
- 测量是纯观察路径，不修改用户 HTML 或服务端原始响应，也不新增全局 `postMessage` 协议；同源测量不可用时保留有界初始高度，预览本身仍可使用。
- 改动收敛在现有 `ChatInlineFilePreview` 展示 owner与 `WorkspaceFileContentPreview` iframe renderer；workspace 文件 URL、加载方式和右侧工作区全高布局保持不变。
- 两个操作继续复用现有 `onFileOpen -> ChatThreadManager.openFilePreview -> workspace tab` 主链路，没有新增侧栏状态或平行打开通道。
- Markdown、源码和其他非 HTML 内联文件仍保留原有文件标题与卡片外壳，避免扩大改动范围。
- 没有新增 store、CSS 覆盖、全局消息协议或平行预览路径；复用了 `IconActionButton`、现有图标与 i18n 文案，同时删除了只使用一次的文件名 helper。唯一新增 effect 只负责外部 `ResizeObserver` 生命周期清理，不承载业务编排。
- 根据本次连续交互纠偏，已在 `frontend-interaction-quality` 规则中补充纯 hover 浮层的零默认足迹与外置 hover bridge 约束，避免同类控件再次常驻占位或闪退。

## 测试/验证/验收方式

- 定向测试：`pnpm --filter @nextclaw/ui exec vitest run src/features/chat/features/message/components/__tests__/chat-message-list.container.test.tsx src/features/chat/features/message/components/__tests__/chat-inline-file-preview.test.tsx src/features/chat/features/workspace/components/__tests__/chat-session-workspace-file-preview.test.tsx src/features/chat/features/workspace/components/__tests__/workspace-file-content-preview.test.tsx`，4 files / 46 tests 通过；覆盖 HTML 无 chrome、非 HTML 保持原样、两个操作动作、初次高度上报、动态增长、observer 清理、iframe DOM 身份连续性及既有 workspace 预览回归。
- TypeScript：`pnpm --filter @nextclaw/ui tsc` 通过。
- 触达文件 ESLint 通过；`pnpm --filter @nextclaw/ui lint` 为 0 error，仅保留 `cron-config.tsx` 的 1 条既有 cognitive-complexity warning。
- `pnpm lint:new-code:governance` 与 `pnpm check:governance-backlog-ratchet` 通过。
- `post-edit-maintainability-guard --paths ...`：检查 7 个触达文件，0 error、2 warning；本次包含新增用户能力，因此使用 feature 口径。两条 warning 分别是既有 workspace 测试文件接近 900 行预算（本次净减 1 行）和 workspace preview owner 接近 500 行预算（本次新增 2 行可选回调透传），均未继续扩大职责或引入新抽象。
- 真实页面验收：在当前源码 Vite 实例 `http://127.0.0.1:5174/chat/sid_bmNwLW1ya3IyYWJtLWI1YjkyMmQ5` 中打开“HTML 内联预览验收”会话；两处 HTML 视口均为 `borderRadius=12px`、`borderTopWidth=0px`、`boxShadow=none`，与图片预览的 `rounded-lg` 合同一致。
- 工具条静止状态：两处预览均为 `opacity=0`、`pointerEvents=none`、`paddingTop=0px`、视口与根节点顶部偏差 `0px`，确认没有弱提示、点击命中或布局占位。
- 工具条外置几何：两处工具条相对视口的水平中心偏差分别约为 `-0.004px` 与 `0px`，垂直间距均为 `8px`，且 `overlapsViewport=false`；键盘聚焦“展开到侧栏”后 `focus-within=true`、`opacity=1`、`pointerEvents=auto`，焦点移开后恢复完全隐藏。
- 高度自适应真实状态：两处预览均收到 iframe 的运行时高度上报并写入 `style.height=240px`，当前浏览器内容区对应的计算上限为 `576px`；这证明运行实例消费了同源测量桥，而非只停留在 CSS 默认高度。动态增高探针因浏览器控制层 webview 断开未完成页面内注入，动态增长、上限合同和 iframe 节点不重挂载由组件测试直接覆盖。
- 浏览器控制层未能向 iframe 表面注入可观察的 `:hover` 状态，因此纯鼠标悬停仍以 Tailwind `group-hover` 合同、组件回归测试和外置 hover bridge 几何验证为证据；真实页面的静止态、聚焦态、位置和视觉已经完成验收。
- 真实操作验收：点击“展开到侧栏”后出现 `预览: HTML 内联预览验收` workspace tab 与“关闭工作区侧栏”控件，证明按钮进入现有右侧工作区主链路；验收后已关闭侧栏还原页面。
- 直接请求 Vite 转换后的 `chat-inline-file-preview.tsx` 返回 200，并确认运行实例消费了本次 `isRenderedHtml` 分支。
- 未运行生成物清理：工作区已有不属于本任务的 `packages/nextclaw/ui-dist` 改动，避免覆盖并行工作。

## 发布/部署方式

- 本次执行本地 git 提交；未执行 push、部署、NPM 发布、GitHub release 或服务重启。
- 不涉及数据库 migration、后端部署、runtime update channel 或远程 API 冒烟。
- 变更由 `.changeset/inline-html-preview-natural-flow.md` 记录，后续随 `@nextclaw/ui` patch 统一发布。

## 用户/产品视角的验收步骤

1. 在聊天消息中打开一个 `viewer="rendered"` 的 `.html` 或 `.htm` 内联预览。
2. 确认预览上方不再显示文件标题或文件路径。
3. 确认预览外层没有边框或阴影，仅保留与图片一致的轻微圆角，HTML 内容自然接续在消息正文中。
4. 静止时确认预览上方没有工具条、弱提示或额外空白；将鼠标移入 HTML 预览后，确认工具条才会出现在 iframe 外部正上方并水平居中。
5. 将鼠标从预览移向工具条，确认工具条持续显示且不与 HTML 内容重叠；也可用 Tab 聚焦验证键盘可达性。
6. 使用短页面和长页面分别验证：预览从 `240px` 起按内容增高，最高不超过视口高度的 80% 或 `720px`；更长内容在 iframe 内部滚动。
7. 点击“展开到侧栏”，确认右侧工作区打开 rendered HTML；点击“打开源码”，确认右侧工作区打开源码视图。
8. 再打开 Markdown 或其他非 HTML 文件预览，确认原有文件标题和卡片识别信息仍然保留，且不出现 HTML 专属工具条。

## 可维护性总结汇总

- 代码与测试合计新增 468 行、删除 72 行，净增 396 行；非测试生产代码新增 194 行、删除 32 行，净增 162 行。
- 本批次新增了用户可见的侧栏预览、源码入口与内容高度自适应；生产代码增长来自两枚可访问操作、HTML / 非 HTML 条件视图和同源 iframe 测量桥。临时高度只归内联展示组件，不进入 store；测量生命周期归 iframe renderer，没有新增 manager/service 抽象。
- 正向减债动作：删除单用途文件名 helper，复用现有 `IconActionButton`、i18n 文案、`ChatThreadManager.openFilePreview` 主链路与现有 HTML iframe renderer，避免复制侧栏状态、打开逻辑或新增服务端注入协议。
- 测试减债：在守卫发现消息容器测试进入 80% 预算线后，将 HTML 预览行为迁到 `chat-inline-file-preview.test.tsx`，容器测试只保留 manager wiring；该警告已消除，没有通过提高预算或增加 ESLint 豁免规避。
- 文件组织：当前属于 `nextclaw-ui` 现有多 feature（L2）包内结构，继续使用 message/workspace feature 的 `components/__tests__` 白名单；新增 `chat-inline-file-preview.test.tsx` 与 `workspace-file-content-preview.test.tsx`，以 `.test` 角色分别贴近展示组件和 iframe renderer，未新增 feature、shared、barrel 或白名单外目录。
- `post-edit-maintainability-review` 结论：通过，无阻塞性可维护性问题；保留两处既有近预算 watchpoint，后续拆分缝分别是 workspace preview fixtures/builders 与内容解析/展示分支。

## NPM 包发布记录

- `@nextclaw/ui`：需要 patch，待统一发布。
- Changeset：`.changeset/inline-html-preview-natural-flow.md`。
- 本次未执行 NPM 发布。
