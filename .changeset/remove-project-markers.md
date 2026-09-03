---
"@nextclaw/kernel": minor
"@nextclaw/server": minor
"@nextclaw/client-sdk": minor
"@nextclaw/core": patch
"@nextclaw/service": patch
"@nextclaw/ui": patch
---

完全移除旧项目 Marker 观测机制。项目观测不再读取会话正文，也不再解析、生成或投影 `nextclaw.project/v1`；工作项继续统一使用 Project Work API，历史会话文本不会再产生 Marker 诊断。

同时简化项目工作项列表与看板的状态分组，移除外层卡片边框和底色，只保留工作项自身的边界与轻量分组标题。
