# 发布 / 部署方式

- 本次为 runtime 稳定性修复（Core 层），发布时按项目既有 npm 流程执行：
  - `pnpm changeset`
  - `pnpm release:version`
  - `pnpm release:publish`
- 不涉及数据库/后端 schema 变更，无 migration。
