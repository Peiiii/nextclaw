# @nextclaw/kernel

## 0.6.8

### Patch Changes

- a9b125f: 增强可视化结果生成指引：Agent 会在结果适合展示时主动选择 Markdown、图表、图片或内联 HTML；内联页面保持单一焦点、自然高度和无嵌套外卡，完成后只保留可视结果，不再重复显示前后的文字复述。
- Updated dependencies [a9b125f]
- Updated dependencies [8f7e915]
  - @nextclaw/core@0.15.6
  - @nextclaw/shared@0.4.5
  - @nextclaw/mcp@0.3.6
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.7
  - @nextclaw/runtime@0.4.6
  - @nextclaw/ncp-mcp@0.2.6
  - @nextclaw/channel-extension-feishu@0.2.6
  - @nextclaw/channel-extension-weixin@0.2.6

## 0.6.7

### Patch Changes

- 00c0d23: 上下文压缩现在始终沿用当前会话所选模型；压缩请求失败时不会留下半完成状态，切换到可用模型后可以直接继续会话。

## 0.6.6

### Patch Changes

- 2eceb16: 聊天输入框现在支持通过 `@` 搜索并引用当前项目中的文件或目录：可从统一引用菜单进入文件浏览、查看路径层级并插入引用标签，发送时由 NextClaw 在项目边界内安全、限量地补充对应文件内容或目录结构上下文。
- 59a4723: 新增独立项目注册表与项目模板：项目可以在没有会话时通过界面、CLI 或 AI 创建并展示；界面提供支持导航、搜索和新建文件夹的跨平台服务端目录选择器，并按 macOS、Windows 与 Linux 展示实际可用的常用位置；CLI 与 AI 还可列出项目、修改会话名称及项目目录。
- Updated dependencies [2eceb16]
- Updated dependencies [25f8bb0]
- Updated dependencies [59a4723]
- Updated dependencies [8be3173]
  - @nextclaw/shared@0.4.4
  - @nextclaw/ncp@0.7.4
  - @nextclaw/ncp-toolkit@0.6.5
  - @nextclaw/core@0.15.5
  - @nextclaw/channel-extension-feishu@0.2.5
  - @nextclaw/channel-extension-weixin@0.2.5
  - @nextclaw/ncp-agent-runtime@0.4.4
  - @nextclaw/ncp-agent-runtime-next@0.1.4
  - @nextclaw/ncp-mcp@0.2.5
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.4
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.6
  - @nextclaw/mcp@0.3.5
  - @nextclaw/runtime@0.4.5

## 0.6.5

### Patch Changes

- 378c8b9: 优化 Agent 最终回复的展示组织，统一 Markdown、内联展示与侧栏展示提示；聊天消息现在支持稳定的流式 Mermaid 图表，并允许复制用户消息。
- 401854e: 聊天框斜杠选择器、底部技能选择器和 Agent 上下文现在会区分项目、NextClaw、全局与内建技能来源；项目技能从项目 `.agents/skills` 加载，项目 `AGENTS.md` 也会随会话上下文生效。
- Updated dependencies [401854e]
  - @nextclaw/core@0.15.4
  - @nextclaw/mcp@0.3.4
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.5
  - @nextclaw/runtime@0.4.4
  - @nextclaw/ncp-mcp@0.2.4

## 0.6.4

### Patch Changes

- 91f7bef: Keep valid Markdown resources clickable independently of target availability, render local Markdown images and SVG files correctly, add responsive Word, Excel, and PowerPoint workspace previews, preserve automatic viewers outside HTML source mode, and keep chat popovers open when the streaming composer restores focus.
- Updated dependencies [7853b3b]
  - @nextclaw/ncp-toolkit@0.6.4
  - @nextclaw/channel-extension-feishu@0.2.4
  - @nextclaw/channel-extension-weixin@0.2.4
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.4

## 0.6.3

### Patch Changes

- Auto-generated full public release batch.

  Packages:
  - @nextclaw/agent-chat
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
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.2.3
  - @nextclaw/channel-extension-weixin@0.2.3
  - @nextclaw/core@0.15.3
  - @nextclaw/mcp@0.3.3
  - @nextclaw/ncp@0.7.3
  - @nextclaw/ncp-agent-runtime@0.4.3
  - @nextclaw/ncp-agent-runtime-next@0.1.3
  - @nextclaw/ncp-mcp@0.2.3
  - @nextclaw/ncp-toolkit@0.6.3
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.3
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.3
  - @nextclaw/runtime@0.4.3
  - @nextclaw/shared@0.4.3

## 0.6.2

### Patch Changes

- 94c5ab6: Treat incomplete OpenAI Responses streams as failed runs instead of successful partial answers, retry transient native model stream failures with OpenCode-style retry metadata and backoff, and record lightweight execution contracts in message run specs for debugging.
- Updated dependencies
- Updated dependencies [51cf740]
- Updated dependencies [94c5ab6]
  - @nextclaw/channel-extension-feishu@0.2.2
  - @nextclaw/channel-extension-weixin@0.2.2
  - @nextclaw/mcp@0.3.2
  - @nextclaw/ncp@0.7.2
  - @nextclaw/ncp-mcp@0.2.2
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.2
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.2
  - @nextclaw/runtime@0.4.2
  - @nextclaw/shared@0.4.2
  - @nextclaw/ncp-agent-runtime@0.4.2
  - @nextclaw/core@0.15.2
  - @nextclaw/ncp-agent-runtime-next@0.1.2
  - @nextclaw/ncp-toolkit@0.6.2

## 0.6.1

### Patch Changes

- 1cc5d4e: Use English defaults for backend, runtime, and protocol-generated session status and abort messages, and carry abort details through NCP events so localized UI can own translation instead of receiving hard-coded Chinese copy.
- 09b7406: Preserve the current user turn during context compaction, fold compressed context into the leading system prompt, and suppress fresh-session onboarding templates after rollover so compressed NCP/native conversations continue coherently.
- e6a3443: Keep local HTML file links on source preview by default, and open rendered HTML only when show_file or the link viewer query explicitly requests it.
- a006bb7: Treat user-cancelled chat runs as cancelled session activity instead of failed errors, and keep cancelled runs out of the conversation error surface.
- Updated dependencies [7e94f21]
- Updated dependencies [1cc5d4e]
- Updated dependencies [09b7406]
- Updated dependencies [e6a3443]
- Updated dependencies [1cc5d4e]
  - @nextclaw/core@0.15.1
  - @nextclaw/ncp@0.7.1
  - @nextclaw/ncp-agent-runtime-next@0.1.1
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.1
  - @nextclaw/mcp@0.3.1
  - @nextclaw/runtime@0.4.1
  - @nextclaw/channel-extension-feishu@0.2.1
  - @nextclaw/channel-extension-weixin@0.2.1
  - @nextclaw/ncp-agent-runtime@0.4.1
  - @nextclaw/ncp-mcp@0.2.1
  - @nextclaw/ncp-toolkit@0.6.1
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.1
  - @nextclaw/shared@0.4.1

## 0.6.0

### Minor Changes

- Publish the full public NextClaw workspace as a stable minor release.

### Patch Changes

- 34f4048: Record the resolved agent run spec on the triggering user message metadata for lightweight failure diagnostics.
- bf1917a: Add inert `nextclaw-inline` Markdown code blocks for inline display declarations, keep model-visible show-content tools side-panel only without a `placement` parameter, and render inline Panel App declarations without a side-panel expand action.
- 33a931f: Add standard NCP event timing and message lifecycle fields so completed assistant process summaries can show real elapsed time derived from started and ended timestamps.
  Stamp first-party runtime, transport, and extension-produced NCP events at their producer boundary instead of estimating duration in UI or journal consumers.
  Make Codex app-server aborts emit the standard NCP abort event promptly so the conversation leaves the running state without waiting for another app-server notification.
- 0c06d9d: Fix false error previews for completed chat sessions whose activity preview was left in a running state.
- 7bcc180: Split the model-facing `show_content` display tool into `show_file`, `show_url`, and `show_panel_app` so required display parameters are explicit JSON Schema properties instead of nested description-only payload fields.
- 2d9d1b7: Add a rendered file-preview viewer for `show_content` so agents can open local HTML/page prototypes in the chat workspace side panel.
- 7bcc180: Open `show_url` targets as browser-like content tabs with address, refresh, external-open controls, and local development server guidance.
- b0cb8c2: Add a `view_image` core agent tool that lets models read local PNG, JPEG, WebP, and GIF files as visual input while preserving the existing workspace restriction policy when enabled.
- Updated dependencies [3cf5890]
- Updated dependencies [bf1917a]
- Updated dependencies
- Updated dependencies [6600b99]
- Updated dependencies [61e7a7a]
- Updated dependencies [549fb8a]
- Updated dependencies [33a931f]
- Updated dependencies [7bcc180]
- Updated dependencies [2d9d1b7]
- Updated dependencies [7bcc180]
- Updated dependencies [b0cb8c2]
  - @nextclaw/ncp-agent-runtime@0.4.0
  - @nextclaw/core@0.15.0
  - @nextclaw/channel-extension-feishu@0.2.0
  - @nextclaw/channel-extension-weixin@0.2.0
  - @nextclaw/mcp@0.3.0
  - @nextclaw/ncp@0.7.0
  - @nextclaw/ncp-agent-runtime-next@0.1.0
  - @nextclaw/ncp-mcp@0.2.0
  - @nextclaw/ncp-toolkit@0.6.0
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.0
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.0
  - @nextclaw/runtime@0.4.0
  - @nextclaw/shared@0.4.0

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

- Updated dependencies [944c27b]
  - @nextclaw/channel-extension-feishu@0.1.28
  - @nextclaw/channel-extension-weixin@0.1.32
  - @nextclaw/core@0.14.8
  - @nextclaw/mcp@0.2.18
  - @nextclaw/ncp@0.6.6
  - @nextclaw/ncp-agent-runtime@0.3.47
  - @nextclaw/ncp-agent-runtime-next@0.0.19
  - @nextclaw/ncp-mcp@0.1.113
  - @nextclaw/ncp-toolkit@0.5.41
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.16
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.17
  - @nextclaw/runtime@0.3.18
  - @nextclaw/shared@0.3.3

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

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.28-beta.0
  - @nextclaw/channel-extension-weixin@0.1.32-beta.0
  - @nextclaw/core@0.14.8-beta.0
  - @nextclaw/mcp@0.2.18-beta.0
  - @nextclaw/ncp@0.6.6-beta.0
  - @nextclaw/ncp-agent-runtime@0.3.47-beta.0
  - @nextclaw/ncp-agent-runtime-next@0.0.19-beta.0
  - @nextclaw/ncp-mcp@0.1.113-beta.0
  - @nextclaw/ncp-toolkit@0.5.41-beta.0
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.16-beta.0
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.17-beta.0
  - @nextclaw/runtime@0.3.18-beta.0
  - @nextclaw/shared@0.3.3-beta.0

## 0.5.3

### Patch Changes

- 901f770: Fix default workspace handling so Docker sessions no longer treat the default workspace symbol as a project override, and hide that default symbol from recent project choices.
- Updated dependencies [901f770]
  - @nextclaw/core@0.14.7
  - @nextclaw/mcp@0.2.17
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.16
  - @nextclaw/runtime@0.3.17
  - @nextclaw/ncp-mcp@0.1.112

## 0.5.2

### Patch Changes

- 993fbb8: Add opt-in parent context inheritance for child sessions spawned through `sessions_spawn`. Child sessions can now inherit parent messages up to the spawn anchor, and the chat timeline marks inherited context at the start of the message list.
- 6586a69: Add a Side chat slash command before skill entries in the slash panel. The command opens a right-side draft child conversation, keeps backend session creation deferred until the first send, and materializes that first send into an inherited child session.
- Updated dependencies
- Updated dependencies [993fbb8]
- Updated dependencies [d406755]
- Updated dependencies [6586a69]
  - @nextclaw/channel-extension-feishu@0.1.27
  - @nextclaw/channel-extension-weixin@0.1.31
  - @nextclaw/mcp@0.2.16
  - @nextclaw/ncp@0.6.5
  - @nextclaw/ncp-agent-runtime@0.3.46
  - @nextclaw/ncp-agent-runtime-next@0.0.18
  - @nextclaw/ncp-mcp@0.1.111
  - @nextclaw/ncp-toolkit@0.5.40
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.15
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.15
  - @nextclaw/runtime@0.3.16
  - @nextclaw/core@0.14.6
  - @nextclaw/shared@0.3.2

## 0.5.1

### Patch Changes

- 6bb305f: Improve the chat welcome composer with prompt suggestions, searchable and pinned model choices, and a kernel-backed preference store for saved UI preferences.
- 31601cd: Fix Claude Code NCP sessions showing completed tool calls as perpetually running.
- 13b1d96: Fix Codex NARP sessions getting stuck after prompt timeouts and restore completed activity previews.
- 9c02046: Stop extension processes from surviving their service runtime by passing the parent service PID to extension children, shutting down extensions during service signal cleanup, exiting SDK processes when their parent disappears, sweeping legacy orphan channel extension processes on startup, preflighting QQ gateway session quota, waiting for the quota reset before retrying, and surfacing QQ gateway close errors before the startup timeout.
- 595cc16: Add inline placement for `show_content` panel app results so chat messages can render lightweight embedded Panel App cards while keeping the existing side-panel expansion path.
- 5117e15: Clarify that inline Panel Apps are a card-specific delivery form, add landscape-first card experience guidance for built-in app creation prompts, and render inline Panel Apps as pure bounded chat cards with a side-panel expand affordance.
- d82790a: Expose runtime-default thinking capability through runtime entry configuration and session type listings, persist Codex thread metadata across NARP stdio, and pass session working directories through NCP execution context instead of coupling agent runtimes to NextClaw session state.
- Updated dependencies [f8dfffa]
- Updated dependencies [7067713]
- Updated dependencies
- Updated dependencies [31601cd]
- Updated dependencies [13b1d96]
- Updated dependencies [595cc16]
- Updated dependencies [b7fb4ab]
- Updated dependencies [5117e15]
- Updated dependencies [d82790a]
- Updated dependencies [07d776b]
  - @nextclaw/channel-extension-feishu@0.1.26
  - @nextclaw/channel-extension-weixin@0.1.30
  - @nextclaw/mcp@0.2.15
  - @nextclaw/ncp-agent-runtime@0.3.45
  - @nextclaw/ncp-mcp@0.1.110
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.14
  - @nextclaw/runtime@0.3.15
  - @nextclaw/core@0.14.5
  - @nextclaw/ncp@0.6.4
  - @nextclaw/ncp-agent-runtime-next@0.0.17
  - @nextclaw/ncp-toolkit@0.5.39
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.14
  - @nextclaw/shared@0.3.1

## 0.5.1-beta.1

### Patch Changes

- 6bb305f: Improve the chat welcome composer with prompt suggestions, searchable and pinned model choices, and a kernel-backed preference store for saved UI preferences.
- 9c02046: Stop extension processes from surviving their service runtime by passing the parent service PID to extension children, shutting down extensions during service signal cleanup, exiting SDK processes when their parent disappears, sweeping legacy orphan channel extension processes on startup, preflighting QQ gateway session quota, waiting for the quota reset before retrying, and surfacing QQ gateway close errors before the startup timeout.
- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.26-beta.1
  - @nextclaw/channel-extension-weixin@0.1.30-beta.1
  - @nextclaw/core@0.14.5-beta.1
  - @nextclaw/mcp@0.2.15-beta.1
  - @nextclaw/ncp@0.6.4-beta.1
  - @nextclaw/ncp-agent-runtime@0.3.45-beta.1
  - @nextclaw/ncp-agent-runtime-next@0.0.17-beta.1
  - @nextclaw/ncp-mcp@0.1.110-beta.1
  - @nextclaw/ncp-toolkit@0.5.39-beta.1
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.14-beta.1
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.14-beta.1
  - @nextclaw/runtime@0.3.15-beta.1
  - @nextclaw/shared@0.3.1-beta.1

## 0.5.1-beta.0

### Patch Changes

- 13b1d96: Fix Codex NARP sessions getting stuck after prompt timeouts and restore completed activity previews.
- 595cc16: Add inline placement for `show_content` panel app results so chat messages can render lightweight embedded Panel App cards while keeping the existing side-panel expansion path.
- 5117e15: Clarify that inline Panel Apps are a card-specific delivery form, add landscape-first card experience guidance for built-in app creation prompts, and render inline Panel Apps as pure bounded chat cards with a side-panel expand affordance.
- d82790a: Expose runtime-default thinking capability through runtime entry configuration and session type listings, persist Codex thread metadata across NARP stdio, and pass session working directories through NCP execution context instead of coupling agent runtimes to NextClaw session state.
- Updated dependencies
- Updated dependencies [13b1d96]
- Updated dependencies [595cc16]
- Updated dependencies [b7fb4ab]
- Updated dependencies [5117e15]
- Updated dependencies [d82790a]
- Updated dependencies [07d776b]
  - @nextclaw/channel-extension-feishu@0.1.26-beta.0
  - @nextclaw/channel-extension-weixin@0.1.30-beta.0
  - @nextclaw/mcp@0.2.15-beta.0
  - @nextclaw/ncp-agent-runtime@0.3.45-beta.0
  - @nextclaw/ncp-mcp@0.1.110-beta.0
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.14-beta.0
  - @nextclaw/runtime@0.3.15-beta.0
  - @nextclaw/core@0.14.5-beta.0
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.14-beta.0
  - @nextclaw/shared@0.3.1-beta.0
  - @nextclaw/ncp-agent-runtime-next@0.0.17-beta.0
  - @nextclaw/ncp@0.6.4-beta.0
  - @nextclaw/ncp-toolkit@0.5.39-beta.0

## 0.5.0

### Minor Changes

- c4ee481: Add the show_content chat display action so agents can ask the UI to open file, URL, or installed panel app content from tool results and realtime UI events.

### Patch Changes

- 89f2f73: Fix ACP stdio runtime failures in local dev by preventing dev-only Node export conditions from leaking into external runtime child processes, and surface child stderr in runtime errors.
- d2ca679: Persist NARP runtime session metadata updates so Codex thread ids are bound back to NextClaw sessions across restarts, and wait for Codex SDK thread metadata writers before continuing a run.
- 3624bbb: Allow NARP runtimes to use their own default model instead of always receiving a NextClaw model override.
- Updated dependencies [89f2f73]
- Updated dependencies
- Updated dependencies [c4ee481]
- Updated dependencies [d2ca679]
- Updated dependencies [3624bbb]
- Updated dependencies [3624bbb]
  - @nextclaw/core@0.14.4
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.13
  - @nextclaw/channel-extension-feishu@0.1.25
  - @nextclaw/channel-extension-weixin@0.1.29
  - @nextclaw/mcp@0.2.14
  - @nextclaw/ncp@0.6.3
  - @nextclaw/ncp-agent-runtime@0.3.44
  - @nextclaw/ncp-agent-runtime-next@0.0.16
  - @nextclaw/ncp-mcp@0.1.109
  - @nextclaw/ncp-toolkit@0.5.38
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.13
  - @nextclaw/runtime@0.3.14
  - @nextclaw/shared@0.3.0

## 0.4.3

### Patch Changes

- 6b44d57: Use real context compaction so compressed sessions feed the model a single working-context summary instead of retaining raw message tails.
- e283af5: Improve the native reply formatting prompt so local file references are emitted as clickable Markdown links.
- Updated dependencies
- Updated dependencies [6b44d57]
- Updated dependencies [d20dc48]
- Updated dependencies [aa681ba]
- Updated dependencies [7eed591]
  - @nextclaw/channel-extension-feishu@0.1.24
  - @nextclaw/channel-extension-weixin@0.1.28
  - @nextclaw/mcp@0.2.13
  - @nextclaw/ncp@0.6.2
  - @nextclaw/ncp-agent-runtime@0.3.43
  - @nextclaw/ncp-agent-runtime-next@0.0.15
  - @nextclaw/ncp-toolkit@0.5.37
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.12
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.12
  - @nextclaw/shared@0.2.12
  - @nextclaw/core@0.14.3
  - @nextclaw/runtime@0.3.13
  - @nextclaw/ncp-mcp@0.1.108

## 0.4.2

### Patch Changes

- 36c4e56: Expose session workingDir and use it as the base path for chat local file link previews.
- Updated dependencies
- Updated dependencies [36c4e56]
  - @nextclaw/channel-extension-feishu@0.1.23
  - @nextclaw/channel-extension-weixin@0.1.27
  - @nextclaw/core@0.14.2
  - @nextclaw/mcp@0.2.12
  - @nextclaw/ncp-agent-runtime@0.3.42
  - @nextclaw/ncp-agent-runtime-next@0.0.14
  - @nextclaw/ncp-mcp@0.1.107
  - @nextclaw/ncp-toolkit@0.5.36
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.11
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.11
  - @nextclaw/runtime@0.3.12
  - @nextclaw/shared@0.2.11
  - @nextclaw/ncp@0.6.1

## 0.4.1

### Patch Changes

- 78fcd8f: Move native prompt ownership from core prompt builders to kernel context providers while preserving prompt content, and route local file reply-format guidance through the native provider chain.
- 42281c8: Fix rolling context compaction so repeated checkpoints use unique service message ids and legacy journal markers replay as separate timeline records.
- cc024b3: Expose the original agent-run peerId on NCP session summaries and support filtering session lists by peerId.
- 6ec95a0: Fix Panel App sandbox loading and runtime API access, make injected App Client browser fetch calls safe inside Panel Apps, refresh the served client SDK bundle after rebuilds, show Panel App titles in the app toolbar, and teach bundled app-creation skills not to rely on browser storage inside sandboxed Panel Apps.
- Updated dependencies [1ed5aff]
- Updated dependencies
- Updated dependencies [78fcd8f]
- Updated dependencies [cc024b3]
- Updated dependencies [458c9b0]
- Updated dependencies [6ec95a0]
  - @nextclaw/channel-extension-feishu@0.1.22
  - @nextclaw/channel-extension-weixin@0.1.26
  - @nextclaw/mcp@0.2.11
  - @nextclaw/ncp-agent-runtime@0.3.41
  - @nextclaw/ncp-agent-runtime-next@0.0.13
  - @nextclaw/ncp-mcp@0.1.106
  - @nextclaw/ncp-toolkit@0.5.35
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.10
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.10
  - @nextclaw/runtime@0.3.11
  - @nextclaw/shared@0.2.10
  - @nextclaw/ncp@0.6.0
  - @nextclaw/core@0.14.1

## 0.4.1-beta.0

### Patch Changes

- 42281c8: Fix rolling context compaction so repeated checkpoints use unique service message ids and legacy journal markers replay as separate timeline records.
- cc024b3: Expose the original agent-run peerId on NCP session summaries and support filtering session lists by peerId.
- 6ec95a0: Fix Panel App sandbox loading and runtime API access, make injected App Client browser fetch calls safe inside Panel Apps, refresh the served client SDK bundle after rebuilds, show Panel App titles in the app toolbar, and teach bundled app-creation skills not to rely on browser storage inside sandboxed Panel Apps.
- Updated dependencies
- Updated dependencies [cc024b3]
- Updated dependencies [458c9b0]
- Updated dependencies [6ec95a0]
  - @nextclaw/channel-extension-feishu@0.1.22-beta.0
  - @nextclaw/channel-extension-weixin@0.1.26-beta.0
  - @nextclaw/mcp@0.2.11-beta.0
  - @nextclaw/ncp-agent-runtime@0.3.41-beta.0
  - @nextclaw/ncp-agent-runtime-next@0.0.13-beta.0
  - @nextclaw/ncp-mcp@0.1.106-beta.0
  - @nextclaw/ncp-toolkit@0.5.35-beta.0
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.10-beta.0
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.10-beta.0
  - @nextclaw/runtime@0.3.11-beta.0
  - @nextclaw/shared@0.2.10-beta.0
  - @nextclaw/ncp@0.6.0-beta.0
  - @nextclaw/core@0.14.1-beta.0

## 0.4.0

### Minor Changes

- 226b3cf: Expose an app-facing NextClaw App Client projection for Panel Apps.

### Patch Changes

- 86a0dc8: Inject the standard NextClaw client SDK into authorized folder Panel Apps as `window.nextclaw.client`, with persistent app-level client grants and the existing bridge APIs preserved.
- 240d5ab: Fix runtime child process environments so Service App and NARP stdio launches can resolve the current Node executable after autostart.
- 170c8be: Improve session activity previews so thinking states read as thinking and completed tool calls keep the tool name visible.
- 86acdbe: Publish session run status updates from the agent run request flow, keep realtime running overlays from being overwritten by persisted idle summaries, and remove the unused session run publish API from the runtime-next session state contract.
- Updated dependencies [14c5730]
- Updated dependencies [43da21a]
- Updated dependencies [226b3cf]
- Updated dependencies [0dc6471]
- Updated dependencies [86a0dc8]
- Updated dependencies [240d5ab]
- Updated dependencies [75e0dcb]
- Updated dependencies [86acdbe]
  - @nextclaw/channel-extension-feishu@0.1.21
  - @nextclaw/channel-extension-weixin@0.1.25
  - @nextclaw/mcp@0.2.10
  - @nextclaw/ncp@0.5.29
  - @nextclaw/ncp-agent-runtime@0.3.40
  - @nextclaw/ncp-mcp@0.1.105
  - @nextclaw/ncp-toolkit@0.5.34
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.9
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.9
  - @nextclaw/runtime@0.3.10
  - @nextclaw/shared@0.2.9
  - @nextclaw/ncp-agent-runtime-next@0.0.12
  - @nextclaw/core@0.14.0

## 0.4.0-beta.1

### Minor Changes

- 226b3cf: Expose an app-facing NextClaw App Client projection for Panel Apps.

### Patch Changes

- 240d5ab: Fix runtime child process environments so Service App and NARP stdio launches can resolve the current Node executable after autostart.
- Updated dependencies
- Updated dependencies [226b3cf]
- Updated dependencies [240d5ab]
- Updated dependencies [75e0dcb]
  - @nextclaw/channel-extension-feishu@0.1.21-beta.1
  - @nextclaw/channel-extension-weixin@0.1.25-beta.1
  - @nextclaw/mcp@0.2.10-beta.1
  - @nextclaw/ncp@0.5.29-beta.1
  - @nextclaw/ncp-agent-runtime@0.3.40-beta.1
  - @nextclaw/ncp-agent-runtime-next@0.0.12-beta.1
  - @nextclaw/ncp-mcp@0.1.105-beta.1
  - @nextclaw/ncp-toolkit@0.5.34-beta.1
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.9-beta.1
  - @nextclaw/runtime@0.3.10-beta.1
  - @nextclaw/shared@0.2.9-beta.1
  - @nextclaw/core@0.14.0-beta.1
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.9-beta.1

## 0.3.4-beta.0

### Patch Changes

- 86a0dc8: Inject the standard NextClaw client SDK into authorized folder Panel Apps as `window.nextclaw.client`, with persistent app-level client grants and the existing bridge APIs preserved.
- 170c8be: Improve session activity previews so thinking states read as thinking and completed tool calls keep the tool name visible.
- 86acdbe: Publish session run status updates from the agent run request flow, keep realtime running overlays from being overwritten by persisted idle summaries, and remove the unused session run publish API from the runtime-next session state contract.
- Updated dependencies
- Updated dependencies [86a0dc8]
- Updated dependencies [86acdbe]
  - @nextclaw/channel-extension-feishu@0.1.21-beta.0
  - @nextclaw/channel-extension-weixin@0.1.25-beta.0
  - @nextclaw/mcp@0.2.10-beta.0
  - @nextclaw/ncp@0.5.29-beta.0
  - @nextclaw/ncp-agent-runtime@0.3.40-beta.0
  - @nextclaw/ncp-mcp@0.1.105-beta.0
  - @nextclaw/ncp-toolkit@0.5.34-beta.0
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.9-beta.0
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.9-beta.0
  - @nextclaw/runtime@0.3.10-beta.0
  - @nextclaw/shared@0.2.9-beta.0
  - @nextclaw/core@0.13.10-beta.0
  - @nextclaw/ncp-agent-runtime-next@0.0.12-beta.0

## 0.3.3

### Patch Changes

- 3061877: Decouple cron jobs from channel delivery settings. Scheduled jobs now ask the agent to call the message tool for notifications, while Weixin sends fail honestly when account, channel, API, or context_token delivery state is unavailable.
- Updated dependencies
- Updated dependencies [3061877]
  - @nextclaw/channel-extension-feishu@0.1.20
  - @nextclaw/mcp@0.2.9
  - @nextclaw/ncp@0.5.28
  - @nextclaw/ncp-agent-runtime@0.3.39
  - @nextclaw/ncp-agent-runtime-next@0.0.11
  - @nextclaw/ncp-mcp@0.1.104
  - @nextclaw/ncp-toolkit@0.5.33
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.8
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.8
  - @nextclaw/runtime@0.3.9
  - @nextclaw/shared@0.2.8
  - @nextclaw/core@0.13.9
  - @nextclaw/channel-extension-weixin@0.1.24

## 0.3.2

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

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.19
  - @nextclaw/channel-extension-weixin@0.1.23
  - @nextclaw/core@0.13.8
  - @nextclaw/mcp@0.2.8
  - @nextclaw/ncp@0.5.27
  - @nextclaw/ncp-agent-runtime@0.3.38
  - @nextclaw/ncp-agent-runtime-next@0.0.10
  - @nextclaw/ncp-mcp@0.1.103
  - @nextclaw/ncp-toolkit@0.5.32
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.7
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.7
  - @nextclaw/runtime@0.3.8
  - @nextclaw/shared@0.2.7

## 0.3.1

### Patch Changes

- Clarify built-in app creator skills so generated Panel Apps and Service Apps do not ask users to restart NextClaw for normal workspace changes.
- Updated dependencies
  - @nextclaw/core@0.13.7
  - @nextclaw/runtime@0.3.7
  - @nextclaw/mcp@0.2.7
  - @nextclaw/ncp-mcp@0.1.102

## 0.3.0

### Minor Changes

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

### Patch Changes

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.18
  - @nextclaw/channel-extension-weixin@0.1.22
  - @nextclaw/core@0.13.6
  - @nextclaw/mcp@0.2.6
  - @nextclaw/ncp@0.5.26
  - @nextclaw/ncp-agent-runtime@0.3.37
  - @nextclaw/ncp-agent-runtime-next@0.0.9
  - @nextclaw/ncp-mcp@0.1.101
  - @nextclaw/ncp-toolkit@0.5.31
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.6
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.6
  - @nextclaw/runtime@0.3.6
  - @nextclaw/shared@0.2.6

## 0.2.5

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

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.17
  - @nextclaw/channel-extension-weixin@0.1.21
  - @nextclaw/core@0.13.5
  - @nextclaw/mcp@0.2.5
  - @nextclaw/ncp@0.5.25
  - @nextclaw/ncp-agent-runtime@0.3.36
  - @nextclaw/ncp-agent-runtime-next@0.0.8
  - @nextclaw/ncp-mcp@0.1.100
  - @nextclaw/ncp-toolkit@0.5.30
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.5
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.5
  - @nextclaw/runtime@0.3.5
  - @nextclaw/shared@0.2.5

## 0.2.4

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

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.16
  - @nextclaw/channel-extension-weixin@0.1.20
  - @nextclaw/core@0.13.4
  - @nextclaw/mcp@0.2.4
  - @nextclaw/ncp@0.5.24
  - @nextclaw/ncp-agent-runtime@0.3.35
  - @nextclaw/ncp-agent-runtime-next@0.0.7
  - @nextclaw/ncp-mcp@0.1.99
  - @nextclaw/ncp-toolkit@0.5.29
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.4
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.4
  - @nextclaw/runtime@0.3.4
  - @nextclaw/shared@0.2.4

## 0.2.3

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

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.15
  - @nextclaw/channel-extension-weixin@0.1.19
  - @nextclaw/core@0.13.3
  - @nextclaw/mcp@0.2.3
  - @nextclaw/ncp@0.5.23
  - @nextclaw/ncp-agent-runtime@0.3.34
  - @nextclaw/ncp-agent-runtime-next@0.0.6
  - @nextclaw/ncp-mcp@0.1.98
  - @nextclaw/ncp-toolkit@0.5.28
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.3
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.3
  - @nextclaw/runtime@0.3.3
  - @nextclaw/shared@0.2.3

## 0.2.2

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

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.14
  - @nextclaw/channel-extension-weixin@0.1.17
  - @nextclaw/core@0.13.2
  - @nextclaw/mcp@0.2.2
  - @nextclaw/ncp@0.5.22
  - @nextclaw/ncp-agent-runtime@0.3.33
  - @nextclaw/ncp-agent-runtime-next@0.0.5
  - @nextclaw/ncp-mcp@0.1.97
  - @nextclaw/ncp-toolkit@0.5.27
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.2
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.2
  - @nextclaw/runtime@0.3.2
  - @nextclaw/shared@0.2.2

## 0.2.1

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

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.13
  - @nextclaw/channel-extension-weixin@0.1.16
  - @nextclaw/core@0.13.1
  - @nextclaw/mcp@0.2.1
  - @nextclaw/ncp@0.5.21
  - @nextclaw/ncp-agent-runtime@0.3.32
  - @nextclaw/ncp-agent-runtime-next@0.0.4
  - @nextclaw/ncp-mcp@0.1.96
  - @nextclaw/ncp-toolkit@0.5.26
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.1
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.1
  - @nextclaw/runtime@0.3.1
  - @nextclaw/shared@0.2.1

## 0.2.0

### Minor Changes

- Release the NextClaw lightweight app platform as a minor feature line.

  Panel Apps now receive developer-friendly bridge results: service action lists resolve to arrays, service action invokes resolve to business payloads, and built-in app creator skills document the canonical Panel + Service + Agent contract.

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.13.0
  - @nextclaw/mcp@0.2.0
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.0
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.0
  - @nextclaw/runtime@0.3.0
  - @nextclaw/shared@0.2.0
  - @nextclaw/channel-extension-feishu@0.1.12
  - @nextclaw/channel-extension-weixin@0.1.15
  - @nextclaw/ncp-mcp@0.1.95

## 0.1.17

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

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.11
  - @nextclaw/channel-extension-weixin@0.1.14
  - @nextclaw/core@0.12.27
  - @nextclaw/mcp@0.1.92
  - @nextclaw/ncp@0.5.20
  - @nextclaw/ncp-agent-runtime@0.3.31
  - @nextclaw/ncp-agent-runtime-next@0.0.3
  - @nextclaw/ncp-mcp@0.1.94
  - @nextclaw/ncp-toolkit@0.5.25
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.19
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.20
  - @nextclaw/runtime@0.2.59
  - @nextclaw/shared@0.1.14

## 0.1.16

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

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.10
  - @nextclaw/channel-extension-weixin@0.1.13
  - @nextclaw/core@0.12.26
  - @nextclaw/mcp@0.1.91
  - @nextclaw/ncp@0.5.19
  - @nextclaw/ncp-agent-runtime@0.3.30
  - @nextclaw/ncp-agent-runtime-next@0.0.2
  - @nextclaw/ncp-mcp@0.1.93
  - @nextclaw/ncp-toolkit@0.5.24
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.18
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.19
  - @nextclaw/runtime@0.2.58
  - @nextclaw/shared@0.1.13

## 0.1.15

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

- Updated dependencies [b99164b]
- Updated dependencies [2f4f480]
- Updated dependencies [828495f]
- Updated dependencies [25207de]
- Updated dependencies [854abec]
- Updated dependencies [26163ed]
- Updated dependencies [5535f60]
- Updated dependencies [509b157]
  - @nextclaw/channel-extension-feishu@0.1.9
  - @nextclaw/channel-extension-weixin@0.1.12
  - @nextclaw/core@0.12.25
  - @nextclaw/mcp@0.1.90
  - @nextclaw/ncp@0.5.18
  - @nextclaw/ncp-agent-runtime@0.3.29
  - @nextclaw/ncp-mcp@0.1.92
  - @nextclaw/ncp-toolkit@0.5.23
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18
  - @nextclaw/runtime@0.2.57
  - @nextclaw/shared@0.1.12
  - @nextclaw/ncp-agent-runtime-next@0.0.1

## 0.1.15-beta.7

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

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.9-beta.7
  - @nextclaw/channel-extension-weixin@0.1.12-beta.7
  - @nextclaw/core@0.12.25-beta.7
  - @nextclaw/mcp@0.1.90-beta.7
  - @nextclaw/ncp@0.5.18-beta.7
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.7
  - @nextclaw/ncp-agent-runtime-next@0.0.1-beta.7
  - @nextclaw/ncp-mcp@0.1.92-beta.7
  - @nextclaw/ncp-toolkit@0.5.23-beta.7
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.7
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.7
  - @nextclaw/runtime@0.2.57-beta.7
  - @nextclaw/shared@0.1.12-beta.7

## 0.1.15-beta.6

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

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.9-beta.6
  - @nextclaw/channel-extension-weixin@0.1.12-beta.6
  - @nextclaw/core@0.12.25-beta.6
  - @nextclaw/mcp@0.1.90-beta.6
  - @nextclaw/ncp@0.5.18-beta.6
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.6
  - @nextclaw/ncp-agent-runtime-next@0.0.1-beta.6
  - @nextclaw/ncp-mcp@0.1.92-beta.6
  - @nextclaw/ncp-toolkit@0.5.23-beta.6
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.6
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.6
  - @nextclaw/runtime@0.2.57-beta.6
  - @nextclaw/shared@0.1.12-beta.6

## 0.1.15-beta.5

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

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.9-beta.5
  - @nextclaw/channel-extension-weixin@0.1.12-beta.5
  - @nextclaw/core@0.12.25-beta.5
  - @nextclaw/mcp@0.1.90-beta.5
  - @nextclaw/ncp@0.5.18-beta.5
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.5
  - @nextclaw/ncp-agent-runtime-next@0.0.1-beta.5
  - @nextclaw/ncp-mcp@0.1.92-beta.5
  - @nextclaw/ncp-toolkit@0.5.23-beta.5
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.5
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.5
  - @nextclaw/runtime@0.2.57-beta.5
  - @nextclaw/shared@0.1.12-beta.5

## 0.1.15-beta.4

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

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.9-beta.4
  - @nextclaw/channel-extension-weixin@0.1.12-beta.4
  - @nextclaw/core@0.12.25-beta.4
  - @nextclaw/mcp@0.1.90-beta.4
  - @nextclaw/ncp@0.5.18-beta.4
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.4
  - @nextclaw/ncp-agent-runtime-next@0.0.1-beta.4
  - @nextclaw/ncp-mcp@0.1.92-beta.4
  - @nextclaw/ncp-toolkit@0.5.23-beta.4
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.4
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.4
  - @nextclaw/runtime@0.2.57-beta.4
  - @nextclaw/shared@0.1.12-beta.4

## 0.1.15-beta.3

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

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.9-beta.3
  - @nextclaw/channel-extension-weixin@0.1.12-beta.3
  - @nextclaw/core@0.12.25-beta.3
  - @nextclaw/mcp@0.1.90-beta.3
  - @nextclaw/ncp@0.5.18-beta.3
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.3
  - @nextclaw/ncp-agent-runtime-next@0.0.1-beta.3
  - @nextclaw/ncp-mcp@0.1.92-beta.3
  - @nextclaw/ncp-toolkit@0.5.23-beta.3
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.3
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.3
  - @nextclaw/runtime@0.2.57-beta.3
  - @nextclaw/shared@0.1.12-beta.3

## 0.1.15-beta.2

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

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.9-beta.2
  - @nextclaw/channel-extension-weixin@0.1.12-beta.2
  - @nextclaw/core@0.12.25-beta.2
  - @nextclaw/mcp@0.1.90-beta.2
  - @nextclaw/ncp@0.5.18-beta.2
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.2
  - @nextclaw/ncp-agent-runtime-next@0.0.1-beta.2
  - @nextclaw/ncp-mcp@0.1.92-beta.2
  - @nextclaw/ncp-toolkit@0.5.23-beta.2
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.2
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.2
  - @nextclaw/runtime@0.2.57-beta.2
  - @nextclaw/shared@0.1.12-beta.2

## 0.1.15-beta.1

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

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.9-beta.1
  - @nextclaw/channel-extension-weixin@0.1.12-beta.1
  - @nextclaw/core@0.12.25-beta.1
  - @nextclaw/mcp@0.1.90-beta.1
  - @nextclaw/ncp@0.5.18-beta.1
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.1
  - @nextclaw/ncp-agent-runtime-next@0.0.1-beta.1
  - @nextclaw/ncp-mcp@0.1.92-beta.1
  - @nextclaw/ncp-toolkit@0.5.23-beta.1
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.1
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.1
  - @nextclaw/runtime@0.2.57-beta.1
  - @nextclaw/shared@0.1.12-beta.1

## 0.1.15-beta.0

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

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.9-beta.0
  - @nextclaw/channel-extension-weixin@0.1.12-beta.0
  - @nextclaw/core@0.12.25-beta.0
  - @nextclaw/mcp@0.1.90-beta.0
  - @nextclaw/ncp@0.5.18-beta.0
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.0
  - @nextclaw/ncp-mcp@0.1.92-beta.0
  - @nextclaw/ncp-toolkit@0.5.23-beta.0
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.0
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.0
  - @nextclaw/runtime@0.2.57-beta.0
  - @nextclaw/shared@0.1.12-beta.0
  - @nextclaw/ncp-agent-runtime-next@0.0.1-beta.0

## 0.1.14

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

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.8
  - @nextclaw/channel-extension-weixin@0.1.11
  - @nextclaw/core@0.12.24
  - @nextclaw/mcp@0.1.89
  - @nextclaw/ncp@0.5.17
  - @nextclaw/ncp-agent-runtime@0.3.28
  - @nextclaw/ncp-mcp@0.1.91
  - @nextclaw/ncp-toolkit@0.5.22
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.16
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.17
  - @nextclaw/openclaw-compat@1.0.24
  - @nextclaw/runtime@0.2.56
  - @nextclaw/shared@0.1.11

## 0.1.13

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

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.7
  - @nextclaw/channel-extension-weixin@0.1.10
  - @nextclaw/core@0.12.23
  - @nextclaw/mcp@0.1.88
  - @nextclaw/ncp@0.5.16
  - @nextclaw/ncp-agent-runtime@0.3.27
  - @nextclaw/ncp-mcp@0.1.90
  - @nextclaw/ncp-toolkit@0.5.21
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.15
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.16
  - @nextclaw/openclaw-compat@1.0.23
  - @nextclaw/runtime@0.2.55
  - @nextclaw/shared@0.1.10

## 0.1.12

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

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.6
  - @nextclaw/channel-extension-weixin@0.1.9
  - @nextclaw/core@0.12.22
  - @nextclaw/mcp@0.1.87
  - @nextclaw/ncp@0.5.15
  - @nextclaw/ncp-agent-runtime@0.3.26
  - @nextclaw/ncp-mcp@0.1.89
  - @nextclaw/ncp-toolkit@0.5.20
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.14
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.15
  - @nextclaw/openclaw-compat@1.0.22
  - @nextclaw/runtime@0.2.54
  - @nextclaw/shared@0.1.9

## 0.1.11

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

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.5
  - @nextclaw/channel-extension-weixin@0.1.8
  - @nextclaw/core@0.12.21
  - @nextclaw/mcp@0.1.86
  - @nextclaw/ncp@0.5.14
  - @nextclaw/ncp-agent-runtime@0.3.25
  - @nextclaw/ncp-mcp@0.1.88
  - @nextclaw/ncp-toolkit@0.5.19
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.13
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.14
  - @nextclaw/openclaw-compat@1.0.21
  - @nextclaw/runtime@0.2.53
  - @nextclaw/shared@0.1.8

## 0.1.10

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp-agent-runtime@0.3.24
  - @nextclaw/ncp-toolkit@0.5.18

## 0.1.9

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

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.4
  - @nextclaw/channel-extension-weixin@0.1.7
  - @nextclaw/core@0.12.20
  - @nextclaw/mcp@0.1.85
  - @nextclaw/ncp@0.5.13
  - @nextclaw/ncp-agent-runtime@0.3.23
  - @nextclaw/ncp-mcp@0.1.87
  - @nextclaw/ncp-toolkit@0.5.18
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.12
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.13
  - @nextclaw/openclaw-compat@1.0.20
  - @nextclaw/runtime@0.2.52
  - @nextclaw/shared@0.1.7

## 0.1.8

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

- Updated dependencies
  - @nextclaw/core@0.12.19
  - @nextclaw/mcp@0.1.84
  - @nextclaw/ncp@0.5.12
  - @nextclaw/ncp-agent-runtime@0.3.22
  - @nextclaw/ncp-http-agent-server@0.3.24
  - @nextclaw/ncp-mcp@0.1.86
  - @nextclaw/ncp-toolkit@0.5.17
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.11
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.11
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.12
  - @nextclaw/openclaw-compat@1.0.19
  - @nextclaw/runtime@0.2.51
  - @nextclaw/shared@0.1.6

## 0.1.7

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

- Updated dependencies
  - @nextclaw/core@0.12.18
  - @nextclaw/mcp@0.1.83
  - @nextclaw/ncp@0.5.11
  - @nextclaw/ncp-agent-runtime@0.3.21
  - @nextclaw/ncp-http-agent-server@0.3.23
  - @nextclaw/ncp-mcp@0.1.85
  - @nextclaw/ncp-toolkit@0.5.16
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.10
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.10
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.11
  - @nextclaw/openclaw-compat@1.0.18
  - @nextclaw/runtime@0.2.50
  - @nextclaw/shared@0.1.5

## 0.1.6

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

- Updated dependencies
  - @nextclaw/core@0.12.17
  - @nextclaw/mcp@0.1.82
  - @nextclaw/ncp@0.5.10
  - @nextclaw/ncp-agent-runtime@0.3.20
  - @nextclaw/ncp-http-agent-server@0.3.22
  - @nextclaw/ncp-mcp@0.1.84
  - @nextclaw/ncp-toolkit@0.5.15
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.9
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.9
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.10
  - @nextclaw/openclaw-compat@1.0.17
  - @nextclaw/runtime@0.2.49
  - @nextclaw/shared@0.1.4

## 0.1.5

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

- Updated dependencies
  - @nextclaw/core@0.12.16
  - @nextclaw/mcp@0.1.81
  - @nextclaw/ncp@0.5.9
  - @nextclaw/ncp-agent-runtime@0.3.19
  - @nextclaw/ncp-http-agent-server@0.3.21
  - @nextclaw/ncp-mcp@0.1.83
  - @nextclaw/ncp-toolkit@0.5.14
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.8
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.8
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.9
  - @nextclaw/openclaw-compat@1.0.16
  - @nextclaw/runtime@0.2.48
  - @nextclaw/shared@0.1.3

## 0.1.4

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

- Updated dependencies
  - @nextclaw/core@0.12.15
  - @nextclaw/mcp@0.1.80
  - @nextclaw/ncp@0.5.8
  - @nextclaw/ncp-agent-runtime@0.3.18
  - @nextclaw/ncp-http-agent-server@0.3.20
  - @nextclaw/ncp-mcp@0.1.82
  - @nextclaw/ncp-toolkit@0.5.13
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.7
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.7
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.8
  - @nextclaw/openclaw-compat@1.0.15
  - @nextclaw/runtime@0.2.47
  - @nextclaw/shared@0.1.2

## 0.1.3

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

- Updated dependencies
  - @nextclaw/core@0.12.14
  - @nextclaw/mcp@0.1.79
  - @nextclaw/ncp@0.5.7
  - @nextclaw/ncp-agent-runtime@0.3.17
  - @nextclaw/ncp-http-agent-server@0.3.19
  - @nextclaw/ncp-mcp@0.1.81
  - @nextclaw/ncp-toolkit@0.5.12
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.6
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.6
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.7
  - @nextclaw/openclaw-compat@1.0.14
  - @nextclaw/runtime@0.2.46
  - @nextclaw/shared@0.1.1

## 0.1.2

### Patch Changes

- a11f4fd: Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
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
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
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

- Updated dependencies [0251268]
- Updated dependencies [2418020]
- Updated dependencies [a5da9d6]
- Updated dependencies [1600643]
- Updated dependencies [223037c]
  - @nextclaw/ncp@0.5.6

## 0.1.2-beta.6

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

- Updated dependencies
  - @nextclaw/ncp@0.5.6-beta.4

## 0.1.2-beta.5

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

- Updated dependencies
  - @nextclaw/ncp@0.5.6-beta.3

## 0.1.2-beta.4

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

- Updated dependencies
  - @nextclaw/ncp@0.5.6-beta.2

## 0.1.2-beta.3

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

- Updated dependencies
  - @nextclaw/ncp@0.5.6-beta.1

## 0.1.2-beta.2

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
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
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
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

## 0.1.2-beta.1

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.5.6-beta.0

## 0.1.1

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

- Updated dependencies
  - @nextclaw/ncp@0.5.5
