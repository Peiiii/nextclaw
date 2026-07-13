# v0.22.38 统一本地文件预览状态

## 迭代完成说明

- Markdown 本地文件链接与项目文件树已经确认只负责生成统一的文件打开动作，最终都进入 `ChatThreadManager.openFilePreview`、workspace file tab 和同一个 `ChatSessionWorkspaceFilePreview`；没有为项目文件树保留第二套预览器。
- 图片、音频和视频误显示“内容已截断”的根因，是 workspace 预览同时请求了最多 200KB 的文本预读与完整内容 URL，却无条件把预读的 `truncated` 状态投射到面包屑。现在由预览编排 owner 按当前实际内容平面派生 `isTextPreviewTruncated`：富内容 renderer 不继承文本预读状态，大文本/Markdown 源码仍保留真实截断提示。
- DOCX 失败的现场根因不是 Word renderer 缺失，而是此前验收环境把当前源码 UI 代理到旧版全局安装服务；新 UI 使用 query content route，旧服务只认识旧 path route，因此请求在进入 DOCX renderer 前返回 400。切换到同一提交构建的源码服务后，同一文件返回正确 MIME 和完整字节，并可正常渲染。
- 修复遵循单一链路和状态 owner 原则：没有按文件后缀维护隐藏提示名单，没有新增兼容 fallback、manager、resolver 或平行预览实现。
- 已补充 `docs/designs/2026-07-13-local-resource-and-office-preview.design.md`，明确入口汇合、有限预读与完整内容两个数据平面、状态归属、版本配对合同和跨入口验收矩阵。
- HTML 与 Markdown 的源码/预览现已建模为独立 workspace tab：HTML 默认源码、Markdown 默认预览；“打开预览/打开源码”会在来源旁新增或聚焦对应 tab，不在同一个 tab 内改写 viewer。
- 此前刷新后活跃文件视图可能丢失，根因是 workspace 文件 tab 以最新在前保存，却用尾部裁剪保留最旧 tab，并且 hydrate 时未把活跃 tab 与当前 workspace parent 一起校验。现在持久化裁剪始终保留活跃 tab，恢复时只从当前会话的文件 tab 解析选中项。
- 文件操作入口不再占用默认标题宽度：槽位在 hover/focus 时才进入布局；源码标题保持普通样式，预览标题使用“预览: 文件名”斜体表达。执行菜单动作后不再把焦点还给旧触发器，避免操作图标与 Tooltip 常驻。

## 测试/验证/验收方式

- `@nextclaw/ui` 定向测试：workspace preview、workspace panel content、chat thread manager 共 3 个测试文件、56 项测试通过。
- `@nextclaw/agent-chat-ui` Markdown 本地资源测试：1 个测试文件、27 项测试通过。
- 当前源码服务 `GET /api/server-paths/content?path=...overview.zh-CN.docx` 返回 `200`、正确 DOCX MIME 与 13,841 字节完整内容。
- 真实浏览器从项目文件树打开 `overview.zh-CN.docx`，DOCX renderer 生成 51,585 字节 DOM，无失败或截断提示。
- 真实浏览器打开 1000×1432 PNG、487.64 秒 WAV 和 1280×720 MP4：媒体均完整加载、原生控件可用、`readyState=4`，无“内容已截断”。
- 真实浏览器打开 395,241 字节文本，仍显示“内容已截断”，证明提示只收敛到正确的文本预览语义。
- `@nextclaw/ui` 全量测试 163 个测试文件、707 项测试通过；最终 owner 拆分后，workspace renderer、panel、view model、manager、store、文件类型图标和 Tab primitive 共 7 个定向测试文件、78 项测试再次通过。
- `@nextclaw/ui` TSC 通过；本次触达的 21 个 TypeScript/TSX 源码与测试文件 ESLint 通过。包级 ESLint 为 0 错误，仅保留无关 `cron-config.tsx` 的 1 条历史认知复杂度 warning。
- 真实浏览器从消息中的 `index.html` 打开源码 tab，通过“打开预览”新增相邻预览 tab；刷新同一会话后工作台、源码/预览双 tab 与活跃 HTML iframe 均恢复。菜单动作完成后两个操作槽位均回到 `width: 0px; opacity: 0`，无残留 Tooltip。
- `CI=true pnpm lint:new-code:governance` 与 `CI=true pnpm check:governance-backlog-ratchet` 通过；`git diff --check` 通过。
- maintainability guard 按本次 21 个源码/测试文件定向检查：0 错误、5 个接近预算 warning；总代码新增 931 行、删除 142 行，非测试代码新增 689 行、删除 124 行。本次是新增用户能力，因此不套用非功能改动净增门槛。
- 源码构建产生的 `packages/nextclaw/ui-dist` 漂移已通过 `pnpm clean:generated` 恢复，源码 API 18888 与 Vite UI 5174 健康检查均为 200。

## 发布/部署方式

- 本次未执行部署、NPM 发布或 desktop 发布。
- 当前源码 UI 已连接同版本源码服务用于本地验收；旧版全局服务保持不动。
- 不涉及数据库 migration、远程 API migration 或后端协议新增。

## 用户/产品视角的验收步骤

1. 打开任意会话的工作台，进入“项目文件”。
2. 分别打开大于 200KB 的图片、音频和视频，确认使用图片或浏览器原生播放器完整展示，面包屑不再出现“内容已截断”。
3. 打开 `.docx`，确认文档直接在工作台中渲染，不出现“文件预览失败”。
4. 打开大于 200KB 的文本或 Markdown 源码，确认仍显示“内容已截断”。
5. 从消息中的 Markdown 本地文件链接打开同一文件，确认进入与项目文件树一致的 workspace tab 和预览体验。
6. 打开 HTML 或 Markdown 文件的“文件操作”，选择“打开预览/打开源码”，确认对应视图作为独立 tab 打开；刷新页面后仍保持工作台与当前视图。

## 可维护性总结汇总

- 富内容截断修复没有新增分支表或兼容层，只把原有无条件 `truncated` 投射收紧为当前文本内容平面的派生状态。
- 双视图扩展名判断已收敛到 workspace 私有的纯 viewer utility，manager、view model 与 renderer 复用同一事实源；Tab primitive 只接收通用 action，不识别 HTML、Markdown 或业务文案。
- 文件 Tab 的值构造、相邻插入与去重被拆到 workspace 私有纯工具，持久化保留规则归到 persistence utility；`ChatThreadManager` 继续只负责编排导航与激活，store 只负责 Zustand 状态和持久化接线。
- 文件打开入口、tab owner、内容平面与 renderer 边界在设计文档中得到显式约束，后续新增富内容类型会自动遵守同一状态规则。
- maintainability guard 无阻塞项；manager 为 599/600 行、store 为 398/400 行，两个文件都已通过职责拆分回到预算内。预览测试、manager 测试与预览组件仍接近预算，后续扩展前应先拆 fixtures/builders 或 renderer 分支。
- 主观复核无阻塞 finding：双视图仍只有一个 viewer 事实源和一条激活链路，没有新增 effect、平行 store、兼容 fallback 或重复 renderer；结构拆分用于明确纯值逻辑与状态编排边界，不是压行规避门槛。

## NPM 包发布记录

- 需要发布：是，本次修复用户可见的工作台文件预览错误状态。
- 包：`@nextclaw/ui`。
- 版本策略：patch。
- 当前状态：已添加独立 changeset，待统一发布。
