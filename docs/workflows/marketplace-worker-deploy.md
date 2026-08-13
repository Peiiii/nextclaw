# Marketplace Worker Deploy & Sync

适用范围：`workers/marketplace-api`（D1 metadata + R2 assets marketplace API）。

## 部署原则

- Marketplace 元数据来源是 Cloudflare D1，skill 文件资产来源是 Cloudflare R2（不再使用仓库内 JSON catalog）。
- 发布闭环包含：D1 migration -> build/lint/tsc -> worker deploy -> 线上 smoke。
- 手动部署作为兜底流程（CI 异常或紧急修复时使用）。

## 前置准备

1. `wrangler.toml` 已配置：
   - `MARKETPLACE_SKILLS_DB`
   - `MARKETPLACE_PLUGINS_DB`
   - `MARKETPLACE_SKILLS_FILES`
2. 已配置 Cloudflare 凭证：
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
3. 可选：配置 `MARKETPLACE_ADMIN_TOKEN`（开启 admin 写接口鉴权）。

## 部署前检查

```bash
pnpm -C workers/marketplace-api db:migrate:remote
pnpm -C workers/marketplace-api build
pnpm -C workers/marketplace-api lint
pnpm -C workers/marketplace-api tsc
```

## 手动部署命令

```bash
pnpm -C workers/marketplace-api run deploy
```

## 冒烟检查

部署完成后至少验证：

```bash
curl -sS https://marketplace-api.nextclaw.io/health
curl -sS 'https://marketplace-api.nextclaw.io/api/v1/plugins/items?page=1&pageSize=5'
curl -sS 'https://marketplace-api.nextclaw.io/api/v1/skills/items?page=1&pageSize=5'
curl -sS 'https://apps-registry.nextclaw.io/api/v2/apps/items?limit=24&sort=featured'
```

预期：
- `/health` 返回 `ok: true` 且 `data.storage: "d1+r2"`
- `/api/v1/plugins/items` 返回 `ok: true` 且 `data.items` 非空
- `/api/v1/skills/items` 返回 `ok: true` 且 `data.items` 非空
- `/api/v1/skills/items` 的 skill `install.kind` 只允许 `builtin | marketplace`（若出现 `git` 说明仍是旧 worker）
- `/api/v1/skills/items` 中可见历史迁移条目（至少包含 `pdf/docx/pptx/xlsx/cloudflare-deploy`）
- `/api/v2/apps/items` 返回 `ok: true` 且 `data.items` 非空；新消费者以此 cursor 接口为主链
