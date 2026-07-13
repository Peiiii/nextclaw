# 本地资源 URI 与 Office 文件预览设计

## 背景

NextClaw 已能从消息中的 Markdown 链接打开本地文件，也能通过 `show_file` 在工作区侧栏展示文件。但当前链接、图片与侧栏预览没有共享完整合同：裸 `.docx` 链接会被安全层降成文本，本地图片路径没有被模型稳定使用，SVG 与 Office 文件的默认 viewer 行为也缺少统一定义。

本设计把“模型如何引用本地资源”和“UI 如何展示本地资源”收敛成一条主链路，并补齐 Word、Excel、PowerPoint 三类常用文档的本地预览。

## 现状依据

- `ReplyFormatContextProvider` 已规定本地文件使用 Markdown 链接，但没有说明 Markdown 图片可以直接使用本地绝对路径，也没有给出 Office 裸文件名示例。
- `ChatMessageMarkdown` 分别处理 `<a>` 与 `<img>`，但两者依赖的本地路径识别只允许有限扩展名；`.docx/.xlsx/.pptx` 不在裸文件名范围内。
- `show_file` 已默认产生 `viewer: auto`，工作区预览也能通过 server-path content API 读取二进制文件。
- 真实会话中的 DOCX 文件可由 `/api/server-paths/read` 正确识别为 binary，并由 `/api/server-paths/content` 原样返回，因此失败点位于前端资源识别与 viewer 选择，而不是文件生成或传输。

## 核心判断

1. Markdown 语法是否成立与目标资源是否可用是两个独立事实。只要 Markdown 链接语法成立，UI 就必须先把它渲染成链接；目标失效、文件缺失或无法预览，应在用户点击后通过明确状态反馈，不能预先降级成普通文本。
2. Markdown 链接与 Markdown 图片必须共享同一个“本地资源 href”语法，只在最终展示动作上分流。
3. 图片优先直接写成 Markdown 图片；只有用户要求在侧栏检查文件、需要标题/面包屑或需要源码时，才调用 `show_file`。
4. `show_file` 的 `auto` viewer 按文件类型选择展示器。SVG 属于图片，只有显式 `viewer=source` 才展示源码。
5. Office 预览在浏览器本地完成，不把用户文件上传到第三方服务，也不使用要求公网可访问 URL 的在线 Office viewer。
6. Office 预览以现代 Open XML 格式为主：Word 支持 `.docx`，PowerPoint 支持 `.pptx`，Excel 支持 `.xlsx/.xlsm/.xlsb/.xls/.ods`。旧 `.doc/.ppt` 保留下载与系统打开 fallback。
7. `viewer=auto` 必须保留到 workspace 文件视图能力 owner：Markdown 归一化为预览，HTML 归一化为源码，SVG 与 Office 文件继续进入富内容 renderer，不能被提前改写成 `source`。

## 2026-07-14 统一性补充：入口、内容平面与状态归属

### 入口是否复用同一能力

Markdown 本地文件链接与项目文件树不是两套预览器。两者只是不同的入口适配器：

```text
Markdown 本地文件链接 -> parseChatLocalFileAction ┐
                                                   ├-> ChatThreadManager.openFilePreview
项目文件树文件项     -> ChatFileOpenActionViewModel ┘
                                                       -> ChatWorkspaceFileTab
                                                       -> ChatSessionWorkspaceFilePreview
                                                       -> WorkspaceFileContentPreview
```

两种入口最终共享同一个 workspace tab、同一个预览编排组件和同一组图片、音频、视频、PDF、HTML 与 Office renderer。Markdown 图片是唯一有意保留的展示分支：它使用相同的本地资源 parser 和 content URL 合同，但直接在消息正文内渲染，不打开 workspace tab。

因此，若 Markdown 文件链接可预览而项目文件树失败，应按共同链路排查路径事实、运行版本和内容请求，不能再给目录树增加一套预览实现。2026-07-14 的 DOCX 现场复现证明，失败发生在 `WorkspaceDocxPreview` 获取内容以前：源码 UI 生成 query content route，而被代理的旧版已安装服务只认识旧 path route。当前源码服务对同一 DOCX 返回正确 MIME 和完整字节。这属于验证环境把不同版本前后端混用，不是目录树缺少 Word renderer。源码验收必须使用同一提交构建的 UI 与 server，不在产品代码中增加静默重试旧路由的 fallback。

### 两个内容平面的边界

统一预览内部有两个用途不同的数据平面，不能把状态互相投射：

| 数据平面 | Owner | 用途 | 截断语义 |
| --- | --- | --- | --- |
| 文件预读 | `server-path read` | 解析路径、区分目录/文本/二进制，并为源码或 Markdown 提供最多 200KB 文本 | `truncated` 只表示当前文本预览未展示完整文件 |
| 原始内容 | `server-path content` | 向图片、音频、视频、PDF、HTML 和 Office renderer 提供文件字节 | 不使用 `read.truncated`；加载成败由 content 请求或 renderer 自己反馈 |

`ChatSessionWorkspaceFilePreview` 是两个平面的编排 owner，也是“当前展示状态”的 `information expert`。它必须遵守以下不变量：

- 当前由文本/Markdown/源码 surface 展示 `read.text` 时，才允许把 `read.truncated` 投射到面包屑。
- 当前存在有效 `contentUrl` 并交给富内容 renderer 时，图片、音频、视频、PDF、HTML、DOCX、表格和演示文稿都不得展示“内容已截断”。
- content 请求失败必须显示对应 renderer 的加载失败状态，不能伪装成文本截断，也不能退回 200KB 二进制预读。
- 文件类型只决定 renderer；入口来源不得影响 renderer、加载状态或错误语义。

推荐的结构性修复不是维护一份“哪些后缀不显示截断”的列表，而是由现有编排 owner 根据当前实际选择的内容平面派生 `isTextPreviewTruncated`。这同时覆盖所有现有和未来通过 `contentUrl` 渲染的富内容类型，符合 `simple-structure-first`，无需新增 manager、resolver 或第二套预览合同。

## 2026-07-14 源码与预览的并行 Tab 设计

### 产品语义

Markdown 与 HTML 的源码和渲染结果是同一文件的两种独立视图，不是一个 Tab 内部的临时显示状态。操作文案统一使用“打开预览”和“打开源码”，不使用“切换到预览/源码”：

- 源码 Tab 执行“打开预览”时，新建并选中同一文件的预览 Tab。
- 预览 Tab 执行“打开源码”时，新建并选中同一文件的源码 Tab。
- 对应视图已经打开时，不创建重复 Tab，直接聚焦现有 Tab。
- 新建的对应视图紧邻来源 Tab；两者可独立关闭、独立进入前进/后退历史，也可同时保留用于对照。
- 关闭其中一个视图不得改变另一个视图的 viewer，也不得让剩余 Tab 在源码与预览之间自动变形。

这符合 `information expert` 与 `protected variations`：文件路径是共享资源事实，viewer 是 Tab 身份的一部分；renderer 可以变化，但已打开 Tab 的身份与用户历史必须稳定。

### 默认 viewer 与能力边界

| 文件类型 | 默认打开方式 | 可执行操作 | 对应新 Tab |
| --- | --- | --- | --- |
| Markdown (`.md/.mdx`) | 预览 | 打开源码 | 源码代码 surface |
| HTML (`.html/.htm`) | 源码 | 打开预览 | 沙箱化 HTML 预览 |
| 普通文本与代码 | 源码 | 无双视图操作 | 不适用 |
| 图片、媒体、PDF、Office | 富内容预览 | 无源码操作 | 不适用 |

`auto` 只允许存在于入口动作中。`ChatThreadManager` 在创建 Tab 前根据文件能力把它归一化为有效 viewer；支持双视图的 Tab 必须持久化明确的 `source` 或 `rendered`，不能让 renderer 在组件内部再次猜测当前模式。Tab 的唯一身份至少由会话父节点、规范化路径、工作区 view mode 与有效 viewer 共同组成，因此同一路径的源码和预览不会互相覆盖。

HTML 的“预览”只表示安全的静态文档预览，不等同于可信应用运行环境。iframe 必须启用 sandbox，默认不授予同源、顶层导航、弹窗和脚本能力；需要执行脚本或与宿主交互的 HTML 应进入独立的 panel app/runtime 合同，不能借文件预览绕过安全边界。

### 操作入口：不占默认宽度的渐进操作

不采用“所有 Tab 永久显示更多按钮”，也不采用覆盖标题的悬浮按钮。推荐规则是：

- 文件 Tab 的操作槽位默认宽度为零，不占用标题空间；hover 或键盘 focus 时在正常布局流中展开到一个按钮宽度，让标题只在操作出现期间让位。
- 在触屏设备上，用户先点按 Tab 使其获得焦点，操作槽位随 `focus-within` 展开；不依赖永久可见按钮，也不牺牲触屏可达性。
- 操作入口使用竖向省略号，默认透明、无边框；hover/focus 的背景与同一 Tab 的关闭操作保持一致，不额外添加描边、阴影或白底悬浮层。
- 菜单第一项是当前最相关的对应视图操作：“打开预览”或“打开源码”；菜单同时提供“关闭”，保证触屏不依赖 hover 才能关闭。
- 菜单按钮必须有 `aria-label` 和焦点态；Popover 本身提供可见解释，不再嵌套 Tooltip，避免执行动作后旧触发器焦点与提示残留。Enter/Space 打开，方向键移动，Escape 关闭并把焦点还给原 Tab；执行导航动作后不把焦点还给旧 Tab。
- 桌面右键菜单只能作为后续快捷入口，不能成为唯一入口；未来若加入，必须复用同一份 Tab action view model，不能平行维护业务规则。

这种设计保留了每个 Tab 的操作归属，又避免窄侧栏和手机上为每个非活动 Tab 常驻一组按钮。与在工作区全局工具栏放一个含义不明的“更多”相比，入口附着在 Tab 上更能说明操作对象；与为“预览/源码”各加一个永久图标相比，文本菜单对未来扩展和无障碍更稳定。

当同一路径的两个视图同时存在时，源码 Tab 保持普通文件标题，不增加“源码”Tag；渲染 Tab 使用“预览: 文件名”并以斜体标题区分。完整路径进入 tooltip。模式不是状态徽章，禁止为了区分 viewer 挤占一个额外 Tag 的宽度。

### Owner 与实现边界

```text
Markdown 链接 / 项目文件树 / Tab 更多操作
  -> ChatFileOpenActionViewModel(path, requestedViewer)
  -> ChatThreadManager 解析有效 viewer、去重、相邻插入并选中
  -> ChatWorkspaceFileTab(path, effectiveViewer)
  -> WorkspaceTabViewModel 派生预览标题样式与 TabActionViewModel[]
  -> CompactTabStrip 只渲染通用菜单、焦点和触屏行为
  -> ChatSessionWorkspaceFilePreview 按 effectiveViewer 选择源码或渲染 surface
```

- 双视图能力表是 workspace file preview feature 的单一事实源，同时供 manager 的 viewer 归一化、Tab action 派生与 renderer 选择使用；禁止三处分别按后缀判断。
- `ChatThreadManager` 是打开/聚焦/排序/历史 mutation 的唯一 owner。React 组件只提交“为这个 Tab 打开对应 viewer”的意图，不直接拼 key、改 store 数组或自行去重。
- `WorkspaceTabViewModel` 承载业务动作描述；共享 `CompactTabStrip` 只接收通用的 action id、label、icon、disabled 与 handler，不识别 Markdown、HTML 或 viewer。
- Markdown 源码必须进入代码 surface，Markdown 预览继续复用 `ChatMessageMarkdown`；HTML 源码进入代码 surface，HTML 预览进入 sandboxed content surface。入口来源不改变这条分发规则。
- 持久化恢复时，Tab 必须使用已保存的有效 viewer 重建；不能因为刷新、重新进入会话或文件内容加载完成而把源码 Tab 恢复成预览，或反向改写。

### 为什么不在同一 Tab 内切换

同 Tab 切换会把“用户打开了两个资源视图”错误建模成一个易变布尔值，直接带来四类问题：前进/后退历史丢失、无法同时对照、刷新恢复歧义、异步加载完成后可能覆盖用户当前选择。并行 Tab 把 viewer 纳入稳定身份，新增的只是一个受既有 Tab manager 管理的视图实例，不新增预览链路，也不复制文件内容请求能力。

## 推荐方案

### 本地资源语法

模型输出只使用普通 Markdown，不输出内部 API URL：

```md
[项目文档](docs/report.docx)
[工作区文档](report.docx)
[外部本地文档](/Users/example/Documents/report.docx)
![项目图片](assets/chart.png)
![外部本地图片](/Users/example/Pictures/chart.svg)
```

解析规则：

- `http:`, `https:`, `mailto:`, `tel:` 继续按外部链接处理。
- 所有不带 URI scheme 且不是 `//` 协议相对地址的 href，统一按本地相对资源处理，包括 `/absolute/path`、`./relative`、`../relative`、`folder/file`、裸文件名和 `example.com`。
- `example.com` 没有显式 `https://` 时仍保持 Markdown 链接，并按本地相对资源尝试打开；若目标不存在，点击后由侧栏错误状态说明，而不是把链接预先抹成文本。
- `javascript:` 等危险协议禁止执行，但仍渲染成带禁用语义的链接，避免破坏 Markdown 的视觉结构。
- `?viewer=source` 显式要求源码；`?viewer=rendered` 保留给 HTML 等需要显式渲染的格式。
- Markdown 图片和 Markdown 链接调用同一个 parser；图片把解析结果交给 host 的 content URL resolver，链接交给 workspace `openFilePreview`。

### AI 回复合同

`ReplyFormatContextProvider` 是模型可见回复格式的唯一 owner：

- 明确本地图片 URI 可使用项目相对路径或绝对路径。
- 明确优先使用 `![alt](path)` 在消息中展示图片。
- 明确 `show_file` 用于立即打开侧栏预览，`view_image` 只用于模型读取图片。
- 给出本地图片、Office 链接的正反例和发送前自检。

### Office 预览

- DOCX：`docx-preview` 将 ArrayBuffer 渲染为文档 DOM。带完整纸张 width/padding 的文档保持原版式；缺失页面几何信息的文档进入响应式阅读 fallback，补齐页边距、标题层级和表格分隔，多列表格在局部横向滚动区域中保持列可读。
- Excel：SheetJS 从 ArrayBuffer 读取 workbook；UI 使用 React 渲染安全的单元格网格并提供工作表切换，不注入工作簿生成的 HTML。
- PPTX：`@aiden0z/pptx-renderer` 以 HTML/SVG 渲染幻灯片；启用推荐 ZIP 限额、lazy media、lazy slides 和 windowed list，并在卸载时销毁 viewer。
- 三类预览共享加载、失败、下载/系统打开语义，但各格式 parser 和生命周期留在独立组件中。

## Owner 与数据流

```text
模型 Markdown 链接 / show_file / 项目文件树
  -> 入口适配为 ChatFileOpenActionViewModel
  -> ChatThreadManager.openFilePreview(path, viewer=auto)
  -> ChatWorkspaceFileTab
  -> ChatSessionWorkspaceFilePreview
       -> server-path read：路径事实与有限文本预览
       -> server-path content：富内容原始字节
       -> WorkspaceFileContentPreview 按扩展名/MIME 分发
          -> image | audio | video | pdf | html | docx | spreadsheet | presentation
```

- `@nextclaw/agent-chat-ui`：本地资源 Markdown 语法与点击/图片解析。
- `@nextclaw/kernel`：模型回复合同与 `show_file` 工具语义。
- `@nextclaw/server`：本地文件字节和 MIME，不承担文档渲染。
- `@nextclaw/ui` chat manager：通过 workspace 文件视图能力 owner，把 Markdown/HTML 入口 viewer 归一化为明确模式，并统一管理对应 Tab 的去重、相邻插入和历史；其他格式继续保留 auto 交给富内容分发。
- `@nextclaw/ui` workspace feature：预览器选择、Office 解析器生命周期与视觉展示。
- `ChatSessionWorkspaceFilePreview`：选择当前内容平面，并保证加载、失败和截断状态只来自正在展示的平面。
- `WorkspaceFileContentPreview`：只负责文件类型识别与富内容 renderer 分发，不感知入口来源和文本预读状态。

## 目录组织

- Markdown parser 放在现有 `chat-message-list/utils`，避免继续膨胀主 Markdown 组件。
- Office 子预览器放在 workspace preview 的子目录，避免增加 workspace components 根目录文件数。
- `workspace-file-content-preview.tsx` 只保留格式识别与分发，不继续承载三套解析实现。

## 兼容与迁移

- 服务端旧的路径段 content route 暂时保留兼容；所有新 UI 调用只生成 query content route。
- 已有 HTTP 链接、锚点、源码行号和 HTML viewer query 保持原语义。
- 无法解析、加密、损坏或超出资源限制的 Office 文件显示明确失败状态，并保留下载与系统打开。
- 本地目标不存在或失效时，链接仍可点击；点击后由统一文件打开链路显示明确错误。
- 旧 `.doc/.ppt` 不伪装成已支持；后续若引入可靠转换 owner，再扩展格式表。

## 验收标准

- `![alt](/absolute/image.svg)` 与项目相对图片可直接显示；SVG auto 显示图片，source 显示源码。
- `[report.docx](report.docx)`、`[sheet.xlsx](sheet.xlsx)`、`[slides.pptx](slides.pptx)` 都渲染为可点击链接并打开侧栏。
- 真实 DOCX、XLSX、PPTX 文件通过前端开发代理读取并在对应预览器中出现可见内容。
- 缺失纸张尺寸的真实 DOCX 在约 447px 侧栏中具有正常页边距和标题层级；五列以上表格不逐字断行，而是在表格区域横向滚动。
- 外部 `http/https` URL 正常打开；任何无 scheme href 都保持链接并进入本地资源打开链路。
- 四个触达包通过 TSC，触达文件通过 ESLint，定向测试、真实浏览器冒烟、治理和维护性检查通过。
- 从 Markdown 本地文件链接与项目文件树打开同一文件时，生成等价的 workspace file tab，并进入同一个预览编排组件。
- 大于 200KB 的图片、音频和视频继续使用浏览器原生完整内容预览，面包屑不展示“内容已截断”；大于 200KB 的源码/Markdown 仍明确展示截断状态。
- DOCX query content route 在同版本源码服务返回正确 MIME 和完整字节，并通过项目文件树真实打开；验收环境不得把源码 UI 代理到旧版已安装服务。
- Markdown 预览 Tab 执行“打开源码”后出现相邻源码 Tab，原预览 Tab 保持不变；HTML 源码 Tab 执行“打开预览”时同理。
- 对应视图已存在时再次执行操作只聚焦已有 Tab，不产生重复项；两个视图可独立关闭并分别参与前进/后退历史。
- 活动 Tab 的更多操作在桌面和触屏都直接可达；非活动 Tab 的 hover/focus 渐进展示不影响键盘操作，菜单关闭后焦点回到来源 Tab。
- 刷新页面或重新进入会话后，Markdown/HTML 的源码与预览 Tab 按各自 viewer 恢复，不发生模式互换或合并。
- HTML 预览在 sandbox 中加载，不能访问宿主同源状态、打开顶层页面或借预览执行可信 panel app 能力。

## 非目标

- 不实现 Office 编辑、协同、批注或格式无损导出。
- 不承诺与 Microsoft Office 像素级完全一致。
- 不为旧 `.doc/.ppt` 自研二进制解析器。
- 不新增一套独立的 `file://` 或私有 Markdown scheme；模型继续输出可读、可迁移的普通 Markdown 路径。
- 本次不扩展媒体 Range/分片传输；浏览器原生播放器与完整内容响应已经覆盖当前预览和错误状态问题，大文件流式传输作为独立性能议题评估。
- 不实现同一 Tab 内的源码/预览状态切换；两种视图始终以独立 Tab 表达。
- 不把桌面右键作为首期唯一操作入口，也不为这一个动作新增一套独立 context-menu 业务规则。

## 后续实现顺序

1. 抽出并扩展本地资源 parser，更新回复合同与测试。
2. 修正 SVG/Office auto viewer 选择和真实 DOCX 路径。
3. 实现 Excel 与 PPTX 预览器并补充 MIME。
4. 用真实三件套文件做组件和浏览器验收。
5. 用 Markdown 链接和项目文件树分别打开同一文件，覆盖文本截断、富内容非截断以及同版本运行合同。
6. 收敛 Markdown/HTML 的有效 viewer 与 Tab 身份，补齐对应视图的相邻打开、去重、持久化恢复和模式标记。
7. 扩展共享 Tab action 展示合同，并用桌面鼠标、键盘和触屏尺寸验收更多菜单；HTML rendered viewer 同步补齐 sandbox。
