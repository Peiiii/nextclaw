# NextClaw Provider Gateway API (Serious Platform MVP)

Cloudflare Worker + Hono + D1。

核心能力：
- 用户登录后才能调用 `/v1/chat/completions`
- `NextClaw Account` 邮箱验证码登录/注册一体化
- 双额度模型：
  - 用户个人免费额度（`free_limit_usd`）
  - 全平台总免费额度池（`global_free_limit_usd`）
- 支持充值（USD 直充，不引入 points/credits）
- 管理后台 API（用户、额度、充值审核、平台设置）

## 1. 初始化

```bash
pnpm -C workers/nextclaw-provider-gateway-api install
pnpm -C workers/nextclaw-provider-gateway-api db:migrate:local
```

远程环境：

```bash
pnpm -C workers/nextclaw-provider-gateway-api db:migrate:remote
```

## 2. 本地开发

```bash
pnpm -C workers/nextclaw-provider-gateway-api dev
```

## 3. 环境变量（`wrangler.toml`）

- `DASHSCOPE_API_KEY`：上游模型 API Key（secret）
- `AUTH_TOKEN_SECRET`：登录 token 签名密钥（生产至少 32 字符随机字符串）
- `PLATFORM_AUTH_EMAIL_PROVIDER`：邮件提供方。支持 `resend`、`console`
- `PLATFORM_AUTH_EMAIL_FROM`：发件邮箱（`resend` 模式必填）
- `RESEND_API_KEY`：Resend API Key（`resend` 模式必填，secret）
- `PLATFORM_AUTH_DEV_EXPOSE_CODE`：仅开发环境使用。为 `true` 时允许 `console` 模式并在响应里返回 `debugCode`
- `GLOBAL_FREE_USD_LIMIT`：总免费额度池（USD）
- `REQUEST_FLAT_USD_PER_REQUEST`：每次请求固定费用（USD，可选）

生产环境要求：
- 不要使用 `console` 邮件模式。
- 若前端已切到验证码登录，则生产必须先配置 `PLATFORM_AUTH_EMAIL_PROVIDER=resend`、`PLATFORM_AUTH_EMAIL_FROM`、`RESEND_API_KEY`，否则用户无法完成登录。
- 当前线上还必须确保 `mail.nextclaw.io` 在 Resend 中变为 `verified`，否则验证码发送接口会返回 `EMAIL_DELIVERY_FAILED`。

## 4. 主要接口

### 用户认证
- `POST /platform/auth/login`
- `POST /platform/auth/email/send-code`
- `POST /platform/auth/email/verify-code`
- `GET /platform/auth/me`
- `POST /platform/auth/browser/start`
- `POST /platform/auth/browser/poll`
- `GET /platform/auth/browser`
- `POST /platform/auth/browser/send-code`
- `POST /platform/auth/browser/verify-code`

### 用户账单
- `GET /platform/billing/overview`
- `GET /platform/billing/ledger`
- `GET /platform/billing/recharge-intents`
- `POST /platform/billing/recharge-intents`

### 管理后台
- `GET /platform/admin/overview`
- `GET /platform/admin/users`
- `PATCH /platform/admin/users/:userId`
- `GET /platform/admin/recharge-intents`
- `POST /platform/admin/recharge-intents/:intentId/confirm`
- `POST /platform/admin/recharge-intents/:intentId/reject`
- `PATCH /platform/admin/settings`

### OpenAI 兼容
- `GET /v1/models`
- `GET /v1/usage`
- `POST /v1/chat/completions`

> 注意：
> - `platform/auth/browser/*` 为本地 NextClaw Remote Access 提供浏览器授权页，支持网页输入邮箱、收取验证码并把 token 回传给本地设备。
> - `platform/auth/email/*` 采用“登录/注册一体化”模型：如果邮箱首次使用，会在验证码验证成功后自动创建账号。
> - `/v1/*` 的 `Authorization: Bearer <token>` 必须是登录 token，不再支持匿名体验 key。
> - 登录接口具备基础防暴力破解能力：IP 失败限流 + 账号失败锁定。

## 5. 质量检查

```bash
pnpm -C workers/nextclaw-provider-gateway-api build
pnpm -C workers/nextclaw-provider-gateway-api lint
pnpm -C workers/nextclaw-provider-gateway-api tsc
```

## 6. 部署

```bash
pnpm -C workers/nextclaw-provider-gateway-api deploy
```
