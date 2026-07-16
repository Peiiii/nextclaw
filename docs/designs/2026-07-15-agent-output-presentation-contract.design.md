# Agent 输出展示合同设计

## 背景

当前聊天 UI 在一次 Agent 消息完成后，会把最后一个工具调用及其之前的 reasoning / tool activity 折叠到“已处理”，只把最后一个工具调用之后的内容直接留在消息表面。这条展示事实已经由前端实现，但 Agent 的上下文并不知道，因此可能把结论写在工具调用前、把工具结果当成用户可见正文，最终留下空洞或重复的可见回复。

与此同时，输出提示分散在 `InlineInteractiveSurfaceContextProvider` 与 `ReplyFormatContextProvider`：Markdown 文件链接、图片、`nextclaw-inline`、`show_file` / `show_url` / `show_panel_app` 的边界存在重复。前端 Markdown 已支持 GFM、代码高亮、本地资源与 inline display，但还不能把 `mermaid` fenced block 渲染为图；消息复制动作也只显示在 Agent 消息上。

## 核心判断

- `single-fact-owner`：所有“Agent 最终如何把结果交给用户”的提示统一归 `ReplyFormatContextProvider`，工具 schema 只描述参数，前端只解释输出协议。
- `visible-main-flow`：最后一个工具调用之后必须有一段自包含的最终回复；工具前 narration 只承担简短进度，不承担最终结论。
- `protected-variations`：Markdown 链接、图片、Mermaid、inline display 和 side panel 是不同展示形态，但共享同一输出选择合同。
- `simple-structure-first`：Mermaid 只是共享 Markdown renderer 的一个 fenced-code 变体，不新增业务 manager、registry 或第二套 Markdown 解析链。
- `progressive-valid-frame`：流式 Markdown 更新期间只提交通过 Mermaid 校验的图形帧；连续 token 不能无限推迟首帧，昂贵渲染必须串行且只追赶最新源码。
- `stable-last-frame`：首次渲染使用稳定图形占位，已经存在有效图时继续保留上一帧，源码只作为最终无效语法的明确失败回退。
- `interaction-owner`：复制是消息级通用动作，用户与 Agent 消息都复用 `ChatMessageActionCopy`。

## 推荐方案

### 统一 Agent 输出 Context Provider

删除独立的 `createInlineInteractiveSurfaceContextProvider`，把以下内容统一写进 `ReplyFormatContextProvider`：

1. UI 折叠事实：最后一个工具调用及其之前的过程会进入“已处理”，之后的内容直接可见。
2. 最终回复组织：工具调用完成后输出自包含结论，不依赖已折叠 narration 或原始工具输出。
3. Markdown 选择：标题、列表、表格、代码块只在提升可读性时使用；文件与图片遵守现有资源链接合同。
4. Mermaid：关系、流程、时序或状态变化用 fenced `mermaid`；简单结论仍用短文本或列表。
5. 展示边界：`nextclaw-inline` 是消息内声明；`show_file` / `show_url` / `show_panel_app` 是立即打开 side panel 的工具动作。
6. Panel Card 的紧凑布局合同继续保留，但不再由第二个 provider 重复注入。

`ContextProviderManager` 仍只负责有序聚合，不理解输出策略。

这里以 Agent 当前实际可调用的三个窄工具作为提示合同，不重新暴露历史 `show_content` 宽工具。三个窄工具在 kernel 内部仍归一化为既有 `showContent` request / event，并继续由原有 UI owner 承接；本轮只统一“Agent 何时选择哪种展示方式”的上下文，不建立第二条内容展示链路。

## Markdown 与 Mermaid 数据流

```mermaid
flowchart LR
  A["Agent 最终回复"] --> B["NCP markdown message part"]
  B --> C["ChatMessageMarkdown"]
  C --> D{"fenced language"}
  D -->|"mermaid"| E["ChatMermaidDiagram"]
  D -->|"nextclaw-inline"| F["ChatInlineDisplay"]
  D -->|"其它代码"| G["ChatCodeBlock"]
  C --> H["Markdown link / image renderer"]
```

`ChatMermaidDiagram` 是模块级稳定 React 组件。它动态加载 Mermaid，使用 `securityLevel: "strict"`、`startOnLoad: false` 与 `suppressErrorRendering: true` 渲染 SVG；图语法无效时回退到原始 Mermaid 代码块，不吞掉用户内容。主题只读取宿主根节点的公开 appearance 状态，不读取业务 store。

Mermaid 渲染属于外部库/DOM 同步，因此允许组件内使用 effect；它不承担业务状态、消息状态或工具行为。组件 identity、消息 key 与父级结构保持不变，流式文本更新只改变 `source` props。

`ChatMessage` 只把“当前消息仍在进行且 Mermaid 所在 Markdown 是最后一个 part”传为 `isStreaming`。首次进入历史会话或首次收到 Mermaid fenced block 时，组件直接建立稳定的 `figure` 图形表面，以紧凑的“正在渲染图表”状态明确反馈等待，不用假节点骨架伪装成半成品图，也不把源码当作加载态。历史消息立即请求最终渲染；流式消息使用 200ms latest-only throttle：节流截止时间不会被后续 token 重置，因此连续输出期间也会周期性尝试最新源码。

Mermaid 调度器同一时间只允许一个 parse/render 在途；渲染期间到达的新 token 只覆盖 pending request，当前任务结束后直接追赶最新源码，不为每个 token 排队。流式语法暂时无效时继续保留占位或上一张有效 SVG，只有新快照通过校验后才原子替换；消息完成时绕过节流立即收敛最终帧，最终语法仍无效才显示错误说明和可复制源码。

正常 Mermaid SVG 是 Markdown 正文内容，使用透明、无边框画布直接参与文档排版，不包装成卡片；边框只属于最终语法无效时的错误提示，用来区分异常状态。这样避免连续图表产生多余容器层级，也不让图表与可操作附件、面板卡片混淆。

这条合同解决的是流式外部 renderer 的生命周期：输入可以频繁变化，但用户只看到稳定图形状态，不看到内部 Markdown/Mermaid 生成过程。组件类型、消息 key、父级位置与 `figure` DOM 在 pending -> rendered 之间保持稳定；effect 只负责同步 Mermaid、timer 与宿主主题这些外部系统，不接管消息业务状态。

## 消息复制交互

消息 footer 对任何包含 Markdown/unknown 文本的已完成消息渲染同一个 `ChatMessageActionCopy`。图标按钮继续提供 `aria-label`，并使用共享 Tooltip primitive 提供可见解释；复制成功沿用既有反馈文案和图标。

复制内容仍只包含用户可读文本 part，不把 reasoning、工具参数或工具结果混入用户消息复制结果。

## 目录与改动边界

- `packages/nextclaw-kernel/.../reply-format-context.provider.ts`：唯一输出提示 owner。
- `packages/nextclaw-kernel/.../native-static-context.provider.ts`：删除重复 inline surface provider。
- `packages/nextclaw-agent-chat-ui/.../mermaid/chat-mermaid-diagram.tsx`：纯展示组件与独立测试边界。
- `packages/nextclaw-agent-chat-ui/.../chat-message-markdown.tsx`：只做 fenced language 分发。
- `packages/nextclaw-agent-chat-ui/.../chat-message-list.tsx`：让用户消息复用已有复制动作。
- `packages/nextclaw-ui` i18n：提供 Mermaid 可访问名称与失败文案。

不改 `show_*` 工具 schema，不新增消息协议字段，不改变 `nextclaw-inline` target，不改“已处理”的前端切分算法。

## 验收标准

1. Context provider 合同测试证明只剩一个输出提示 provider，并包含最后工具调用后的可见区规则、Markdown、Mermaid、inline 与 side panel 边界。
2. `mermaid` fenced block 渲染为 SVG，使用严格安全配置；无效语法回退到可复制源码。
3. 主题 appearance 改变后图表重新渲染；单张图同一时间最多一个 Mermaid render 在途，慢渲染结束后只追赶最新源码。
4. 历史消息首次渲染和流式首帧都不显示源码；连续 token 不能无限重置渲染窗口，流未结束前可以提交有效快照。
5. pending -> rendered 复用同一个 `figure`；上一张有效 SVG 在新图完成前保持可见，瞬时语法错误不闪出错误态，最终内容立即收敛。
6. 用户消息出现复制按钮，点击后 clipboard 收到用户消息正文；Agent 消息行为保持不变。
7. 受影响 package 的定向 Vitest、`tsc`、ESLint 与 UI production build 通过。
8. React renderer 组件类型保持模块级稳定，不因 callback、流式更新或主题切换替换消息 subtree。

## 非目标

- 不把 Mermaid 变成可编辑画布，不支持图内脚本、点击回调或外部链接动作。
- 不改变 reasoning / tool activity 的折叠视觉与分组算法。
- 不让 Agent 为简单回答强制作图，也不把所有输出改造成卡片。
- 不在本轮统一 Panel App inline / side-panel iframe host；那是独立 runtime 结构问题。

## 落地与验证状态

截至 2026-07-16，方案已按上述边界实现：输出提示收敛到单一 `ReplyFormatContextProvider`；Markdown renderer 支持严格模式 Mermaid、无源码闪现的稳定首屏、连续流式有效帧、主题变化和失败源码回退；用户消息复用既有消息复制动作。实现没有修改 `showContent` 内部事件、消息协议或“已处理”切分算法。

定向组件测试共 60 项通过，覆盖流式更新合并、稳定上一帧、瞬时错误抑制与最终立即收敛；上下文合同测试 2 项通过。`@nextclaw/agent-chat-ui`、`@nextclaw/kernel`、`@nextclaw/ui` 的 TypeScript 检查通过，三个包的 ESLint 为 0 error，UI production build 通过。另用真实 Chromium 执行 Mermaid `parse` / `render` 冒烟，确认严格模式下生成 1 个 SVG 与 2 个节点。可维护性 guard 为 0 error；预算 warning 均为未增长的既有目录或接近预算文件。

2026-07-16 的首屏与渐进渲染补充新增 Mermaid 定向测试后共 9 项通过，相关 Markdown / message streaming 测试 4 个文件 61 项通过；`@nextclaw/agent-chat-ui` 与消费端 `@nextclaw/ui` 的 TypeScript 检查和 production build 通过，agent chat UI 整包 ESLint 通过。隔离真实浏览器记录到历史图首次 SVG 约 240ms、流式图首次有效 SVG 约 244ms，而流式源码约 540ms 才结束；两个场景全过程都未出现源码块。后续视觉验收确认等待态为紧凑本地化进度提示，成功 SVG 外层无边框和底色。maintainability guard 为 0 error、4 warning；生产组件 255 行，保持在 UI 组件预算内。
