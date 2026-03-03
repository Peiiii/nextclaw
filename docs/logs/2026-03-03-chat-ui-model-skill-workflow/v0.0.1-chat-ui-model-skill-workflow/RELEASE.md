# Release / Deploy

## 变更类型判断
- 类型：前端 UI + UI API 输出字段（非数据库变更）
- 结论：
  - 远程 migration：不适用（无数据库 schema 变更）
  - 后端部署：需要（`nextclaw-server` UI 路由返回结构有新增字段）
  - 前端部署：需要（`nextclaw-ui`）

## 建议发布步骤

1. 构建
```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server build
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui build
```

2. 部署后端服务（包含 `/api/marketplace/skills/installed` 新字段）
- 发布 `packages/nextclaw-server` 对应运行实例。

3. 部署前端静态资源
- 发布 `packages/nextclaw-ui/dist`。

4. 发布后线上冒烟
- 打开 `/chat` 页面。
- 验证模型选择器可见且可切换。
- 验证 skills 弹层描述会随语言切换（中文/英文）。
- 验证多工具调用时为串联式工作流展示。

## 回滚说明
- 前端回滚到上一个静态资源版本。
- 后端回滚到上一个 `nextclaw-server` 版本（移除新增字段不会影响旧前端兼容）。
