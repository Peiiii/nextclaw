---
"@nextclaw/kernel": patch
"@nextclaw/nextclaw-narp-stdio-runtime-wrapper": patch
"@nextclaw/nextclaw-ncp-runtime-stdio-client": patch
---

修复通过 NARP stdio 运行时发送图片时附件被降级为纯文本的问题，保留附件顺序和文件元数据，并在本地资源无法解析时返回明确错误。
