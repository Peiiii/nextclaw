---
"@nextclaw/bibo-hosted": patch
"@nextclaw/personal-agent-ui": patch
---

Bibo 中用户和助手的 Markdown 文件链接现在可打开该账号已保存的工作区文档，包括 `/data/workspace/...` 绝对路径、相对路径和本地 `file:` URI；越界或失效路径仍由服务端拒绝。收件箱内的文件链接在手机上直接打开对应文件。

统一对齐 NextClaw 的 Markdown 正文与各级标题比例、段落和列表间距，恢复混合任务列表的圆点标记，并让聊天、收件箱和文件预览使用同一排版。
