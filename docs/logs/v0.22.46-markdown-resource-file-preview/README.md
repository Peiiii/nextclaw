# v0.22.46-markdown-resource-file-preview

## 迭代完成说明

本批统一解决 Linear NC-115 与 NC-112 的消息资源展示问题。根因有两个连续断点：`file:` URI 在 `react-markdown` 默认 URL 转换阶段就被清空，既有本地资源 parser 也没有读取 GitHub 风格的 `#L<line>C<column>` fragment；补齐 parser 后，工作台又把目标行错误地当成预览首行并显示为右上角 tag，既没有真实定位，也破坏了文件行号。与此同时，`nextclaw-inline` 的 parser 和类型已经接受 `file` target，但 NextClaw 产品 renderer 只接入了 `panel_app`，文件目标没有进入已有 workspace 文件预览 owner。

修复覆盖消息资源链路的两个错误 hop：Markdown 资源通过唯一的安全 URL transform 保留合法 `file:` URI，并统一归一化为既有 `ChatFileOpenActionViewModel`；文件位置只作为导航状态，大文件读取返回目标行附近的有界窗口与真实 `startLine`，代码表面负责一次性滚动、当前行强调和列光标，不再把位置混入路径面包屑。inline file target 只新增消息内 placement adapter，继续复用 `createWorkspaceFileTab`、`ChatSessionWorkspaceFilePreview`、内容 URL 和现有文件 renderer。HTML `viewer=rendered` 保留现有脚本与内容交互语义，没有借本议题收紧 iframe 权限。

方案与兼容边界记录在 `docs/designs/2026-07-14-markdown-resource-links-and-inline-file-preview.design.md`。

## 测试/验证/验收方式

- `@nextclaw/agent-chat-ui` 定向测试 37 项通过，覆盖真实 NC-115 `file:///.../@nextclaw/...#L5713`、Windows 行列 fragment、非法零值、远端 host 拒绝、目标行列滚动与既有路径/图片/危险协议回归。
- `@nextclaw/ui` 定向测试 41 项通过，覆盖内联位置、路径面包屑、目标位置透传和行定位默认打开源码；`@nextclaw/server` 组装路由测试 14 项通过，确认请求第 80 行时返回从真实第 60 行开始且包含目标行的窗口。
- `@nextclaw/agent-chat-ui`、`@nextclaw/client-sdk`、`@nextclaw/server`、`@nextclaw/ui` 的 TypeScript 检查和 production build 均通过。
- 四个受影响包的 package-level ESLint 均为 0 error；仅保留与本批无关的既有维护性 warning，当前触达文件定向 ESLint 为 0 error、0 warning。
- 在 `http://127.0.0.1:5174/chat/sid_bmNwLW1ya284Z3NkLWY2NWUyNGM4` 真实验收：`file:///tmp/dev-demo.html#L12` 点击后，路径栏只显示 `/ > tmp > dev-demo.html`，不再出现 `L12` tag；正文保持真实 `1..30` 行号，唯一当前位置是实际第 12 行 `</style>`，已滚动到可见区域并显示轻量当前行状态。
- 构建后运行 `pnpm clean:generated` 与 `pnpm check:generated-clean`；可维护性 guard 与治理结果见下方汇总。

## 发布/部署方式

本次未执行发布或部署。已新增 `.changeset/markdown-resource-file-preview.md`，后续随 `@nextclaw/agent-chat-ui`、`@nextclaw/client-sdk`、`@nextclaw/server` 与 `@nextclaw/ui` 统一发布 patch。

不涉及数据库、migration 或远程部署。既有 `server-paths/read` API 增加可选目标行参数和 `startLine` 响应字段，客户端 SDK 已同步；本地源码 dev server 已完成真实页面验收。

## 用户/产品视角的验收步骤

1. 在任意会话消息中展示 `[源码](file:///absolute/path/index.js#L12C4)`，确认链接保持可点击；点击后工作台路径栏不显示行号 tag，源码保留真实行号，并定位到第 12 行、第 4 列。
2. 输出一个 `nextclaw-inline` fenced block，将 target 设为 `file`，path 指向 HTML，viewer 设为 `rendered`，确认 HTML 在消息原位显示且保留已有页面交互。
3. 将 target 改为 Markdown、图片、音视频、PDF、DOCX、XLSX 或 PPTX，确认继续复用同一 workspace 文件预览表面。
4. 使用 `file://remote-host/...` 或 `javascript:` 链接，确认链接被禁用且不会交给文件打开 owner。

## 可维护性总结汇总

- 本批没有新增文件 reader、manager、service、registry、server route 或私有 URI scheme；既有 server-path read 增加目标窗口语义，链接和 inline 入口最终仍收敛到同一文件 action 与 workspace preview owner。
- `ChatMessageMarkdown` 不再在 `<a>` 与 `<img>` renderer 内重复安全 resolver，而是统一消费 AST 到 React 之间的单一 URL transform。
- 新增组件只负责 inline placement、标题、只读路径和 session 参数连接，不显示 descriptor description，也不把 workspace 的可点击面包屑搬进消息；代码表面新增的 layout effect 只同步一次 DOM 滚动，不承载业务编排。
- 位置合同按单一事实 owner 收敛：parser 解析 URI，workspace tab 保存目标，server-path read 返回真实窗口，code surface 呈现当前位置；路径面包屑不再重复持有位置字段。
- maintainability guard 定向检查 24 个源码/测试文件：0 error、9 个预算 warning；触达范围新增 765 行、删除 284 行、净增 481 行，排除测试后新增 485 行、删除 156 行、净增 329 行。本批属于新增用户可见资源预览与定位能力，增长主要来自标准 URI 输入合同、inline placement、目标窗口读取和代码表面定位；没有复制第二套文件读取或 renderer。
- 9 个 warning 均为接近预算的既有文件或带豁免的历史目录；其中 workspace 预览测试文件本批净减 2 行，消息容器净减 3 行。`ChatSessionWorkspaceFilePreview` 当前 438/500 行、本批增长 22 行，是后续最需要观察的拆分缝。
- 治理检查和 backlog ratchet 通过；`shared/lib/api/utils` 保留一个历史扁平目录 warning，本批没有新增根目录文件或平行 API facade。
- 已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 进行收尾复核；没有为了压行数删除类型、协议保护或把复杂度移到测试/文档。
- 可维护性复核结论：通过；no maintainability findings。位置语义分别归 parser、workspace tab、server-path read 与 code surface，breadcrumb 删除了位置字段和 tag 分支；`useLayoutEffect` 只同步一次外部 DOM 滚动，不承载业务状态迁移。

## NPM 包发布记录

本次未发布 NPM 包，以下包均为 patch、待统一发布：

- `@nextclaw/agent-chat-ui`
- `@nextclaw/client-sdk`
- `@nextclaw/server`
- `@nextclaw/ui`
