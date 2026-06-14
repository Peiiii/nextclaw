# Panel Card：对话原生轻量交互设计

## 背景

`show_content(type="panel_app", placement="inline")` 已经能把 Panel App 嵌入聊天消息，但仅有展示位置还不够。用户真正需要的是一类轻量结果能自然成为对话内容的一部分，例如天气、汇率、计算器、计时器、picker、checklist、小表单和小 dashboard。它们不应该每次都打开右侧工作区，也不应该把完整页面硬塞进小 iframe。

## 核心判断

Panel Card 不是新的应用类型，也不是所有 Panel App 的默认展示形态。它仍然是 Panel App，只是在 AI 已经判断交付物属于 `chat-native micro experience` 时，用 inline 卡片承载当前对话里的短闭环。

产品原则是：

- 轻量结果卡片化，持续工作面板化。
- 卡片是即时摘要与短操作，不是缩小版页面。
- 完整阅读、编辑、管理、大表格、多页流程和持续工作区仍属于 side panel。

## 交互合同

Panel Card 必须满足：

- 核心价值在 `220px-420px` 内可见。
- 设计上不依赖 document 级内部滚动；允许 dropdown、select、短列表等控件级局部滚动。
- 横向优先：默认让信息沿宽度展开，宽度大于高度，用左右分区承载主指标、状态、短操作和辅助信息。
- 窄容器自适应：容器太窄时可以折成单列；不横向滚动，不使用固定桌面宽度。
- 最多一个主操作，少量辅助操作；复杂配置、详情、历史交给展开后的 side panel。
- loading、empty、error 都是卡片状态，不能只依赖 console。
- 宿主始终提供展开入口，避免用户被困在小 iframe 中。

## 运行时合同

inline card 宿主负责三件事：

1. 用受限高度卡片壳承载 iframe，避免把聊天流变成无限展开的页面。
2. 给 iframe URL 注入 `nextclawPlacement=inline` 与 `nextclawDisplayMode=card`，让新生成的 Panel App 能显式进入 card mode。
3. 始终提供展开入口，展开后使用原始 Panel App URL 进入 DocBrowser / side panel，而不是继续使用 card-mode URL。

当前 iframe sandbox 不包含 `allow-same-origin`，宿主不能可靠读取 iframe 内部 DOM 高度；因此第一阶段不做跨 iframe DOM 侦测，也不引入 Panel Card resize 协议。兜底策略是：宿主限制 card viewport、允许 iframe 在内容过高时出现自身滚动、提供展开入口；生成规范仍要求 Panel App 在 card mode 下把核心价值压缩进首屏，不把滚动当成默认体验。

## 生成规范

AI 决定做 Panel Card 时，应该优先生成 card-first layout：

- 读取 URL 参数判断 `nextclawDisplayMode=card`。
- card mode 下优先做横向卡片：左侧放主结果/核心状态，右侧放短列表、次要指标或一个主操作；空间不足再折成纵向。
- 长列表展示前几项与数量摘要，完整列表交给展开。
- 不把编辑器、管理台、文件浏览器、大表格或多页流程做成卡片。

## 验收

- 聊天消息中的 inline Panel App 有固定卡片壳、展开入口和不依赖 document 级滚动的生成规范。
- iframe 使用 card-mode URL，展开侧栏使用原始 Panel App URL。
- 核心 prompt 与 Panel App skill 都明确区分卡片和完整面板。
- 定向组件测试覆盖 card-mode URL 与展开动作。
