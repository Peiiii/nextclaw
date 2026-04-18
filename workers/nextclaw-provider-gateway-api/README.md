# NextClaw Provider Gateway API (Serious Platform MVP)

Cloudflare Worker + Hono + D1。

核心能力：
- 用户登录后才能调用 `/v1/chat/completions`
- `NextClaw Account` 正式账号模型：
  - 登录：邮箱 + 密码
  - 注册：邮箱验证码验证后设置密码
  - 忘记密码：邮箱验证码验证后重置密码
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
- 若前端已切到“注册/重置密码验证码”模型，则生产必须先配置 `PLATFORM_AUTH_EMAIL_PROVIDER=resend`、`PLATFORM_AUTH_EMAIL_FROM`、`RESEND_API_KEY`，否则用户无法完成注册和密码重置。
- 当前线上还必须确保 `mail.nextclaw.io` 在 Resend 中变为 `verified`，否则验证码发送接口会返回 `EMAIL_DELIVERY_FAILED`。

## 4. 主要接口

### 用户认证
- `POST /platform/auth/login`
- `POST /platform/auth/register/send-code`
- `POST /platform/auth/register/complete`
- `POST /platform/auth/password/reset/send-code`
- `POST /platform/auth/password/reset/complete`
- `GET /platform/auth/me`
- `POST /platform/auth/browser/start`
- `POST /platform/auth/browser/poll`
- `GET /platform/auth/browser`
- `POST /platform/auth/browser/login`
- `POST /platform/auth/browser/register/send-code`
- `POST /platform/auth/browser/register/complete`
- `POST /platform/auth/browser/reset-password/send-code`
- `POST /platform/auth/browser/reset-password/complete`

### 用户账单
- `GET /platform/billing/overview`
- `GET /platform/billing/ledger`
- `GET /platform/billing/recharge-intents`
- `POST /platform/billing/recharge-intents`

### Remote Access
- `GET /platform/remote/instances`
- `GET /platform/remote/quota`
- `POST /platform/remote/instances/register`
- `POST /platform/remote/instances/:instanceId/open`
- `POST /platform/remote/instances/:instanceId/archive`
- `POST /platform/remote/instances/:instanceId/unarchive`
- `POST /platform/remote/instances/:instanceId/delete`
- `GET /platform/remote/instances/:instanceId/shares`
- `POST /platform/remote/instances/:instanceId/shares`
- `POST /platform/remote/shares/:grantId/revoke`
- `GET /platform/remote/devices`
- `POST /platform/remote/devices/register`
- `POST /platform/remote/devices/:deviceId/open`
- `POST /platform/share/:grantToken/open`
- `GET /platform/remote/open`
- `GET /platform/remote/connect`

### 管理后台
- `GET /platform/admin/overview`
- `GET /platform/admin/remote/quota`
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
> - `platform/auth/browser/*` 为本地 NextClaw Remote Access 提供浏览器授权页，支持密码登录、验证码注册和验证码重置密码，并把结果回传给本地设备。
> - 平台账号模型已收口为“密码登录 + 验证码注册/重置密码”，不再支持“验证码即登录/自动建号”。
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

## 7. 管理员开通

平台管理后台与普通平台账号共用同一套邮箱密码登录体系，不存在独立的“后台默认密码”。

当前仓库提供了一个最小正式运维入口，用于把现有平台账号提升为管理员：

```bash
pnpm platform:admin:grant -- --email you@example.com --remote
```

本地环境：

```bash
pnpm platform:admin:grant -- --email you@example.com --local
```

注意：

- 该命令只提升已存在账号，不负责创建账号。
- 生产环境默认应先在用户站完成注册，再执行提权。
- 忘记密码应走统一的平台账号重置流程，而不是单独维护一套后台密码。
- marketplace 审核后台链路默认优先透传当前管理员登录态；`MARKETPLACE_ADMIN_TOKEN` 仍可保留给机器间调用，但不再是 admin 页面可用性的单点依赖。
