---
"@nextclaw/server": patch
"@nextclaw/ncp-react": patch
"@nextclaw/ui": patch
"nextclaw": patch
---

重载工具调用会话现在会先显示受预算保护的最近内容，再自动补齐近期上下文，并减少重复 hydrate 与首屏资源串行等待；发布包同时内置经过校验的预压缩 UI 资产，外部静态服务器升级后不再丢失快速传输路径。真实 VPS 已登录热刷新中位约 1.13 秒，同时保留完整工具详情和更早历史。
