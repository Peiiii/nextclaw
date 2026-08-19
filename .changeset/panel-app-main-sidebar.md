---
"@nextclaw/kernel": patch
"@nextclaw/server": patch
"@nextclaw/client-sdk": patch
"@nextclaw/ui": minor
"nextclaw": minor
---

支持用户从 Panel Apps 列表或运行中 App 的更多菜单手动添加主侧栏入口，并在主内容区无重复宿主 Header 地完整使用。安装不会自动占用主侧栏；禁用后入口暂时隐藏并可在重新启用后恢复，卸载或删除则会清理入口。添加/移除即时反馈，打开 App 不再等待活动统计写盘；右侧 Panel App 移除重复的“返回应用”动作，统一遵循资源浏览器历史。
