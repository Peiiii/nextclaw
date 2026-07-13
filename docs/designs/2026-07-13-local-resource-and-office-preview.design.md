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
7. `viewer=auto` 必须保留到文件类型分发 owner；只有 HTML 在 auto/未指定时默认展示源码，SVG 与 Office 文件不能被 manager 提前改写成 `source`。

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
模型 Markdown / show_file
  -> ChatMessageMarkdown 本地资源 parser
  -> openFilePreview(path, viewer=auto)
  -> server-path read 获取 resolvedPath/kind
  -> server-path content 返回原始字节和 MIME
  -> WorkspaceFileContentPreview 按扩展名/MIME 分发
  -> image | docx | spreadsheet | presentation | pdf | media
```

- `@nextclaw/agent-chat-ui`：本地资源 Markdown 语法与点击/图片解析。
- `@nextclaw/kernel`：模型回复合同与 `show_file` 工具语义。
- `@nextclaw/server`：本地文件字节和 MIME，不承担文档渲染。
- `@nextclaw/ui` chat manager：只归一化 HTML 的 auto/source 语义，保留其他格式的 auto viewer。
- `@nextclaw/ui` workspace feature：预览器选择、Office 解析器生命周期与视觉展示。

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

## 非目标

- 不实现 Office 编辑、协同、批注或格式无损导出。
- 不承诺与 Microsoft Office 像素级完全一致。
- 不为旧 `.doc/.ppt` 自研二进制解析器。
- 不新增一套独立的 `file://` 或私有 Markdown scheme；模型继续输出可读、可迁移的普通 Markdown 路径。

## 后续实现顺序

1. 抽出并扩展本地资源 parser，更新回复合同与测试。
2. 修正 SVG/Office auto viewer 选择和真实 DOCX 路径。
3. 实现 Excel 与 PPTX 预览器并补充 MIME。
4. 用真实三件套文件做组件和浏览器验收。
