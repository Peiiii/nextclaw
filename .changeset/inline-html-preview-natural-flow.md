---
"@nextclaw/agent-chat-ui": patch
"@nextclaw/core": patch
"@nextclaw/kernel": patch
"@nextclaw/ui": patch
---

聊天中的 HTML 预览不再显示文件名和卡片边框，使用与图片一致的轻微圆角，根据页面内容自动调整高度，并仅在悬停时于预览外部正上方居中提供侧栏预览与源码入口。Agent 也会在结果适合可视化时主动选择 Markdown、图表、图片或内联 HTML；内联页面保持单一焦点、自然高度和无嵌套外卡的简洁展示，完成后只保留可视结果，不再重复显示前后的文字复述。
