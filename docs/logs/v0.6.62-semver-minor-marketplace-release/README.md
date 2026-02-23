# v0.6.62-semver-minor-marketplace-release

## 迭代完成说明（改了什么）

本次迭代不新增功能代码，目标是修正发布语义：

1. 将上一轮 Marketplace 相关能力从 patch 级别提升为 **minor** 级别发布。
2. 使用 changeset 为以下包执行 minor 升版：
- `nextclaw`
- `@nextclaw/server`
- `@nextclaw/ui`
3. 保持联动发布一致性，避免“功能已明显增强但版本仍表现为修复级”带来的认知偏差。

## 测试 / 验证 / 验收方式

### 工程验证（发布流程内执行）

- `pnpm build`
- `pnpm lint`
- `pnpm tsc`

说明：由 `pnpm release:publish` 内置串行执行，确保升版前后的构建、静态检查、类型检查可通过。

### 冒烟验证（发布后）

在隔离目录（`NEXTCLAW_HOME=/tmp/...`）完成 API 冒烟：

1. `GET /api/marketplace/items`
2. `GET /api/marketplace/recommendations`
3. `POST /api/marketplace/install`（临时本地插件包）
4. `GET /api/marketplace/installed`（确认安装状态可见）

验收标准：查询、推荐、安装、已安装状态四条链路均可用。

## 发布 / 部署方式

1. `pnpm release:version`
2. `pnpm release:publish`

发布产物：
- NPM 包（`nextclaw` / `@nextclaw/server` / `@nextclaw/ui`）
- 对应 git tags

## 用户/产品视角验收步骤

1. 升级到最新发布版本。
2. 启动 UI 并打开 `/marketplace`。
3. 验证：
- 能搜索与浏览推荐
- 已安装项显示 `Installed`
- 安装后状态自动刷新并在 `Installed` 视图可见
4. 若以上成立，则版本语义与功能体量一致，验收通过。
