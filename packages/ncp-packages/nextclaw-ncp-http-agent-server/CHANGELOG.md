# @nextclaw/ncp-http-agent-server

## 0.4.1

### Patch Changes

- 1cc5d4e: Use English defaults for backend, runtime, and protocol-generated session status and abort messages, and carry abort details through NCP events so localized UI can own translation instead of receiving hard-coded Chinese copy.
- Updated dependencies [1cc5d4e]
  - @nextclaw/ncp@0.7.1

## 0.4.0

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

## 0.3.48

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

## 0.3.48-beta.0

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

## 0.3.47

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

## 0.3.46

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

## 0.3.46-beta.1

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

## 0.3.46-beta.0

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

## 0.3.45

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

## 0.3.44

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

## 0.3.43

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

- Updated dependencies [36c4e56]
  - @nextclaw/ncp@0.6.1

## 0.3.42

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

- Updated dependencies
- Updated dependencies [cc024b3]
  - @nextclaw/ncp@0.6.0

## 0.3.42-beta.0

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

- Updated dependencies [cc024b3]
  - @nextclaw/ncp@0.6.0-beta.0

## 0.3.41

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

## 0.3.41-beta.1

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

## 0.3.41-beta.0

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

## 0.3.40

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

## 0.3.39

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

## 0.3.38

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

## 0.3.37

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

## 0.3.36

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

## 0.3.35

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

## 0.3.34

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

## 0.3.33

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

## 0.3.32

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

## 0.3.31

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

## 0.3.30

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

## 0.3.30-beta.7

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

## 0.3.30-beta.6

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

## 0.3.30-beta.5

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

## 0.3.30-beta.4

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

## 0.3.30-beta.3

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

## 0.3.30-beta.2

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

## 0.3.30-beta.1

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

## 0.3.30-beta.0

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

## 0.3.29

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

## 0.3.28

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

## 0.3.27

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

## 0.3.26

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

## 0.3.25

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

## 0.3.24

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

## 0.3.23

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

## 0.3.22

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

## 0.3.21

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

## 0.3.20

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

## 0.3.19

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

## 0.3.18

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

## 0.3.18-beta.5

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

## 0.3.18-beta.4

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

## 0.3.18-beta.3

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

## 0.3.18-beta.2

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

## 0.3.18-beta.1

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

## 0.3.18-beta.0

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.5.6-beta.0

## 0.3.17

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

## 0.3.16

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

## 0.3.15

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

## 0.3.14

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.5.2

## 0.3.13

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

## 0.3.12

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.5.0

## 0.3.11

### Patch Changes

- Republish the packages changed after the April 3 unified release batch so the published tarballs match the current workspace, including the new NCP session request and session spawn flow.

## 0.3.10

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.4.6

## 0.3.9

### Patch Changes

- Updated dependencies [f65c1f5]
  - @nextclaw/ncp@0.4.5

## 0.3.8

### Patch Changes

- Publish the remaining unpublished drift from today's commits as one unified patch batch.

  This batch includes the chat skill token rendering and recent-skill ordering updates, the enter-to-send guard while a chat run is active, and the tightened tool argument validation across the NCP/runtime bridge. It also republishes the dependent public package chain so workspace dependency versions stay aligned for downstream installs.

- Updated dependencies
  - @nextclaw/ncp@0.4.4

## 0.3.7

### Patch Changes

- 9a336f2: Publish the remaining public-package drift from today's commits as one unified patch batch, including the channel enable/disable fixes, declarative channel form layout, subagent follow-up/runtime fixes, and the landing asset updates that landed after the last tagged release.
- Updated dependencies [9a336f2]
  - @nextclaw/ncp@0.4.3

## 0.3.6

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.4.2

## 0.3.5

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.4.1

## 0.3.4

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.4.0

## 0.3.3

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.3.3

## 0.3.2

### Patch Changes

- Republish all public workspace packages with pnpm publish guards so released manifests no longer retain workspace:\* dependencies and future npm publish misuse is blocked before release.
- Updated dependencies
  - @nextclaw/ncp@0.3.2

## 0.3.1

### Patch Changes

- Republish the NCP-linked package set so published consumers resolve the
  latest NCP protocol/runtime exports used by the current NextClaw CLI build.
- Updated dependencies
  - @nextclaw/ncp@0.3.1

## 0.3.0

### Minor Changes

- Unify the latest NCP native chat chain, runtime capability assembly, chat UI alignment, stream/reasoning/tool fixes, and marketplace metadata publishing into a single minor release.

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp@0.3.0

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

## 0.1.1

### Patch Changes

- Expose the new NCP agent runtime/backend type exports and session delete API, and add the docs entry under Settings in the main chat sidebar.
- Updated dependencies
  - @nextclaw/ncp@0.1.1

## 0.1.0

- Initial package.
- Add HTTP/SSE route mount helpers for NCP agent events.
