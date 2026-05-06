# @nextclaw/app-runtime

## 0.7.1-beta.0

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

## 0.6.0

### Minor Changes

- Add a `ts-http-lite` scaffold template for users who want a smaller official TypeScript WASI HTTP backend path, while keeping the default `ts-http` template for the Hono-based experience.

## 0.5.0

### Minor Changes

- Add TypeScript/Hono WASI HTTP app scaffolding, `napp doctor`, and `napp build --install` so ordinary users can create, build, preview, package, install, and run sandboxed NextClaw Apps through the app runtime skill.

## 0.4.0

### Minor Changes

- Add `napp publish`, official apps registry defaults, scaffolded marketplace metadata, and standalone NextClaw Apps distribution support.

## 0.3.0

### Minor Changes

- 5319511: Add configurable registry installs, app updates, explicit permission management, and npm-style registry configuration commands to `napp`.

## 0.2.0

### Minor Changes

- 8d70b86: Add `napp create` to scaffold a minimal runnable NextClaw micro app starter.
- 7f14a24: Prepare `@nextclaw/app-runtime` for public release with marketplace-facing CLI onboarding and packaging metadata.
