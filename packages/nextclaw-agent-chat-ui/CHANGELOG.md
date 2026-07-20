# @nextclaw/agent-chat-ui

## 0.6.12

### Patch Changes

- c8974bd: 移动端聊天输入面板会在空间足够时保持工具栏控件单行排列，减少不必要的面板高度。
- 0b88f68: AI 回复拿不到 token 用量时，消息页脚不再显示不可用占位；完整状态仍可在运行元数据中查看。运行元数据弹窗统一复用 shadcn 风格的聊天 Dialog，并修正打开与关闭时的跳位动画。

## 0.6.11

### Patch Changes

- be2a018: Keep chat model search and other shared chat fields visually unchanged when focused.
- 165f1cb: 修复包含内联 HTML 的混合回复在完成后只剩 HTML 预览的问题；正文、图片、Panel App、Mermaid 与表格现在都会按原始消息继续显示。
- ddc3213: 为每条 AI 回复记录实际运行模型与 token 用量，在消息底部使用统一的 `k`、`m`、`b` 单位展示输入和输出统计，并可通过更多操作查看缓存、总量、调用次数和完整运行元数据。
- 79dd1ed: Show each chat session's Agent runtime identity in assistant message avatars, align sidebar runtime icons with session titles, and refine runtime selector icon and tooltip behavior.

## 0.6.10

### Patch Changes

- Auto-generated full public release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/browser-connector
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui

## 0.6.9

### Patch Changes

- Auto-generated full public release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/browser-connector
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime

## 0.6.8

### Patch Changes

- cffeb5e: 修复在聊天引用菜单中返回后再次进入“文件与文件夹”时，默认高亮错误恢复到之前某一行的问题；现在每次进入该视图都会从第一行开始。
- e2c303a: 修复聊天引用菜单中文件与文件夹面板在切换目录或搜索结果时的高度跳动，并用更明确的操作文案提示引用当前文件夹。
- a9b125f: 增强可视化结果生成指引：Agent 会在结果适合展示时主动选择 Markdown、图表、图片或内联 HTML；内联页面保持单一焦点、自然高度和无嵌套外卡，完成后只保留可视结果，不再重复显示前后的文字复述。

## 0.6.7

### Patch Changes

- e2c303a: 聊天中的文件与文件夹引用现在支持逐层进入目录和项目全范围搜索；发送后的文件、目录、技能与面板应用标签统一为紧凑链接样式，并可查看提示或点击打开对应内容。
- 576f9bc: 优化聊天中的 Mermaid 图表体验：打开历史会话时不再先闪现源代码，以紧凑加载状态等待首图；流式回复会在生成过程中逐步呈现有效图形，并在更新期间保持上一帧稳定；完成后的图表以无边框画布自然融入正文。

## 0.6.6

### Patch Changes

- 36b3702: 修复中文输入法取消拼音或按数字选择候选词后，字符异常恢复、光标跳到输入框开头的问题。
- 2eceb16: 聊天输入框现在支持通过 `@` 搜索并引用当前项目中的文件或目录：可从统一引用菜单进入文件浏览、查看路径层级并插入引用标签，发送时由 NextClaw 在项目边界内安全、限量地补充对应文件内容或目录结构上下文。
- 611e7aa: 修复源码链接只指定行号时的横向偏移：打开 `#L12` 会保持在代码起始位置并定位目标行；指定列号时仍会把目标列带入视口。
- 25f8bb0: 修复聊天中的会话模型恢复、重试错误提示、技能选择和折叠会话列表交互，并为 `/`、`@` 选择项补充类型图标。

## 0.6.5

### Patch Changes

- 378c8b9: 优化 Agent 最终回复的展示组织，统一 Markdown、内联展示与侧栏展示提示；聊天消息现在支持稳定的流式 Mermaid 图表，并允许复制用户消息。
- c435b16: 修复流式输出期间输入框后台同步覆盖页面选区、聚焦输入框连续删除时光标跳到斜杠前、历史 Markdown 因动态 renderer 变化重新挂载，以及内联 Panel App 被动态工具分组重新挂载的问题，并移除弹层对输入框焦点的旧兜底特判。
- c01ca0a: 修复 Markdown `file:` 链接的渲染与行列定位：文件保持真实行号，大文件会读取目标行附近的内容，并在源码预览中滚动到目标位置；同时让 `nextclaw-inline` 文件目标在消息中复用现有工作台预览能力展示 HTML、Markdown、代码、图片、媒体、PDF 与 Office 文件。
- 401854e: 聊天框斜杠选择器、底部技能选择器和 Agent 上下文现在会区分项目、NextClaw、全局与内建技能来源；项目技能从项目 `.agents/skills` 加载，项目 `AGENTS.md` 也会随会话上下文生效。

## 0.6.4

### Patch Changes

- 7f7eed8: Move chat input send errors into a full-width status row above the input toolbar, with localized details text in the app.
- 91f7bef: Keep valid Markdown resources clickable independently of target availability, render local Markdown images and SVG files correctly, add responsive Word, Excel, and PowerPoint workspace previews, preserve automatic viewers outside HTML source mode, and keep chat popovers open when the streaming composer restores focus.
- 2afdba2: 新增可持久化的卡片式与平铺式消息布局切换，并默认使用平铺式；已保存的布局选择继续保留。同步优化平铺会话和输入面板的阅读宽度，统一约束消息图片尺寸、间距、圆角、Markdown 与连续附件的三列排列和放大预览，同时增强正文与过程提示的灰阶层级并修正 Markdown 标题节奏。
- a43cffd: Make slash-command filters and model-selection menus lighter and more compact, restore selectable skill details, and preserve clear hover, keyboard, and favorite feedback.
- 7853b3b: 修复重新进入会话后流式文件工具展示不完整、手动展开的工具过程会在完成时自动收起的问题；同时为工具汇总与思考补充图标，让单个工具也保留工作流连线，并允许在结构化预览尚未形成时展开查看已接收的参数。

## 0.6.3

### Patch Changes

- 404acd9: Open chat file attachments in the workspace sidebar preview, add a fullscreen lightbox for message images, simplify image chrome, and lighten global keyboard focus rings.
- b727239: Refine chat process presentation with compact, aligned reasoning and tool rows; localized state-aware labels for built-in tools; reasoning character counts; workflow grouping across intervening reasoning; distinct file and directory activity counts; clearer terminal and file previews; edit line statistics; and clickable skill references.

## 0.6.2

### Patch Changes

- 7aeae7a: Move model and thinking controls beside the context window and send action, with a compact content-sized model trigger instead of a stretched fixed-width control.
- ad85a7a: Polish the chat surface: remove the decorative bot icon above the new-session welcome title, drop the chat sidebar right border so background color alone separates the rail from the canvas, and unify input-bar toolbar labels with the skill control's muted text weight.
- bae3516: Add the Default theme with a white workspace, soft gray navigation surfaces, monochrome navigation controls, light gray user messages, blue assistant links, theme-owned marketplace surfaces, and consistent compact user message bubbles. It is listed first and used when no saved theme preference exists.

## 0.6.1

### Patch Changes

- e6a3443: Keep local HTML file links on source preview by default, and open rendered HTML only when show_file or the link viewer query explicitly requests it.

## 0.6.0

### Minor Changes

- Publish the full public NextClaw workspace as a stable minor release.

### Patch Changes

- 9df29a4: Collapse completed assistant reasoning and tool-process content behind a processed summary while keeping the final answer visible.
- bf1917a: Add inert `nextclaw-inline` Markdown code blocks for inline display declarations, keep model-visible show-content tools side-panel only without a `placement` parameter, and render inline Panel App declarations without a side-panel expand action.
- b2032cf: Add chat input queuing while an agent run is active, with editable queued drafts that send in order after the current run completes.
- ad67894: Add a floating scroll-to-bottom action in chat conversations when the message list is away from the latest message.
- 2d9d1b7: Fix Markdown absolute file links so local file anchors keep clean DOM output and continue opening through the chat workspace file preview action.
- fee6faa: Add a Night theme with dark appearance persistence and improve dark-mode readability for Markdown, status surfaces, error notices, switches, composer file tokens, native right-side marketplace detail views, and the session metadata dialog.
- 2d9d1b7: Add a rendered file-preview viewer for `show_content` so agents can open local HTML/page prototypes in the chat workspace side panel.
- 2d8a871: Add Slash menu category filters with counts and let Slash panel app actions open panel apps in the right sidebar without inserting input tokens.
- 7a77c87: Allow terminal tool cards with no command output to expand and show a distinct empty-output state.
- eb0d40a: Highlight code syntax in workspace file previews by reusing the existing chat code highlighter and server language hints.

## 0.5.4

### Patch Changes

- 944c27b: Full public stable release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/browser-connector
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.5.4-beta.0

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/browser-connector
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.5.3

### Patch Changes

- 786bfb5: Fix chat composer stability while assistant messages are streaming, including IME input and caret preservation during stale parent rerenders.
- 37a1748: Add the natural default theme, keep a minimal black-and-white theme option, and align chat, tool, provider, DocBrowser, and side dock surfaces with shared theme tokens.

## 0.5.2

### Patch Changes

- 3e3e9bf: Add a generic chat input surface plugin flow and Panel App references from the composer. Slash skill selection now uses the shared input surface path, `@` can insert Panel App references, and sent `@panel-app:<appId>` text renders as a distinct Panel App inline token.
- 80ef499: Fix input surface session ownership so slash search, panel app references, Chinese IME input, Escape dismissal, deletion, pointer selection, default focus, and flipped input panels stay responsive after input panel pluginization.
- 89899a7: Render chat inline tokens through markdown-aware parsing so Panel App references and skill tokens inside code remain literal.
- 6586a69: Add a Side chat slash command before skill entries in the slash panel. The command opens a right-side draft child conversation, keeps backend session creation deferred until the first send, and materializes that first send into an inherited child session.

## 0.5.1

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/browser-connector
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - nextclaw

- 6bb305f: Improve the chat welcome composer with prompt suggestions, searchable and pinned model choices, and a kernel-backed preference store for saved UI preferences.
- dd91bfb: Upgrade the new chat welcome entry with a centered composer, project history picker, visible agent selector, and session type selector while reusing the existing chat input flow.
- 595cc16: Add inline placement for `show_content` panel app results so chat messages can render lightweight embedded Panel App cards while keeping the existing side-panel expansion path.
- 5117e15: Clarify that inline Panel Apps are a card-specific delivery form, add landscape-first card experience guidance for built-in app creation prompts, and render inline Panel Apps as pure bounded chat cards with a side-panel expand affordance.

## 0.5.1-beta.1

### Patch Changes

- 6bb305f: Improve the chat welcome composer with prompt suggestions, searchable and pinned model choices, and a kernel-backed preference store for saved UI preferences.
- dd91bfb: Upgrade the new chat welcome entry with a centered composer, project history picker, visible agent selector, and session type selector while reusing the existing chat input flow.

## 0.5.1-beta.0

### Patch Changes

- 595cc16: Add inline placement for `show_content` panel app results so chat messages can render lightweight embedded Panel App cards while keeping the existing side-panel expansion path.
- 5117e15: Clarify that inline Panel Apps are a card-specific delivery form, add landscape-first card experience guidance for built-in app creation prompts, and render inline Panel Apps as pure bounded chat cards with a side-panel expand affordance.

## 0.5.0

### Minor Changes

- c4ee481: Add the show_content chat display action so agents can ask the UI to open file, URL, or installed panel app content from tool results and realtime UI events.

## 0.4.12

### Patch Changes

- ac44df2: Improve chat sticky-scroll lifecycle cleanup so queued scroll frames are cancelled on unmount, reducing the chance of stale chat scroll scheduling after session or view transitions.

## 0.4.11

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/shared

## 0.4.10

### Patch Changes

- 1ed5aff: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/companion
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/shared
  - nextclaw

- 641fc22: Support project-relative local file links in chat markdown and improve the cron jobs page card interactions.

## 0.4.10-beta.0

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/companion
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/shared
  - nextclaw

## 0.4.9

### Patch Changes

- 14c5730: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/companion
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/shared
  - nextclaw

- 43da21a: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/companion
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/service
  - @nextclaw/shared

## 0.4.9-beta.1

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/companion
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/service
  - @nextclaw/shared

## 0.4.9-beta.0

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/companion
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/shared
  - nextclaw

## 0.4.8

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/shared

## 0.4.7

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.4.6

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.4.5

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.4.4

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.4.3

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.4.2

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.4.1

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.4.0

### Minor Changes

- Release the NextClaw lightweight app platform as a minor feature line.

  Panel Apps now receive developer-friendly bridge results: service action lists resolve to arrays, service action invokes resolve to business payloads, and built-in app creator skills document the canonical Panel + Service + Agent contract.

## 0.3.27

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.3.26

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.3.25

### Patch Changes

- b99164b: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- 2f4f480: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- 828495f: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- 25207de: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- 854abec: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- 26163ed: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- 5535f60: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- 509b157: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.3.25-beta.7

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.3.25-beta.6

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.3.25-beta.5

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.3.25-beta.4

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.3.25-beta.3

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.3.25-beta.2

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.3.25-beta.1

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.3.25-beta.0

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.3.24

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.3.23

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.3.22

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.3.21

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.3.20

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.3.19

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.3.18

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.3.17

### Patch Changes

- Auto-generated full public stable release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.3.16

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.3.15

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.3.14

### Patch Changes

- Stable minor release for the NextClaw npm package, with patch releases for the workspace dependency closure.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

## 0.3.13

### Patch Changes

- 0251268: Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat-ui
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/ncp
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- 2418020: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- a5da9d6: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- 1600643: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

- 223037c: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

## 0.3.13-beta.4

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

## 0.3.13-beta.3

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

## 0.3.13-beta.2

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

## 0.3.13-beta.1

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

## 0.3.13-beta.0

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat-ui
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/ncp
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

## 0.3.12

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat-ui
  - @nextclaw/ui
  - nextclaw

## 0.3.11

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat-ui
  - @nextclaw/ui

## 0.3.10

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat-ui
  - @nextclaw/ui
  - nextclaw

## 0.3.9

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat-ui
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

## 0.3.8

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat-ui
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

## 0.3.7

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat-ui
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

## 0.3.6

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat-ui
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/core
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/openclaw-compat
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

## 0.3.5

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

## 0.3.4

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat-ui
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/core
  - @nextclaw/mcp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

## 0.3.3

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat-ui
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/core
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/openclaw-compat
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

## 0.3.2

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-weixin
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/core
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/ui
  - nextclaw

## 0.3.1

### Patch Changes

- Release image preview simplification and project-first chat sidebar improvements.

## 0.3.0

### Minor Changes

- Release the unpublished multi-agent batch as one aligned npm release.

  This release includes the new multi-agent management flow across CLI, server, and UI, agent-scoped session ownership and child-session conversation unification, plus the agent identity rendering improvements for spawned child sessions and tool cards.

  It also ships the openclaw marketplace/runtime npm install alignment and republishes the dependent public package chain so workspace versions stay consistent downstream.

## 0.2.21

### Patch Changes

- Republish the packages changed after the April 3 unified release batch so the published tarballs match the current workspace, including the new NCP session request and session spawn flow.

## 0.2.20

### Patch Changes

- Publish the full April 2 to April 3 public package drift as one aligned patch batch.

  This release includes the session-scoped project context chain, project-aware skill loading, chat header project interactions, server path picker improvements, file operation card rendering refinements, and the aligned runtime or engine updates behind them.

  It also republishes the affected direct dependents so workspace dependency versions stay aligned for downstream installs.

## 0.2.19

### Patch Changes

- Publish the remaining unpublished workspace drift from March 31 and April 1 as one aligned patch batch, including the native file preview pipeline updates, structured terminal tool result rendering, and the recent tool card UX refinements.

## 0.2.18

### Patch Changes

- f65c1f5: Republish Nextclaw UI with upstream frontend dependency chain.

## 0.2.17

### Patch Changes

- Publish the remaining unpublished drift from today's commits as one unified patch batch.

  This batch includes the chat skill token rendering and recent-skill ordering updates, the enter-to-send guard while a chat run is active, and the tightened tool argument validation across the NCP/runtime bridge. It also republishes the dependent public package chain so workspace dependency versions stay aligned for downstream installs.

## 0.2.16

### Patch Changes

- 9a336f2: Publish the remaining public-package drift from today's commits as one unified patch batch, including the channel enable/disable fixes, declarative channel form layout, subagent follow-up/runtime fixes, and the landing asset updates that landed after the last tagged release.

## 0.2.15

### Patch Changes

- Release pending session labeling and session context icon improvements.

## 0.2.14

### Patch Changes

- Republish Nextclaw UI with upstream frontend dependency chain.

## 0.2.13

### Patch Changes

- f15df6a: Publish the pending NCP realtime sync batch together with the new built-in cross-channel messaging skill and Weixin self-notify route hints.

  This release keeps the product lightweight: the AI reuses the existing reply, `sessions_send`, and `message` primitives, and a fresh UI or NCP session can proactively notify the saved Weixin route without adding a separate notification abstraction.

## 0.2.12

### Patch Changes

- 1ce3d58: Improve chat stream rendering performance by preserving stable message identities for unchanged messages and batching sticky autoscroll work with requestAnimationFrame.

## 0.2.11

### Patch Changes

- Release the accumulated public workspace drift together with the Codex Responses contract fix. This batch includes the new stream-completion probe, the Codex runtime bundle entry alignment, and the already-unpublished package changes that the release guard requires to be versioned before publish.

## 0.2.10

### Patch Changes

- Fix Codex CLI environment inheritance so the runtime keeps the host `PATH` and other base process variables when spawning command execution, and publish the plugin/runtime pair together for version alignment.

## 0.2.9

### Patch Changes

- Publish the pending frontend UI batch together with the already-drifted public packages required by release guards.

## 0.2.8

### Patch Changes

- Make Claude engine and NCP runtime prompts bootstrap-aware so workspace context and requested skills are injected consistently, and refresh the shared chat UI tool/file cards to match the current tool lifecycle presentation.

## 0.2.7

### Patch Changes

- Publish the current committed runtime and UI startup fixes as one aligned patch batch. This release moves the Codex runtime plugin onto host-injected agent runtime APIs, splits UI session reads from the deferred NCP runtime so `/api/ncp/sessions` is available before the runtime agent is ready, and republishes the linked public packages above the currently published tags so the shipped dependency chain stays version-consistent.

## 0.2.6

### Patch Changes

- Publish the pending branch changes for Claude NCP event visibility and chat tool status feedback. Claude runtime now exposes richer reasoning and tool-call events to the NCP layer, and the shared chat UI surfaces clearer tool lifecycle states, call IDs, and output labels.

## 0.2.5

### Patch Changes

- Ship the full set of current unreleased workspace package changes in one release batch, including the server/CLI updates already sitting in the working tree and the previously committed public package drift that has not been published yet. Republish the NCP agent runtime export surface so NextClaw can resolve `LocalAttachmentStore` after update, and add a release guard that blocks shipping public workspace dependents when a package has drifted past its published tag without a pending changeset.

## 0.2.4

### Patch Changes

- ee69ef6: Keep pasted and uploaded NCP images in composer order end to end: preserve caret placement, retain image visibility across follow-up turns without hidden model switching, and serialize mixed text/image message parts in the same order users authored them.

## 0.2.3

### Patch Changes

- Add NCP image attachment support across the shared chat composer, NCP runtime, React bindings, and bundled NextClaw UI so pasted or uploaded images are sent as NCP file parts and rendered inline. Also keep the required CLI/server/mcp release group in sync for the bundled NextClaw distribution.

## 0.2.2

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.

## 0.2.1

### Patch Changes

- Release the tokenized chat composer, IME fixes, and inline skill chip UI improvements.

## 0.2.0

### Minor Changes

- Unify the latest NCP native chat chain, runtime capability assembly, chat UI alignment, stream/reasoning/tool fixes, and marketplace metadata publishing into a single minor release.

## 0.1.1

### Patch Changes

- cfcd97f: Split the reusable chat presentation layer into a standalone `@nextclaw/agent-chat-ui` package and wire `@nextclaw/ui` to consume it.
