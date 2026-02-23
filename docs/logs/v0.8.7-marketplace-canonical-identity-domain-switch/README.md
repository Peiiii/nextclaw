# v0.8.7-marketplace-canonical-identity-domain-switch

## 迭代完成说明（改了什么）

本次迭代同时完成两项改动：

1. **Marketplace/Installed 插件实体统一（根源修复）**
- 变更文件：`packages/nextclaw-server/src/ui/router.ts`
- 新增插件 canonical spec 规则：
  - `builtin-channel-<slug>` 统一映射到 `@nextclaw/channel-plugin-<slug>`
  - 带版本 npm spec（如 `@nextclaw/channel-plugin-telegram@0.1.2`）统一归一到包名 `@nextclaw/channel-plugin-telegram`
- `collectMarketplaceInstalledView` 输出前按 canonical spec 聚合去重，避免“同一插件显示为两个实体”。

2. **Marketplace Worker 默认域名切换**
- 代码默认 API 域名改为：`https://marketplace-api.nextclaw.io`
- 部署工作流文档冒烟地址同步更新为新域名。

## 测试 / 验证 / 验收方式

### 工程验证（本次执行）

- `pnpm build`
- `pnpm lint`
- `pnpm tsc`

### 冒烟验证（本次执行）

- 启动隔离环境服务：
  - `NEXTCLAW_HOME=/tmp/... pnpm -C packages/nextclaw dev:build serve --ui-port <port>`
- API 验证：
  - `curl -sS http://127.0.0.1:<port>/api/marketplace/installed`
  - 观察点：插件记录中的 canonical spec 不重复，且使用 `@nextclaw/channel-plugin-*`。
- Worker 域名验证：
  - `curl -sS https://marketplace-api.nextclaw.io/health`

## 发布 / 部署方式

本次改动涉及 `@nextclaw/server`（后端 API 聚合逻辑）和其直接依赖发布链：

1. 执行版本提升与发布：
- `pnpm release:version`
- `pnpm release:publish`

2. 发布闭环说明：
- 远程 migration：不适用（无数据库/后端 schema migration）
- 线上冒烟：使用已绑定域名 `https://marketplace-api.nextclaw.io` 与本地 `nextclaw` UI API 进行接口验证

## 用户/产品视角的验收步骤

1. 打开 UI Marketplace 的 `All` 页面，查看某个 channel 插件（如 telegram）状态。
2. 切换到 `Installed` 页面，确认同一插件只展示一个实体。
3. 对该插件执行 `Enable/Disable`（若可用）并刷新确认状态一致。
4. 验收通过标准：不再出现“Marketplace 未安装但 Installed 已有 builtin 同物双实体”的认知冲突。

## 本次执行结果（2026-02-23）

- 工程验证：`pnpm build`、`pnpm lint`、`pnpm tsc` 全部通过（存在历史 lint warning，无 error）。
- 冒烟验证（隔离目录）：
  - `NEXTCLAW_HOME=/tmp/nextclaw-market-smoke-... pnpm -C packages/nextclaw dev:build serve --ui-port 18941`
  - `curl -sS http://127.0.0.1:18941/api/marketplace/installed`
  - `curl -sS http://127.0.0.1:18941/api/marketplace/installed | node -e '...duplicates check...'`
  - 结果：`plugin_records 10`、`unique_specs 10`、`duplicates none`
  - `curl -sS https://marketplace-api.nextclaw.io/health` 返回 `{"ok":true,...}`
- 发布结果：
  - 已发布 NPM：`nextclaw@0.8.3`、`@nextclaw/server@0.5.1`
  - 已打 tag：`nextclaw@0.8.3`、`@nextclaw/server@0.5.1`
