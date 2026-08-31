---
"nextclaw": minor
"@nextclaw/kernel": minor
"@nextclaw/server": minor
"@nextclaw/client-sdk": minor
"@nextclaw/ui": minor
"@nextclaw/service": minor
---

新增 Projects 项目主页：通过项目配置、项目文件、会话 Marker 和项目 Skills 展示可追溯的工作项、产物、上下文、AI 运行状态、待关注事项与诊断。已有项目会话与旧版观测快照会保持可读。

新增 `client.projects.getObservation()`、`GET /api/projects/:projectId/observation` 和 `nextclaw projects observe`，三条入口复用同一份 Kernel 快照合同。项目 setup 经用户确认后会建立 `.nextclaw/project.yaml`、根 `AGENTS.md` 与项目内工作追踪 Skill；后续 AI 在每个工作节点开始前输出紧凑 Marker，项目页会在流式输出期间更新。不会新增项目任务数据库、特殊会话类型或运行时 Skill 注入。
