# 统一文件类型视觉设计

## 背景

会话工作台已经能在项目文件树、文件预览面包屑和文件 Tab 中展示真实文件，但这些位置都使用同一种通用文件图标。用户看到文件名后仍要自行读取后缀，无法像常见编辑器那样快速区分代码、配置、文档、图片和数据文件。

这不是目录树的局部样式问题，而是同一文件事实在多个导航表面的视觉语义不一致。目标是在不引入新状态和新业务链路的前提下，让所有文件导航入口复用同一个文件类型展示 owner。

## 现状依据

- 项目文件树在 `chat-session-workspace-directory-browser.tsx` 中把所有文件渲染成同一个 `FileCode2`。
- 面包屑目录弹层在 `chat-session-workspace-file-breadcrumb-browser.tsx` 中把所有文件渲染成同一个 `File`。
- 当前文件面包屑在 `chat-session-workspace-file-breadcrumbs.tsx` 中把文件渲染成同一个 `FileCode2`。
- 文件 Tab 在 `chat-session-workspace-panel-nav.tsx` 中把文件渲染成同一个 `FileCode2`。
- 四个表面都已经持有文件名或文件路径，不需要扩展 server-path API，也不需要读取文件内容或 MIME。
- 消息附件已有按 MIME 和附件类别派生预览方式的独立合同；它解决的是附件打开与媒体预览，不是工作台文件导航。

## 核心判断

正确 owner 是 `nextclaw-ui` 共享展示层中的纯 `FileTypeIcon`：输入文件名，输出稳定的 VSCode Icons SVG。各业务组件只负责文件/目录分支和交互，不再自行判断文件后缀。

这落实以下原则：

- `single-domain-owner`：文件类型视觉映射只保留一份。
- `information-expert`：拥有文件名的展示组件直接把事实交给文件类型指示器，不把映射结果层层透传。
- `high-cohesion-low-coupling`：后缀解析、特殊文件名和颜色映射与渲染放在同一展示 owner 内，调用方只知道 `fileName`。
- `simple-structure-first`：这是无状态纯展示，不新增 manager、store、service 或 resolver。

## 推荐方案

新增一个共享 `FileTypeIcon` 组件：

- 识别常见代码、标记、配置、数据、文档、表格、图片、音视频、归档和字体后缀。
- 对 `Dockerfile`、`Makefile`、`README`、`.env`、`.gitignore`、各类 lockfile 和工具配置提供独立图标。
- 图标数据来自 VSCode Icons 的独立模块，并以离线数据传给 Iconify React；不依赖运行时网络，也不打包整套图标集合。
- 未识别文件回退为 VSCode Icons 的通用文件 SVG。
- 提供紧凑和标准两种尺寸，但文件名映射保持一致。
- 标识本身设置为装饰性内容，文件名继续作为按钮、树项和 Tab 的可访问名称，避免屏幕阅读器重复朗读。

四个现有表面统一替换为该组件。文件 Tab 的 view model 增加明确的 `fileName` 展示事实，避免图标组件从 tooltip 或自定义 label 猜测真实文件名。

## Owner 与数据流

```text
ServerPathEntryView.name / breadcrumb segment.label / workspace file.path
  -> FileTypeIcon(fileName)
  -> 文件类型解析与视觉映射
  -> 目录树 / 面包屑弹层 / 当前文件面包屑 / 文件 Tab
```

Owner 边界：

- `shared/components/file-type-icon.tsx`：拥有文件名归一化、后缀/特殊文件识别、SVG 选择与尺寸。
- workspace 目录树和面包屑：继续拥有目录展开、浏览与文件打开交互，只把文件名传入共享组件。
- workspace tab view model：继续拥有 Tab 展示数据，显式提供文件名，不参与类型判断。

## 目录组织

当前 `nextclaw-ui` 是包内部 `L3` 前端结构；本次使用现有 `shared/components` 白名单，不新增 feature root 或目录角色。

- `FileTypeIcon` 被 workspace 内多个独立组件消费，合同不依赖 chat 业务动作，允许进入 `shared/components`。
- 组件文件直接作为唯一导入地址，不新增 `index.ts` barrel。
- 测试进入现有 `shared/components/__tests__`，不新增测试专用目录层。

消息附件的 MIME 分类留在 `nextclaw-agent-chat-ui` 本地，因为它还拥有媒体可预览性、文件大小和附件类别等不同事实。把它并入本组件会扩大依赖并混淆 owner，本轮不做跨包迁移。

## 交互与视觉取舍

- 采用成熟的 VSCode Icons 图形语言，而不是自行设计后缀文字牌；图标形状与颜色共同提供熟悉的扫视辨识度。
- 只导入实际映射到的独立 SVG 数据，换取更成熟的视觉质量，同时控制包体积和维护面。
- 不给单个文件类型增加 tooltip；外层文件名和路径 tooltip 已提供完整语义，重复 tooltip 会增加噪音。
- 隐藏文件仍沿用外层行的透明度策略，类型指示器不单独改变交互状态。

## 验收标准

- TS/TSX、JS/JSX、JSON、Markdown、CSS/HTML、YAML、图片、PDF、表格、归档等常见文件具有可区分的真实 SVG 图标。
- 特殊文件名、大小写后缀、未知后缀和无后缀文件都有确定回退。
- 项目文件树、面包屑弹层、当前文件面包屑和文件 Tab 全部使用同一共享组件。
- workspace 组件中不再保留文件类型专用的 `File` / `FileCode2` 重复分支。
- 组件测试覆盖常见类型、特殊文件名、SVG 输出和回退；workspace 定向测试、`tsc`、ESLint 与真实页面冒烟通过。

## 非目标

- 不改变目录图标、文件排序、目录懒加载或文件打开链路。
- 不根据文件内容做类型嗅探。
- 不新增可配置主题、用户自定义图标包，也不把完整 VSCode Icons 集合打入前端。
- 不重构消息附件预览合同或工具调用中的文件结果卡片。

## 实现顺序

1. 新增共享文件类型指示器及定向测试。
2. 替换目录树和面包屑中的重复文件图标。
3. 给文件 Tab view model 补齐文件名事实并替换 Tab 图标。
4. 运行类型、定向测试、lint、治理和浏览器验收。
