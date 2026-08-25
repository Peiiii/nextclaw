# @nextclaw/ncp-react

## 0.5.24

### Patch Changes

- Updated dependencies [2c7ce8c]
- Updated dependencies [eeac1f6]
- Updated dependencies [ec60bc1]
  - @nextclaw/ncp@0.9.0
  - @nextclaw/ncp-toolkit@0.6.22

## 0.5.24-beta.0

### Patch Changes

- Updated dependencies [2c7ce8c]
- Updated dependencies [eeac1f6]
- Updated dependencies [ec60bc1]
  - @nextclaw/ncp@0.9.0-beta.0
  - @nextclaw/ncp-toolkit@0.6.22-beta.0

## 0.5.23

### Patch Changes

- 1d63057: 重载工具调用会话现在会先显示受预算保护的最近内容，再自动补齐近期上下文，并减少重复 hydrate 与首屏资源串行等待；发布包同时内置经过校验的预压缩 UI 资产，外部静态服务器升级后不再丢失快速传输路径。真实 VPS 已登录热刷新中位约 1.13 秒，同时保留完整工具详情和更早历史。
- Updated dependencies [7cc703c]
  - @nextclaw/ncp@0.8.1
  - @nextclaw/ncp-toolkit@0.6.21

## 0.5.22

### Patch Changes

- e2a7c8e: 提升 Web Chat 在普通网络抖动后的恢复稳定性：SSE 半开或长时间无数据时会主动判定失活并重连，连接恢复后重新补齐会话历史，同时保留更晚到达的实时完成事件，无需刷新页面即可继续看到最终回复。
- Updated dependencies [aa08a3f]
- Updated dependencies [e2a7c8e]
  - @nextclaw/ncp@0.8.0
  - @nextclaw/ncp-toolkit@0.6.20

## 0.5.21

### Patch Changes

- 0b7df97: 改善 Web Chat 长连接的稳定性：空闲 SSE 现在会主动保活，短暂断流可在后台补齐会话并重连，不再立即展示无意义的网络错误；持续连接失败仍会明确提示。启动恢复同时改为逐会话、逐行扫描历史日志，降低大 journal 场景的峰值内存和 OOM 风险。
- Updated dependencies [c783019]
  - @nextclaw/ncp@0.7.17
  - @nextclaw/ncp-toolkit@0.6.19

## 0.5.20

### Patch Changes

- 8049f49: 支持直接编辑当前会话最近一条用户消息并在同一会话继续执行；中断或失败后可从输入框或最近一条 AI 回复继续运行，后续输出会直接续写原回复而不是新增消息气泡，并准确区分续写前后成功与取消的工具操作。编辑器会自动聚焦到末尾，运行中隐藏编辑操作，所有纯图标入口均提供明确提示；切换模型时会继续保留可用的恢复入口。
- ae21568: 修复运行中断或服务重启后，较早的助手回复偶尔排到后来用户消息之后的问题；聊天记录会按实际时间线稳定显示，并自动重建已有的错误消息索引。
- 98c5b7f: 精简默认聊天消息的重复身份信息：Main Agent 使用 Native runtime 时，助手回复不再重复展示头像和名称；新会话发送后，首条用户消息与“Agent 正在思考...”会立即稳定显示，并在正式会话生成前后保持连续；编辑后重新执行或继续运行也无需等待后端 running 确认；首个可见回复出现后立即隐藏思考提示；已处理摘要移除无操作含义的前置图标。
- 8e53d92: Native 会话会在同一次长任务的工具调用轮次之间自动压缩上下文；压缩输入、输出和最终 checkpoint 使用包含工具 schema 与输出预留的同一动态预算，压缩后除完整摘要外还会按 token 预算保留最近的真实用户原文。上下文指示器会按完整输入显示系统与工具、会话内容、自动压缩线和输出预留。Agent 配置会按当前指令与全量工具动态拒绝不可用的小窗口；send、继续运行和编辑重跑共享同一运行状态入口，进程中断统一恢复为可继续的中性终态。运行中压缩与 continuation 前压缩会稳定显示在对应助手过程位置，刷新后不再堆到消息末尾。
- Updated dependencies [ae21568]
- Updated dependencies [98c5b7f]
- Updated dependencies [8e53d92]
  - @nextclaw/ncp-toolkit@0.6.18
  - @nextclaw/ncp@0.7.16

## 0.5.19

### Patch Changes

- Updated dependencies [dbececb]
  - @nextclaw/ncp-toolkit@0.6.17

## 0.5.18

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
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/remote
  - @nextclaw/runtime

- Updated dependencies
- Updated dependencies [d80eeb2]
  - @nextclaw/ncp-toolkit@0.6.16
  - @nextclaw/ncp@0.7.15

## 0.5.17

### Patch Changes

- 8f93ce4: 修复 AI 回复期间追加消息会同时出现在会话记录和待发队列的问题；排队消息会在真正开始执行后进入会话记录，并且只显示一次。
- Updated dependencies [c35189d]
- Updated dependencies
  - @nextclaw/ncp@0.7.14
  - @nextclaw/ncp-toolkit@0.6.15

## 0.5.16

### Patch Changes

- ccb9829: 修复发送消息后偶尔需要刷新页面才会显示的问题；消息会立即出现在当前会话中，实时连接中断后也会自动补回遗漏内容。

## 0.5.15

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
  - @nextclaw/service
  - @nextclaw/shared
  - nextclaw

- Updated dependencies
  - @nextclaw/ncp@0.7.13
  - @nextclaw/ncp-toolkit@0.6.14

## 0.5.14

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
  - @nextclaw/runtime
  - @nextclaw/shared

- Updated dependencies
  - @nextclaw/ncp@0.7.12
  - @nextclaw/ncp-toolkit@0.6.13

## 0.5.13

### Patch Changes

- e9d49c0: 会话正在回复时继续发送的消息现在由后端按会话排队，并会在当前回复完成后按顺序执行；切换会话或刷新页面后仍能查看、编辑和删除对应会话的待发消息。
- Updated dependencies
  - @nextclaw/ncp@0.7.11
  - @nextclaw/ncp-toolkit@0.6.12

## 0.5.12

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
  - nextclaw

- Updated dependencies
  - @nextclaw/ncp@0.7.10
  - @nextclaw/ncp-toolkit@0.6.11

## 0.5.11

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
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/runtime

- Updated dependencies [36c5362]
- Updated dependencies
  - @nextclaw/ncp@0.7.9
  - @nextclaw/ncp-toolkit@0.6.10

## 0.5.10

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
  - nextclaw

- Updated dependencies
  - @nextclaw/ncp@0.7.8
  - @nextclaw/ncp-toolkit@0.6.9

## 0.5.9

### Patch Changes

- 61f6bd1: 长会话现在会按需加载较早消息，并使用动态高度虚拟列表保持流畅滚动。HTML、Panel App 与折叠内容展开或收起时会自动校准高度，向上翻页时继续保持当前阅读位置。
- Updated dependencies [61f6bd1]
- Updated dependencies [ddc3213]
  - @nextclaw/ncp@0.7.7
  - @nextclaw/ncp-toolkit@0.6.8

## 0.5.8

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

- Updated dependencies
  - @nextclaw/ncp@0.7.6
  - @nextclaw/ncp-toolkit@0.6.7

## 0.5.7

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

- Updated dependencies
  - @nextclaw/ncp@0.7.5
  - @nextclaw/ncp-toolkit@0.6.6

## 0.5.6

### Patch Changes

- 4052d16: 修复窄屏布局从会话列表进入已有会话时，历史消息偶尔显示为空的问题；会话详情标题现在也可以直接下拉搜索和切换会话。

## 0.5.5

### Patch Changes

- 25f8bb0: 修复聊天中的会话模型恢复、重试错误提示、技能选择和折叠会话列表交互，并为 `/`、`@` 选择项补充类型图标。
- Updated dependencies [25f8bb0]
  - @nextclaw/ncp@0.7.4
  - @nextclaw/ncp-toolkit@0.6.5

## 0.5.4

### Patch Changes

- Updated dependencies [7853b3b]
  - @nextclaw/ncp-toolkit@0.6.4

## 0.5.3

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
  - @nextclaw/ncp@0.7.3
  - @nextclaw/ncp-toolkit@0.6.3

## 0.5.2

### Patch Changes

- Publish the full public NextClaw workspace as a unified stable patch release.

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
  - @nextclaw/companion
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
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
  - @nextclaw/service
  - @nextclaw/shared
  - nextclaw

- Updated dependencies
- Updated dependencies [94c5ab6]
  - @nextclaw/ncp@0.7.2
  - @nextclaw/ncp-toolkit@0.6.2

## 0.5.1

### Patch Changes

- 1cc5d4e: Use English defaults for backend, runtime, and protocol-generated session status and abort messages, and carry abort details through NCP events so localized UI can own translation instead of receiving hard-coded Chinese copy.
- Updated dependencies [1cc5d4e]
  - @nextclaw/ncp@0.7.1
  - @nextclaw/ncp-toolkit@0.6.1

## 0.5.0

### Minor Changes

- Publish the full public NextClaw workspace as a stable minor release.

### Patch Changes

- 33a931f: Add standard NCP event timing and message lifecycle fields so completed assistant process summaries can show real elapsed time derived from started and ended timestamps.
  Stamp first-party runtime, transport, and extension-produced NCP events at their producer boundary instead of estimating duration in UI or journal consumers.
  Make Codex app-server aborts emit the standard NCP abort event promptly so the conversation leaves the running state without waiting for another app-server notification.
- Updated dependencies
- Updated dependencies [61e7a7a]
- Updated dependencies [33a931f]
  - @nextclaw/ncp@0.7.0
  - @nextclaw/ncp-toolkit@0.6.0

## 0.4.56

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
  - @nextclaw/ncp@0.6.6
  - @nextclaw/ncp-toolkit@0.5.41

## 0.4.56-beta.0

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
  - @nextclaw/ncp@0.6.6-beta.0
  - @nextclaw/ncp-toolkit@0.5.41-beta.0

## 0.4.55

### Patch Changes

- Auto-generated full public stable release batch.

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
  - @nextclaw/server
  - @nextclaw/service
  - nextclaw

- Updated dependencies
  - @nextclaw/ncp@0.6.5
  - @nextclaw/ncp-toolkit@0.5.40

## 0.4.54

### Patch Changes

- f8dfffa: Auto-generated full public beta release batch.

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
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/service
  - nextclaw

- 7067713: Auto-generated full public beta release batch.

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
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
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
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/shared
  - nextclaw

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

- Updated dependencies [7067713]
- Updated dependencies
- Updated dependencies [d82790a]
  - @nextclaw/ncp@0.6.4
  - @nextclaw/ncp-toolkit@0.5.39

## 0.4.54-beta.1

### Patch Changes

- Auto-generated full public beta release batch.

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
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
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
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/shared
  - nextclaw

- Updated dependencies
  - @nextclaw/ncp@0.6.4-beta.1
  - @nextclaw/ncp-toolkit@0.5.39-beta.1

## 0.4.54-beta.0

### Patch Changes

- Auto-generated full public beta release batch.

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
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/service
  - nextclaw

- Updated dependencies [d82790a]
  - @nextclaw/ncp@0.6.4-beta.0
  - @nextclaw/ncp-toolkit@0.5.39-beta.0

## 0.4.53

### Patch Changes

- Auto-generated full public beta release batch.

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
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/service
  - nextclaw

- Updated dependencies
  - @nextclaw/ncp@0.6.3
  - @nextclaw/ncp-toolkit@0.5.38

## 0.4.52

### Patch Changes

- Auto-generated full public beta release batch.

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
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
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
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared

- Updated dependencies
  - @nextclaw/ncp@0.6.2
  - @nextclaw/ncp-toolkit@0.5.37

## 0.4.51

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

- Updated dependencies
- Updated dependencies [36c4e56]
  - @nextclaw/ncp-toolkit@0.5.36
  - @nextclaw/ncp@0.6.1

## 0.4.50

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

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
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
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - nextclaw

- Updated dependencies [1ed5aff]
- Updated dependencies
- Updated dependencies [cc024b3]
  - @nextclaw/ncp-toolkit@0.5.35
  - @nextclaw/ncp@0.6.0

## 0.4.50-beta.0

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

- Updated dependencies
- Updated dependencies [cc024b3]
  - @nextclaw/ncp-toolkit@0.5.35-beta.0
  - @nextclaw/ncp@0.6.0-beta.0

## 0.4.49

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

- Updated dependencies [14c5730]
- Updated dependencies [43da21a]
  - @nextclaw/ncp@0.5.29
  - @nextclaw/ncp-toolkit@0.5.34

## 0.4.49-beta.1

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

- Updated dependencies
  - @nextclaw/ncp@0.5.29-beta.1
  - @nextclaw/ncp-toolkit@0.5.34-beta.1

## 0.4.49-beta.0

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

- Updated dependencies
  - @nextclaw/ncp@0.5.29-beta.0
  - @nextclaw/ncp-toolkit@0.5.34-beta.0

## 0.4.48

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

- Updated dependencies
  - @nextclaw/ncp@0.5.28
  - @nextclaw/ncp-toolkit@0.5.33

## 0.4.47

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
  - @nextclaw/ncp@0.5.27
  - @nextclaw/ncp-toolkit@0.5.32

## 0.4.46

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
  - @nextclaw/ncp@0.5.26
  - @nextclaw/ncp-toolkit@0.5.31

## 0.4.45

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
  - @nextclaw/ncp@0.5.25
  - @nextclaw/ncp-toolkit@0.5.30

## 0.4.44

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
  - @nextclaw/ncp@0.5.24
  - @nextclaw/ncp-toolkit@0.5.29

## 0.4.43

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
  - @nextclaw/ncp@0.5.23
  - @nextclaw/ncp-toolkit@0.5.28

## 0.4.42

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
  - @nextclaw/ncp@0.5.22
  - @nextclaw/ncp-toolkit@0.5.27

## 0.4.41

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
  - @nextclaw/ncp@0.5.21
  - @nextclaw/ncp-toolkit@0.5.26

## 0.4.40

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
  - @nextclaw/ncp@0.5.20
  - @nextclaw/ncp-toolkit@0.5.25

## 0.4.39

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
  - @nextclaw/ncp@0.5.19
  - @nextclaw/ncp-toolkit@0.5.24

## 0.4.38

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
  - @nextclaw/ncp@0.5.18
  - @nextclaw/ncp-toolkit@0.5.23

## 0.4.38-beta.7

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
  - @nextclaw/ncp@0.5.18-beta.7
  - @nextclaw/ncp-toolkit@0.5.23-beta.7

## 0.4.38-beta.6

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
  - @nextclaw/ncp@0.5.18-beta.6
  - @nextclaw/ncp-toolkit@0.5.23-beta.6

## 0.4.38-beta.5

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
  - @nextclaw/ncp@0.5.18-beta.5
  - @nextclaw/ncp-toolkit@0.5.23-beta.5

## 0.4.38-beta.4

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
  - @nextclaw/ncp@0.5.18-beta.4
  - @nextclaw/ncp-toolkit@0.5.23-beta.4

## 0.4.38-beta.3

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
  - @nextclaw/ncp@0.5.18-beta.3
  - @nextclaw/ncp-toolkit@0.5.23-beta.3

## 0.4.38-beta.2

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
  - @nextclaw/ncp@0.5.18-beta.2
  - @nextclaw/ncp-toolkit@0.5.23-beta.2

## 0.4.38-beta.1

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
  - @nextclaw/ncp@0.5.18-beta.1
  - @nextclaw/ncp-toolkit@0.5.23-beta.1

## 0.4.38-beta.0

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
  - @nextclaw/ncp@0.5.18-beta.0
  - @nextclaw/ncp-toolkit@0.5.23-beta.0

## 0.4.37

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
  - @nextclaw/ncp@0.5.17
  - @nextclaw/ncp-toolkit@0.5.22

## 0.4.36

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
  - @nextclaw/ncp@0.5.16
  - @nextclaw/ncp-toolkit@0.5.21

## 0.4.35

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
  - @nextclaw/ncp@0.5.15
  - @nextclaw/ncp-toolkit@0.5.20

## 0.4.34

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
  - @nextclaw/ncp@0.5.14
  - @nextclaw/ncp-toolkit@0.5.19

## 0.4.33

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
  - @nextclaw/ncp@0.5.13
  - @nextclaw/ncp-toolkit@0.5.18

## 0.4.32

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
  - @nextclaw/ncp@0.5.12
  - @nextclaw/ncp-toolkit@0.5.17

## 0.4.31

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
  - @nextclaw/ncp@0.5.11
  - @nextclaw/ncp-toolkit@0.5.16

## 0.4.30

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
  - @nextclaw/ncp@0.5.10
  - @nextclaw/ncp-toolkit@0.5.15

## 0.4.29

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
  - @nextclaw/ncp@0.5.9
  - @nextclaw/ncp-toolkit@0.5.14

## 0.4.28

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
  - @nextclaw/ncp@0.5.8
  - @nextclaw/ncp-toolkit@0.5.13

## 0.4.27

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
  - @nextclaw/ncp@0.5.7
  - @nextclaw/ncp-toolkit@0.5.12

## 0.4.26

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
  - @nextclaw/ncp-toolkit@0.5.11

## 0.4.26-beta.5

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
  - @nextclaw/ncp-toolkit@0.5.11-beta.4

## 0.4.26-beta.4

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
  - @nextclaw/ncp-toolkit@0.5.11-beta.3

## 0.4.26-beta.3

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
  - @nextclaw/ncp-toolkit@0.5.11-beta.2

## 0.4.26-beta.2

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
  - @nextclaw/ncp-toolkit@0.5.11-beta.1

## 0.4.26-beta.1

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
  - @nextclaw/ncp-toolkit@0.5.11-beta.0

## 0.4.26-beta.0

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.5.6-beta.0
  - @nextclaw/ncp-toolkit@0.5.11-beta.0

## 0.4.25

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
  - @nextclaw/ncp-toolkit@0.5.10

## 0.4.24

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

- Updated dependencies
  - @nextclaw/ncp@0.5.4
  - @nextclaw/ncp-toolkit@0.5.9

## 0.4.23

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

- Updated dependencies
  - @nextclaw/ncp@0.5.3
  - @nextclaw/ncp-toolkit@0.5.8

## 0.4.22

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.5.2
  - @nextclaw/ncp-toolkit@0.5.7

## 0.4.21

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

- Updated dependencies
  - @nextclaw/ncp@0.5.1
  - @nextclaw/ncp-toolkit@0.5.6

## 0.4.20

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

- Updated dependencies
  - @nextclaw/ncp-toolkit@0.5.5

## 0.4.19

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp-toolkit@0.5.4

## 0.4.18

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

- Updated dependencies
  - @nextclaw/ncp-toolkit@0.5.3

## 0.4.17

### Patch Changes

- Auto-generated patch release for packages with meaningful drift after their latest version commit.

  Packages:
  - @nextclaw/agent-chat
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

- Updated dependencies
  - @nextclaw/ncp-toolkit@0.5.2

## 0.4.16

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp-toolkit@0.5.1

## 0.4.15

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.5.0
  - @nextclaw/ncp-toolkit@0.5.0

## 0.4.14

### Patch Changes

- Republish the packages changed after the April 3 unified release batch so the published tarballs match the current workspace, including the new NCP session request and session spawn flow.
- Updated dependencies
  - @nextclaw/ncp-toolkit@0.4.17

## 0.4.13

### Patch Changes

- Publish the full April 2 to April 3 public package drift as one aligned patch batch.

  This release includes the session-scoped project context chain, project-aware skill loading, chat header project interactions, server path picker improvements, file operation card rendering refinements, and the aligned runtime or engine updates behind them.

  It also republishes the affected direct dependents so workspace dependency versions stay aligned for downstream installs.

- Updated dependencies
  - @nextclaw/ncp-toolkit@0.4.16

## 0.4.12

### Patch Changes

- Publish the remaining unpublished workspace drift from March 31 and April 1 as one aligned patch batch, including the native file preview pipeline updates, structured terminal tool result rendering, and the recent tool card UX refinements.
- Updated dependencies
  - @nextclaw/ncp@0.4.6
  - @nextclaw/ncp-toolkit@0.4.15

## 0.4.11

### Patch Changes

- f65c1f5: Republish Nextclaw UI with upstream frontend dependency chain.
- Updated dependencies [f65c1f5]
  - @nextclaw/ncp@0.4.5
  - @nextclaw/ncp-toolkit@0.4.14

## 0.4.10

### Patch Changes

- Publish the remaining unpublished drift from today's commits as one unified patch batch.

  This batch includes the chat skill token rendering and recent-skill ordering updates, the enter-to-send guard while a chat run is active, and the tightened tool argument validation across the NCP/runtime bridge. It also republishes the dependent public package chain so workspace dependency versions stay aligned for downstream installs.

- Updated dependencies
  - @nextclaw/ncp@0.4.4
  - @nextclaw/ncp-toolkit@0.4.13

## 0.4.9

### Patch Changes

- 9a336f2: Publish the remaining public-package drift from today's commits as one unified patch batch, including the channel enable/disable fixes, declarative channel form layout, subagent follow-up/runtime fixes, and the landing asset updates that landed after the last tagged release.
- Updated dependencies [9a336f2]
  - @nextclaw/ncp@0.4.3
  - @nextclaw/ncp-toolkit@0.4.12

## 0.4.8

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp-toolkit@0.4.11

## 0.4.7

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp-toolkit@0.4.10

## 0.4.6

### Patch Changes

- Publish the NCP subagent live follow-up fixes, including spawn tool result updates, parent-agent realtime continuation, and the aligned frontend chat visibility changes.
- Updated dependencies
  - @nextclaw/ncp@0.4.2
  - @nextclaw/ncp-toolkit@0.4.9

## 0.4.5

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp-toolkit@0.4.8

## 0.4.4

### Patch Changes

- Republish Nextclaw UI with upstream frontend dependency chain.
- Updated dependencies
  - @nextclaw/ncp@0.4.1
  - @nextclaw/ncp-toolkit@0.4.7

## 0.4.3

### Patch Changes

- f15df6a: Publish the pending NCP realtime sync batch together with the new built-in cross-channel messaging skill and Weixin self-notify route hints.

  This release keeps the product lightweight: the AI reuses the existing reply, `sessions_send`, and `message` primitives, and a fresh UI or NCP session can proactively notify the saved Weixin route without adding a separate notification abstraction.

- Updated dependencies [f15df6a]
  - @nextclaw/ncp-toolkit@0.4.6

## 0.4.2

### Patch Changes

- Updated dependencies [1ce3d58]
  - @nextclaw/ncp-toolkit@0.4.5

## 0.4.1

### Patch Changes

- Raise the frontend NCP attachment upload limit from 10MB to 200MB.

## 0.4.0

### Minor Changes

- Unify the NCP file pipeline around an asset store abstraction with `put`, `export`, and `stat`.

  This release removes default prompt-time file content injection, replaces `attachmentUri` with `assetUri`, adds `asset_put` / `asset_export` / `asset_stat`, and updates the UI/server upload flow to return and render managed assets directly.

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.4.0
  - @nextclaw/ncp-toolkit@0.4.4

## 0.3.6

### Patch Changes

- Ship the full set of current unreleased workspace package changes in one release batch, including the server/CLI updates already sitting in the working tree and the previously committed public package drift that has not been published yet. Republish the NCP agent runtime export surface so NextClaw can resolve `LocalAttachmentStore` after update, and add a release guard that blocks shipping public workspace dependents when a package has drifted past its published tag without a pending changeset.
- Updated dependencies
  - @nextclaw/ncp@0.3.3
  - @nextclaw/ncp-toolkit@0.4.3

## 0.3.5

### Patch Changes

- ee69ef6: Keep pasted and uploaded NCP images in composer order end to end: preserve caret placement, retain image visibility across follow-up turns without hidden model switching, and serialize mixed text/image message parts in the same order users authored them.

## 0.3.4

### Patch Changes

- Add NCP image attachment support across the shared chat composer, NCP runtime, React bindings, and bundled NextClaw UI so pasted or uploaded images are sent as NCP file parts and rendered inline. Also keep the required CLI/server/mcp release group in sync for the bundled NextClaw distribution.
  - @nextclaw/ncp-toolkit@0.4.2

## 0.3.3

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.
- Updated dependencies
  - @nextclaw/ncp@0.3.2
  - @nextclaw/ncp-toolkit@0.4.2

## 0.3.2

### Patch Changes

- Republish the NCP-linked package set so published consumers resolve the
  latest NCP protocol/runtime exports used by the current NextClaw CLI build.
- Updated dependencies
  - @nextclaw/ncp@0.3.1
  - @nextclaw/ncp-toolkit@0.4.1

## 0.3.1

### Patch Changes

- Unify the latest NCP native chat chain improvements into a single release batch:
  - fix NCP streaming/state-manager promotion so tool-first assistant streams do not lose parts
  - align session type handling to stay generic outside the built-in native type
  - remove runtime-specific default-model branching and use a generic session-scoped fallback strategy
  - ship the latest NextClaw UI, server, and CLI cutover fixes together
  - republish direct dependents of `@nextclaw/ncp-toolkit` for version alignment

- Updated dependencies
  - @nextclaw/ncp-toolkit@0.4.0

## 0.3.0

### Minor Changes

- Unify the latest NCP native chat chain, runtime capability assembly, chat UI alignment, stream/reasoning/tool fixes, and marketplace metadata publishing into a single minor release.

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.3.0
  - @nextclaw/ncp-toolkit@0.3.0

## 0.2.0

### Minor Changes

- Refactor the NCP agent backend stack from run-centric semantics to session-centric live execution.
  - Replace run-based stream and abort payloads with `sessionId`-based live session APIs.
  - Rename the manifest capability from `supportsRunStream` to `supportsLiveSessionStream`.
  - Remove run-store/controller abstractions from `@nextclaw/ncp-toolkit` and move active execution ownership into the live session registry.
  - Align the HTTP client/server transports and React hooks with live session streaming.
  - Update `ncp-demo` to use the session-centric backend, add a `sleep` tool, and remove mock LLM mode.

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.2.0
  - @nextclaw/ncp-toolkit@0.2.0
