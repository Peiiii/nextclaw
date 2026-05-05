# 上下文压缩与窗口展示锚点

- 当前目标：删除上下文窗口展示的跨层 callback 透传，把 `contextWindow` 收回到 session service / session view 边界。
- 明确非目标：不新增 endpoint，不扩展 NCP React hydration contract，不把实时窗口快照落盘为 session metadata。
- 冻结边界：压缩 checkpoint 仍是消息流里的特殊 timeline item；上下文窗口仍是实时计算型展示数据。
- 已完成进展：已撤掉 bridge 手写 proxy；`contextWindow` 改由 `getSession()` 当前会话视图返回；已撤掉 `listSessions()` 全量计算，避免会话列表加载变慢。
- 当前下一步：重跑 toolkit/nextclaw 类型、定向测试和 lint，确认列表路径不再批量计算。
- 锚点计数器：9/20
