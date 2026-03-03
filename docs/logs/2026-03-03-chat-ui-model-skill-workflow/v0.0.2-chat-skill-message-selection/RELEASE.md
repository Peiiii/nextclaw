# v0.0.2 Release

## 发布/部署方式

1. 确保工作区验证通过（见 [VALIDATION](./VALIDATION.md)）。
2. 按项目发布流程执行版本管理与发布（changeset/version/publish）。
3. 如仅 UI 改动场景，可使用 `/release-frontend` 闭环发布。

## 变更类型判定

- 本次包含 UI + Core 运行时行为变更。
- 不涉及数据库/后端 schema 迁移，因此 remote migration 不适用。

## 发布后检查

- 对聊天页面执行一次线上/预发冒烟，确认：
  - 技能多选可见且发送后清空。
  - `requested_skills` 生效（回复可观察到技能指令上下文变化）。
  - 多工具连续调用展示为工作流折叠卡。
