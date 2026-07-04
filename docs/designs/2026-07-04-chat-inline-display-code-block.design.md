# Chat 内联展示代码块协议设计

## 背景

`show_content` 当前承担两类事情：一类是打开右侧资源或文件预览，另一类是把 Panel App 这类内容以内联形式展示在聊天流里。前者是动作，后者更接近消息内容本身。

当 AI 只是想在最终回复里声明“这里应内联展示一个内容对象”时，用工具调用会带来两个体验问题：

- 工具卡片会被完成后过程折叠收起，真正的内联展示也可能跟着消失。
- 纯展示内容被包装成工具动作，会让用户误以为这里发生了点击、打开或执行。

因此需要一条 Markdown 原生、声明式、惰性的内联展示协议。它服务 NextClaw 的统一入口体验：AI 回复可以直接携带可理解的展示对象，而不是把所有视觉表达都绕成工具调用。

## 现状依据

- `ChatMessageMarkdown` 是消息 Markdown 渲染 owner，已经集中处理链接安全、文件链接打开、代码块高亮和 inline token AST 变换。
- `show_content` 工具链路在 kernel 侧生产 `ui.show-content` 事件，`ChatThreadManager` 决定文件预览、右侧面板或忽略旧事件里的 inline 标记。
- `ChatInlinePanelAppCard` 已经能在聊天流里渲染 bounded card-mode Panel App，但当前入口来自 tool-card 的 `renderPanelAppCard`。
- `Chat Resource URI` 方案解决的是 Markdown 链接点击打开资源；本方案解决的是 fenced code block 直接渲染为内联展示，两者不能互相替代。

## 核心判断

特殊代码块只代表“内联展示声明”，不代表动作。

具体边界：

- Markdown link：可以点击，点击后打开文件、资源 URI 或外部链接。
- `nextclaw-inline` fenced code block：永远在当前位置内联渲染，不注册点击打开、不发 tool action、不调用 `onFileOpen`。
- `show_content`：继续作为工具驱动的展示/打开通道，保留授权、执行结果和可审计工具链路。
- `show_panel_app`：模型可见工具入口只用于 side panel 即时预览；inline Panel App 展示不再通过该工具表达。

这条边界符合 `single-domain-owner`：Markdown 渲染层只把 Markdown 里的展示声明渲染出来；它不接管工具执行，也不接管右侧资源打开。

## 协议设计

使用 fenced code block 的 info string：

````md
```nextclaw-inline
{
  "target": {
    "type": "panel_app",
    "payload": {
      "appId": "weather-card"
    }
  },
  "title": "Weather",
  "description": "Inline weather snapshot"
}
```
````

协议 info string 为 `nextclaw-inline`。

字段规则：

- `target` 必填，使用稳定的 `type/payload` 形状。
- `target.type` 第一阶段支持 `file`、`url`、`panel_app`、`json`。
- `title` 可选，只作为展示标题。
- `description` 可选，只作为展示说明。
- 不支持 `placement`、`purpose`、`action`、`href`、`command` 这类动作字段；代码块语义本身已经固定为 inline display。

目标形状：

```ts
type ChatInlineDisplayTarget =
  | { type: "file"; payload: { path: string; line?: number; column?: number; viewer?: "auto" | "source" | "rendered" } }
  | { type: "url"; payload: { url: string } }
  | { type: "panel_app"; payload: { appId: string } }
  | { type: "json"; payload: { value: unknown } };
```

## Owner 与数据流

```text
assistant markdown
  -> fenced code block language=nextclaw-inline
  -> ChatMessageMarkdown parses inert descriptor
  -> ChatInlineDisplay default read-only surface
  -> optional product renderer handles supported inline display target
```

职责分配：

- `ChatMessageMarkdown`：识别 `nextclaw-inline` 代码块，解析 JSON descriptor，拒绝无效 descriptor 并回退普通代码块。
- `chat-inline-display.utils.ts`：承载无状态解析、校验和标签推导。
- `ChatInlineDisplay`：默认只读展示组件，不渲染按钮、不渲染链接、不触发回调。
- `ChatMessageList` / `ChatMessage`：透传可选 `renderInlineDisplay`，让产品侧为特定 target 提供真实内联展示。
- `ChatMessageListContainer`：只把 `panel_app` target 接到现有 `ChatInlinePanelAppCard`，并关闭展开按钮，保持“永远内联”。
- `ChatInlinePanelAppCard`：继续作为 Panel App 内联展示 owner；新增只读展示模式，不把代码块声明升级为右侧打开动作。

## AI 上游提示词合同

协议落地后，AI 必须知道何时输出它。否则 UI 支持了代码块，模型仍可能把纯展示内容包装成 `show_panel_app` 工具调用。

推荐 owner：

- `ReplyFormatContextProvider`：用户可见最终回复格式 owner，说明 `nextclaw-inline` fenced JSON block 是 inert inline display declaration。
- `Inline Interactive Surfaces` native static context：说明普通 inline Panel App 展示必须使用 `nextclaw-inline`，`show_panel_app` 不得用于 inline 展示。
- `show_panel_app` 工具描述与参数 schema：只保留 side panel 即时预览边界，不暴露 placement 选择，避免工具 schema 诱导模型把纯展示当成工具动作。
- 内置 Panel App creator skills：验收展示默认走 side panel、file、url 或最终回复 `nextclaw-inline`；inline 展示不得调用 `show_panel_app`。

这四处并存是必要的：

- `ReplyFormatContextProvider` 解决普通回复怎么写。
- `Inline Interactive Surfaces` 解决 agent 选择卡片形态时，何时写最终回复展示声明，何时才需要立即调用工具。
- `show_panel_app` schema 解决工具被选择时的语义边界，并确保工具调用不再携带 placement 参数。
- creator skills 解决创建应用后的验收展示流程。

提示词不应把完整协议手册塞进 context；只保留“什么时候用、格式是什么、不能代表动作”三件事。完整字段说明仍以本设计文档和类型合同为准。

## 交互约束

- 默认展示没有按钮、没有 link role、没有 click handler。
- 无效 JSON、未知 target、缺少必要字段时，按普通代码块展示，避免消息内容丢失。
- Panel App 由产品侧显式 renderer 接入；共享 `agent-chat-ui` 默认不自己加载业务数据或调用 API。
- Panel App 从代码块进入时不显示 expand action；如果用户需要右侧打开，应使用 Markdown link 或 `show_content` 工具。

## 目录组织

- 设计文档：`docs/designs/2026-07-04-chat-inline-display-code-block.design.md`。
- 类型合同：`packages/nextclaw-agent-chat-ui/src/components/chat/view-models/chat-ui.types.ts`。
- 解析工具：`packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/utils/chat-inline-display.utils.ts`。
- 默认展示：`packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-inline-display.tsx`。
- Markdown 接入：`packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-markdown.tsx`。
- 产品侧 Panel App renderer：`packages/nextclaw-ui/src/features/chat/features/message/components/chat-message-list.container.tsx` 与 `chat-inline-panel-app-card.tsx`。

## 兼容与迁移

这是纯增量 Markdown 渲染能力，不改变历史消息、NCP 协议或工具调用结果。

旧消息没有 `nextclaw-inline` 代码块时渲染不变。未知或不合法的 `nextclaw-inline` 内容仍显示为普通代码块，保证可审计和可复制。

## 验收标准

- `nextclaw-inline` 代码块能渲染为只读 inline display surface。
- 默认渲染不产生 link、button、tool action 或 file open 回调。
- invalid descriptor 回退普通代码块。
- `panel_app` descriptor 在 NextClaw 产品侧以内联 Panel App 渲染，且不显示 expand action。
- 普通 fenced code block、inline code、inline token 渲染行为不变。
- `@nextclaw/agent-chat-ui` 与 `@nextclaw/ui` 相关 tsc、定向测试、lint/governance 通过或披露既有阻塞。

## 非目标

- 不用代码块替代可点击链接。
- 不用代码块替代操作型 `show_content`。
- 不在 Markdown 层读取文件、打开右侧栏或执行命令。
- 不新增全局 renderer registry、permission manager 或 runtime 事件。
- 不在第一阶段做 Panel App metadata unfurl、文件内容读取或资源预取。
