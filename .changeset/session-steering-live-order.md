---
"@nextclaw/ncp": minor
"@nextclaw/ncp-toolkit": patch
"@nextclaw/ncp-react": patch
"@nextclaw/ui": patch
---

修复运行中插到下一步时消息短暂错序的问题。当前步骤的 AI 输出现在会稳定显示在插话消息之前，流式过程中、步骤完成后和刷新重载后的顺序保持一致。
