---
"@nextclaw/kernel": minor
"@nextclaw/server": minor
"@nextclaw/client-sdk": minor
"@nextclaw/core": patch
"@nextclaw/service": patch
"@nextclaw/ui": patch
"nextclaw": patch
---

完全移除旧项目 Marker 与项目观测机制。Projects 不再读取 `.nextclaw/project.yaml`、扫描项目文件或全部历史会话，也不再提供 observation API 与 `nextclaw projects observe`；历史配置不会再产生 Marker 或未知字段诊断。

项目材料改为零配置的单一来源：产物只展示 Project Work 工作项显式关联的文件，支持去重、分页与搜索；Skills 固定读取 `.agents/skills`；工作约定固定读取项目根目录 `AGENTS.md`。

同时简化项目工作项列表与看板的状态分组，移除外层卡片边框和底色，只保留工作项自身的边界与轻量分组标题。
