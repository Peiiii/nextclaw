# Markdown 文档目录与章节跳转设计

## 用户任务

用户在会话工作台打开较长的 Markdown 文件后，可以从面包屑行右侧打开目录，理解文档结构并直接跳转到目标章节，不需要手工滚动查找。

## 当前链路与约束

- `useServerPathRead` 提供 Markdown 原文，`ChatSessionWorkspaceFilePreview` 决定使用源码或渲染预览。
- 渲染预览由 `ChatMessageMarkdown` 生成真实标题 DOM，正文滚动由其外层专用 `overflow-auto` 容器拥有。
- 面包屑行由 `ChatSessionWorkspaceFileBreadcrumbs` 拥有；现有 Popover primitive 已包含视口碰撞和最大高度约束。
- 目录只属于渲染后的 Markdown 文件；源码、diff、目录、二进制文件和没有标题的 Markdown 不展示入口。

## 方案比较

### 方案 A：重新解析 Markdown 原文并生成锚点

优点是可以在渲染前得到目录。缺点是需要让目录解析器与 `react-markdown`、GFM、文本裁剪和未来 renderer 扩展长期保持一致；重复标题、内联格式和代码围栏也容易产生错配。浏览器 hash 跳转还不能可靠表达工作台内部滚动容器与顶部余量。

### 方案 B：以已渲染标题 DOM 为事实源（采用）

渲染完成后读取正文中的 `h1`–`h6`，按标题级别生成目录，并为实际节点绑定内部定位标识。目录点击直接让正文滚动容器滚动到该节点。

这条路径只有一个标题事实源，不新增 Markdown parser 或 URL/hash 合同；标题显示与页面内容天然一致，也能直接验证真实滚动目标。代价是目录要在正文完成一次渲染后才出现，但本地 Markdown 渲染是同步过程，不需要新增 loading 状态。

## 冻结的交互合同

- 面包屑行提供通用 trailing action 区；首个消费者是 Markdown 目录。
- 目录入口是有可访问名称和 tooltip 的 icon button，用户点击后打开 Popover，不使用 hover 自动打开。
- Tooltip 的焦点来源判断统一归共享 `TooltipTrigger`：键盘 `focus-visible` 可以显示提示，鼠标操作后由 Popover 归还的程序化焦点不显示可见提示；目录组件不维护局部抑制状态。
- Popover 右对齐、限制宽度和最大高度；正常目录完整展示，极长目录仅在浮层内部滚动。
- 目录组件在内存中记录当前文档浮层的滚动位置；关闭后再次打开恢复到上次位置。Markdown 内容切换时重置，不持久化到磁盘或全局 store。
- 目录按标题级别缩进，所有行都是 `<button>`，提供 hover、focus-visible 和 active 反馈；长标题单行截断并保留完整 `title`。
- 点击目录项后先关闭浮层，再让正文容器即时跳转，使标题停在距容器顶部约 16px 的位置；不播放会拖慢长距离定位的平滑滚动动画。
- 目录从实际渲染节点生成并按序号定位，不依赖标题文本唯一性；重复标题仍能分别命中。
- Markdown 内容、文件视图或渲染模式变化后重新采集目录；无标题时不显示空入口。

## Owner 与边界

- `ChatSessionWorkspaceFilePreview` 继续拥有文件类型、预览模式和正文滚动容器。
- `WorkspaceMarkdownOutline` 只拥有标题 DOM 采集、目录浮层状态和章节滚动，不进入共享 Markdown renderer，也不改变公共 package contract。
- 共享 `TooltipTrigger` 拥有 Tooltip 的通用焦点语义，所有普通图标操作和 Tooltip + Popover 组合复用同一合同。
- `ChatSessionWorkspaceFileBreadcrumbs` 只新增 trailing action 插槽，不感知 Markdown 语义。
- 不新增持久化、URL hash、当前章节追踪、搜索、折叠目录或源码模式目录。

## 最小验证标准

1. rendered Markdown 有标题时显示目录入口，无标题及 source 模式不显示。
2. ATX/Setext、带内联格式和重复文本的真实标题都按 DOM 顺序进入目录。
3. 点击条目关闭 Popover，并由正确正文滚动容器滚动到对应标题且保留顶部余量。
4. 层级缩进、长目录限高滚动、关闭再打开后的滚动位置恢复、按钮语义、tooltip、键盘焦点和窄面包屑布局可用。
5. `@nextclaw/ui` 定向测试、TypeScript 检查和真实页面视觉/交互检查通过。
