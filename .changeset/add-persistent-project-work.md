---
"nextclaw": minor
"@nextclaw/kernel": minor
"@nextclaw/server": minor
"@nextclaw/client-sdk": minor
"@nextclaw/service": minor
"@nextclaw/ui": minor
---

新增由 NextClaw 独立持久化的项目工作项：支持自定义状态、完整状态变化历史、关注标记、软删除恢复和项目内产物关联，不再依赖扫描会话历史或向项目目录写入追踪文件。

项目内会话会按条件获得工作项工具；CLI 提供同一套 CRUD、状态与产物入口并强制指定项目 ID。项目主页的概览、列表和看板会响应实时变更，所有工作项统一在右侧详情抽屉中打开，同时保留原有产物、Skills、工作约定与项目会话能力。
