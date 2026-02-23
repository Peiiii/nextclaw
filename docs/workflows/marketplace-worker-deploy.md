# Marketplace Worker Manual Deploy

适用范围：`workers/marketplace-api` 只读 API 服务。

## 部署原则

- 禁止通过 GitHub Actions 自动部署 Worker。
- 仅允许本地手动部署（由交付 owner 或当前执行助手触发）。

## 部署前检查

```bash
pnpm -C workers/marketplace-api build
pnpm -C workers/marketplace-api lint
pnpm -C workers/marketplace-api tsc
```

## 手动部署命令

```bash
pnpm -C workers/marketplace-api run deploy
```

## 凭证要求

使用本地 `wrangler` 登录态或环境变量（如 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`）。

## 冒烟检查

部署完成后至少验证：

```bash
curl -sS https://marketplace-api.nextclaw.io/health
curl -sS 'https://marketplace-api.nextclaw.io/api/v1/items?page=1&pageSize=5'
```

预期：
- `/health` 返回 `ok: true`
- `/api/v1/items` 返回 `ok: true` 且 `data.items` 非空
