# Marketplace API Worker (D1 metadata + R2 assets)

Cloudflare Worker + Hono 的 Marketplace API：
- 元数据来源：Cloudflare D1
- Skill 文件资产来源：Cloudflare R2
- 不再依赖仓库内 JSON catalog

## API 路由

- 读接口（公开）：
  - `GET /api/v2/apps/items`（应用目录主链：cursor、全文搜索、服务端筛选）
  - `GET /api/v1/plugins/items`
  - `GET /api/v1/plugins/items/:slug`
  - `GET /api/v1/plugins/recommendations`
  - `GET /api/v1/skills/items`
  - `GET /api/v1/skills/scenes`
  - `GET /api/v1/skills/items/:slug`
  - `GET /api/v1/skills/items/:slug/content`
  - `GET /api/v1/skills/items/:slug/files`
  - `GET /api/v1/skills/items/:slug/files/blob?path=<relative-path>`
  - `GET /api/v1/skills/recommendations`
  - `GET /api/v1/apps/items`（旧客户端 page/pageSize 兼容接口）
  - `GET /api/v1/apps/items/:selector`
  - `GET /api/v1/apps/items/:selector/files`
  - `GET /api/v1/apps/items/:selector/files/blob?path=<relative-path>&sha256=<content-hash>`
  - `GET /api/v1/apps/items/:selector/bundles/:version?sha256=<content-hash>`
- 管理接口（写）：
  - `POST /api/v1/admin/skills/upsert`

说明：

- plugin 与 skill 完全拆分。
- skill install kind 只允许 `builtin` / `marketplace`。
- plugin install kind 只允许 `npm`。
- 应用目录新消费者必须使用 `/api/v2/apps/items`，不得通过 `pageSize=100` 拉全量目录后在客户端搜索。
- v2 列表默认返回 24 条、最多 50 条，不计算精确总数；使用 opaque `nextCursor` 继续读取。
- 公开目录、详情与 Registry metadata 返回 `ETag` 和 Edge 缓存指令；带 sha256 的资源 URL 是不可变内容地址。
- D1 read replication 在 Cloudflare 中启用后，v2 reader 会通过 `first-unconstrained` Session 自动读取就近副本。未启用时语义不变，只是仍读取主实例。

## 本地开发

```bash
pnpm -C workers/marketplace-api install
pnpm -C workers/marketplace-api dev
```

## D1/R2 初始化

1. 在 `wrangler.toml` 配置两个 D1 绑定 + 一个 R2 绑定：
   - `MARKETPLACE_SKILLS_DB`（技能）
   - `MARKETPLACE_PLUGINS_DB`（插件）
   - `MARKETPLACE_SKILLS_FILES`（技能文件对象存储）
2. 执行 migration：
   - 技能库包含 `0002_seed_legacy_skills_20260227.sql`（历史 skills-catalog 迁移）
   - 技能库新增 `0003_skill_files_r2_storage_20260312.sql`（文件资产迁移为 R2 元数据）
   - 插件库包含 `0002_seed_official_channel_plugins_20260310.sql`（仓库内官方渠道插件）

```bash
pnpm -C workers/marketplace-api db:migrate:local
# 或
pnpm -C workers/marketplace-api db:migrate:remote
```

说明：迁移按目录拆分，技能使用 `migrations/skills`，插件使用 `migrations/plugins`。
旧的根目录 migration 已废弃，不再被脚本调用。

## 质量检查

```bash
pnpm -C workers/marketplace-api build
pnpm -C workers/marketplace-api lint
pnpm -C workers/marketplace-api tsc
```

## 部署

```bash
pnpm -C workers/marketplace-api run deploy
```

## 部署后快速验收

```bash
curl -sS https://marketplace-api.nextclaw.io/health
curl -sS 'https://marketplace-api.nextclaw.io/api/v1/skills/items?page=1&pageSize=50'
curl -sS 'https://marketplace-api.nextclaw.io/api/v1/skills/scenes'
curl -sS 'https://apps-registry.nextclaw.io/api/v2/apps/items?limit=24&sort=featured'
```

预期：
- `/health` 返回 `storage: "d1+r2"`。
- `skills/items` 里应包含历史技能（例如 `pdf/docx/pptx/xlsx/bird/cloudflare-deploy`）。
- `skills/scenes` 返回场景列表与每个场景的 skill 数量。
- `skills/items` 的 skill `install.kind` 只会是 `builtin` 或 `marketplace`（不应再出现 `git`）。

## 凭证与变量

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `MARKETPLACE_ADMIN_TOKEN`（可选；用于机器间或脚本化 admin 调用。未命中该 token 时，admin 路由也接受平台侧 `role=admin` 的 Bearer token）
