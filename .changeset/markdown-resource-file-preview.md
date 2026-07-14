---
"@nextclaw/agent-chat-ui": patch
"@nextclaw/client-sdk": patch
"@nextclaw/server": patch
"@nextclaw/ui": patch
---

修复 Markdown `file:` 链接的渲染与行列定位：文件保持真实行号，大文件会读取目标行附近的内容，并在源码预览中滚动到目标位置；同时让 `nextclaw-inline` 文件目标在消息中复用现有工作台预览能力展示 HTML、Markdown、代码、图片、媒体、PDF 与 Office 文件。
