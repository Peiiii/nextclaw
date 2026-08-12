---
"@nextclaw/shared": patch
"@nextclaw/agent-chat-ui": patch
"@nextclaw/kernel": patch
"@nextclaw/ui": patch
"@nextclaw/server": patch
"@nextclaw/client-sdk": patch
---

支持将文档浏览器中的文档、应用、Panel App 和网页标签添加到聊天。发送后仍可识别并重新打开对应资源，AI 也能获得当时的资源地址和页面信息。项目文件树现在会保留展开与滚动状态，刷新会覆盖全部展开目录，“全部折叠”可可靠生效，并通过低开销的按需文件监听自动反映可见目录变化。
