---
"@nextclaw/server": patch
"@nextclaw/ui": patch
"nextclaw": patch
---

新增实验性 UI 注入口：高阶用户和社区工具可以在 NextClaw 数据目录放置 `ui-inject.js`，刷新桌面端或浏览器页面后直接执行自定义界面脚本；删除文件并刷新即可恢复。Skill Marketplace 同步改进最近更新排序、目录刷新、总数表达和历史条目兼容，避免无限滚动末页因旧安装类型导致整页失败。该注入口不提供安全性、DOM 稳定性或跨版本兼容保证。
