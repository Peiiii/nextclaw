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
- Native Agent 的 `ReplyFormatContextProvider` 增加极短的可视化路由：当空间布局能明显提升理解时，先读取内置 `visualize-output` skill；简单答案继续使用自然 Markdown，可复用应用和持续工作流仍归 `nextclaw-app-creator`。
- 新增内置 `visualize-output` skill，统一选择 Markdown、表格、Mermaid、图片或自包含内联 HTML；它只负责当前回答的结果展示，不接管 Panel App / Service App 创建职责。
- 内联 HTML 明确采用“页面即画布”：一个表面只表达一个主要结论，不重复文件名、内部工具栏或总卡片，不依赖 document 级滚动，并按宿主 `240px -> min(80vh, 720px)` 的自适应高度合同控制信息密度。

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
- 完整源码构建产生的 `packages/nextclaw/ui-dist` 哈希漂移已通过仓库标准 `pnpm clean:generated` 恢复，没有覆盖工作区中的其他并行改动。
- Agent 可视化后续定向测试：`pnpm --filter @nextclaw/core exec vitest run src/features/agent/features/tests/skills.test.ts`，1 file / 11 tests 通过；`pnpm --filter @nextclaw/kernel exec vitest run src/contributions/context-provider/providers/reply-format-context.provider.test.ts src/contributions/context-provider/providers/context-provider-contract.provider.test.ts`，2 files / 2 tests 通过。覆盖内置 skill 发现与加载、双语 metadata、系统提示路由和完整 context provider 组装。
- Agent 可视化后续 TypeScript：`pnpm --filter @nextclaw/core tsc` 与 `pnpm --filter @nextclaw/kernel tsc` 通过；两个 package lint 均为 0 error，仅保留与本次无关的既有 warning。
- Chat UI 收束测试：`pnpm --filter @nextclaw/agent-chat-ui exec vitest run src/components/chat/ui/chat-message-list/__tests__/chat-message-markdown.test.tsx` 通过；覆盖完成态内联 HTML 只保留展示声明，以及非 HTML 内联文件仍保留周围正文。
- `pnpm --filter @nextclaw/core build` 通过，并确认发布产物 `dist/skills/visualize-output/SKILL.md` 包含内联 HTML 与 `min(80vh, 720px)` 合同；随后 `pnpm clean:generated` 与 `pnpm check:generated-clean` 通过。
- Agent 可视化后续治理：全量收尾重跑 `pnpm lint:new-code:governance` 与 `pnpm check:governance-backlog-ratchet` 均通过。maintainability guard 为 0 error；`context-provider/providers` 仍是 14 个同角色 provider 文件且已有 README 豁免，本次没有新增 provider 或扩大目录。
- `skill-creator` 的 Python `quick_validate.py` 因本机两个 Python runtime 均缺少 `PyYAML` 未能启动；已改用仓库实际 `SkillsLoader` 测试和本地 `yaml@2.8.2` 解析校验 frontmatter、目录名与双语描述，均通过。
- 真实模型前向验收：使用当前源码构建和从用户配置复制的真实 provider 配置，在独立 `NEXTCLAW_HOME=/Users/peiwang/.nextclaw-source-runtime/deepseek-visual-smoke`、独立 workspace 与端口 `18889` 启动隔离实例；没有重启、替换或写入用户正在使用的主实例。最终使用 `deepseek/deepseek-chat` 和不包含设计、内联或存储指令的自然请求创建会话 `visual-html-deepseek-natural-20260717-0942`。模型首个工具调用读取 `visualize-output`，产物写入 `NEXTCLAW_HOME/assets/visualizations/<session-id>/revenue.html`，没有调用 `show_file`、`show_url` 或 browser 旁路；会话与产物接口均返回 HTTP 200。
- 前向抽样按 `0918 -> 0921 -> 0930 -> 0935 -> 0938 -> 0942` 逐步暴露并闭合了外部展示旁路、错误差值、重复正文、区间增长误称累计增长、总体目标误拆成类别目标和临时目录失效风险。对应约束已进入 system context 与 `visualize-output` skill：用户只需自然表达“可视化”，Agent 自主选媒介；展示数据只来自输入和必要的工具计算，总体目标只与同口径总体实际比较，产物固定落入 NextClaw 持久会话资产目录。
- 最终 DeepSeek HTML 独立核对通过：可见画布没有文件名、页面大标题、根卡片、边框或阴影，`html/body` 背景透明；月度值、渠道值、季度合计 `414万`、目标 `400万`、达成率 `103.5%` 和超额 `14万` 均与输入及工具计算一致，也没有再创造类别目标语义。模型额外展示了两个正确命名且计算正确的环比值；这不是输入事实错误，但仍说明模型遵循具有概率性。
- 宿主增加确定性结果边界：完成态 assistant 文本只要包含有效的 rendered HTML `nextclaw-inline` 声明，就只渲染该声明，隐藏模型在声明前后的验证清单、引导语和数据复述；streaming、用户消息和非 HTML 文件不受影响。真实 `0942` 会话验证中，消息正文的校验清单与绝对路径均消失，只保留一个 iframe。
- 真实浏览器验收：宿主视口实测 `768px × 538px`，圆角 `12px`、边框 `0`、阴影 `none`，运行时高度为 `538px`，当前视口上限为 `576px = 80vh`，符合 `min(80vh, 720px)`。外置工具条宽 `54px`，相对预览水平中心偏差 `0px`，位于预览上方且不重叠；静止态为 `opacity=0`、`pointer-events=none`，预览区域没有默认空白。浏览器控制层未提供可靠的 iframe hover 注入，因此 hover 动画仍由 CSS 合同、组件测试和用户在已打开会话中的手动移动验收覆盖。
- 真实验收还发现一次构建顺序问题：`@nextclaw/ui` 曾在新的 `@nextclaw/agent-chat-ui` 产物生成前打包，导致源码测试通过但隔离实例仍消费旧守卫。最终按 `agent-chat-ui -> ui -> nextclaw copy-ui-dist` 顺序重建并重启隔离实例后通过；这次问题属于验收产物陈旧，不是运行时 fallback，不能用继续堆提示词掩盖。

## 发布/部署方式

- 本批变更纳入当前 `master` 全量收尾提交并推送至 `origin/master`；未执行部署、NPM 发布、GitHub release 或服务重启。
- 不涉及数据库 migration、后端部署、runtime update channel 或远程 API 冒烟。
- 变更由 `.changeset/inline-html-preview-natural-flow.md` 记录，后续随 `@nextclaw/ui` patch 统一发布。
- 同批 Agent 可视化扩展同步纳入该 changeset，后续随 `@nextclaw/agent-chat-ui`、`@nextclaw/core`、`@nextclaw/kernel` 与 `@nextclaw/ui` patch 统一发布。

## 用户/产品视角的验收步骤

1. 在聊天消息中打开一个 `viewer="rendered"` 的 `.html` 或 `.htm` 内联预览。
2. 确认预览上方不再显示文件标题或文件路径。
3. 确认预览外层没有边框或阴影，仅保留与图片一致的轻微圆角，HTML 内容自然接续在消息正文中。
4. 静止时确认预览上方没有工具条、弱提示或额外空白；将鼠标移入 HTML 预览后，确认工具条才会出现在 iframe 外部正上方并水平居中。
5. 将鼠标从预览移向工具条，确认工具条持续显示且不与 HTML 内容重叠；也可用 Tab 聚焦验证键盘可达性。
6. 使用短页面和长页面分别验证：预览从 `240px` 起按内容增高，最高不超过视口高度的 80% 或 `720px`；更长内容在 iframe 内部滚动。
7. 点击“展开到侧栏”，确认右侧工作区打开 rendered HTML；点击“打开源码”，确认右侧工作区打开源码视图。
8. 再打开 Markdown 或其他非 HTML 文件预览，确认原有文件标题和卡片识别信息仍然保留，且不出现 HTML 专属工具条。
9. 请求 Agent 把一组适合比较、流程或空间排版的数据“可视化”，确认系统上下文能发现并读取 `visualize-output`，并选择最小合适媒介，而不是每次都强制生成 HTML。
10. 当 Agent 选择内联 HTML 时，确认消息内直接出现 rendered 文件预览；页面本身就是唯一表面，不再套一层总卡片，也不重复文件名、预览标题栏或内部操作工具栏。
11. 使用内容高度约 `320px-640px` 的样例确认核心结果无需 document 级滚动；内容明显超过 `min(80vh, 720px)` 时，应删减为摘要或改用 side panel。

## 可维护性总结汇总

- 代码与测试合计新增 468 行、删除 72 行，净增 396 行；非测试生产代码新增 194 行、删除 32 行，净增 162 行。
- 本批次新增了用户可见的侧栏预览、源码入口与内容高度自适应；生产代码增长来自两枚可访问操作、HTML / 非 HTML 条件视图和同源 iframe 测量桥。临时高度只归内联展示组件，不进入 store；测量生命周期归 iframe renderer，没有新增 manager/service 抽象。
- 正向减债动作：删除单用途文件名 helper，复用现有 `IconActionButton`、i18n 文案、`ChatThreadManager.openFilePreview` 主链路与现有 HTML iframe renderer，避免复制侧栏状态、打开逻辑或新增服务端注入协议。
- 测试减债：在守卫发现消息容器测试进入 80% 预算线后，将 HTML 预览行为迁到 `chat-inline-file-preview.test.tsx`，容器测试只保留 manager wiring；该警告已消除，没有通过提高预算或增加 ESLint 豁免规避。
- 文件组织：当前属于 `nextclaw-ui` 现有多 feature（L2）包内结构，继续使用 message/workspace feature 的 `components/__tests__` 白名单；新增 `chat-inline-file-preview.test.tsx` 与 `workspace-file-content-preview.test.tsx`，以 `.test` 角色分别贴近展示组件和 iframe renderer，未新增 feature、shared、barrel 或白名单外目录。
- `post-edit-maintainability-review` 结论：通过，无阻塞性可维护性问题；保留两处既有近预算 watchpoint，后续拆分缝分别是 workspace preview fixtures/builders 与内容解析/展示分支。
- Agent 可视化后续的 TypeScript 增减为新增 55 行、删除 2 行，净增 53 行；其中回归测试新增 51 行，生产 TypeScript 新增 4 行、删除 2 行，净增 2 行。另新增 76 行按需加载的 `visualize-output` skill，并在内置 skill 索引增加 1 行；详细视觉、媒介、数据保真和 HTML 画布合同都留在渐进披露 skill，常驻 system context 只保留必须触发读取与阻断错误旁路的最小门禁。
- 后续扩展复用现有 `ReplyFormatContextProvider`、`SkillsLoader` 和 `nextclaw-inline` 文件目标，没有新增 provider、manager、loader 分支或第二条展示协议；`visualize-output` 与 `nextclaw-app-creator` 的职责按“当前回答展示 / 可复用应用”明确分开。
- 后续 `post-edit-maintainability-review` 结论：通过，no maintainability findings；唯一目录 warning 已有豁免且文件数未增长，新增 skill 是独立的渐进披露 owner，不是常驻提示词复制。

## NPM 包发布记录

- `@nextclaw/ui`：需要 patch，待统一发布。
- `@nextclaw/agent-chat-ui`：需要 patch，完成态内联 HTML 只保留可视结果，待统一发布。
- `@nextclaw/core`：需要 patch，新增内置 `visualize-output` skill，待统一发布。
- `@nextclaw/kernel`：需要 patch，Native Agent 系统提示新增可视化 skill 路由，待统一发布。
- Changeset：`.changeset/inline-html-preview-natural-flow.md`。
- 本次未执行 NPM 发布。
