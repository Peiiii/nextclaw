# Marketplace API Worker (D1 metadata + R2 assets)

Cloudflare Worker + Hono 的 Marketplace API：
- 元数据来源：Cloudflare D1
- Skill 文件资产来源：Cloudflare R2
- 不再依赖仓库内 JSON catalog

## API 路由

- 读接口（公开）：
  - `GET /api/v1/plugins/items`
  - `GET /api/v1/plugins/items/:slug`
  - `GET /api/v1/plugins/recommendations`
  - `GET /api/v1/skills/items`
  - `GET /api/v1/skills/items/:slug`
  - `GET /api/v1/skills/items/:slug/content`
  - `GET /api/v1/skills/items/:slug/files`
  - `GET /api/v1/skills/items/:slug/files/blob?path=<relative-path>`
  - `GET /api/v1/skills/recommendations`
- 管理接口（写）：
  - `POST /api/v1/admin/skills/upsert`

说明：

- plugin 与 skill 完全拆分。
- skill install kind 只允许 `builtin` / `marketplace`。
- plugin install kind 只允许 `npm`。

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
```

预期：
- `/health` 返回 `storage: "d1+r2"`。
- `skills/items` 里应包含历史技能（例如 `pdf/docx/pptx/xlsx/bird/cloudflare-deploy`）。
- `skills/items` 的 skill `install.kind` 只会是 `builtin` 或 `marketplace`（不应再出现 `git`）。

## 凭证与变量

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `MARKETPLACE_ADMIN_TOKEN`（可选；用于机器间或脚本化 admin 调用。未命中该 token 时，admin 路由也接受平台侧 `role=admin` 的 Bearer token）
