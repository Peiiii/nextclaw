---
"@nextclaw/ncp": patch
"@nextclaw/kernel": patch
"@nextclaw/server": patch
"@nextclaw/client-sdk": patch
"@nextclaw/ui": patch
"@nextclaw/nextclaw-ncp-runtime-codex-sdk": patch
---

新增会话级手动上下文压缩命令，统一通过 Kernel runtime capability 调用 Native 压缩链路或 Codex `thread/compact/start`，并为不支持、会话忙碌和无可压缩历史提供明确反馈。
