# v0.14.110-nextclaw-platform-resend-production-preflight

## 迭代完成说明

- 将生产 worker 配置切到 `Resend` 邮件提供方：
  - `PLATFORM_AUTH_EMAIL_PROVIDER = "resend"`
  - `PLATFORM_AUTH_EMAIL_FROM = "NextClaw <no-reply@mail.nextclaw.io>"`
- 远程执行 D1 migration：
  - `0008_platform_email_auth_codes.sql`
- 生产部署 `nextclaw-provider-gateway-api` 新版本，包含：
  - 邮箱验证码发送/验证
  - browser auth 邮箱验证码授权
  - 自动建号
  - 生产级 `AUTH_TOKEN_SECRET`
- 对线上域名与活体接口做了真实验证，确认当前唯一阻塞不在代码，而在 Resend 域名验证。

## 测试/验证/验收方式

- 线上健康检查：
  - `GET https://ai-gateway-api.nextclaw.io/health`
  - 结果：通过
- 线上 browser auth 起始接口：
  - `POST https://ai-gateway-api.nextclaw.io/platform/auth/browser/start`
  - 结果：通过，返回 `sessionId` / `verificationUri`
- 线上验证码发送接口：
  - `POST https://ai-gateway-api.nextclaw.io/platform/auth/email/send-code`
  - 结果：失败，Resend 返回 `403`
  - 原因：`mail.nextclaw.io` 仍为 `pending`
- Resend 域名状态检查：
  - 域名：`mail.nextclaw.io`
  - 状态：`pending`
  - 当前待完成 DNS 记录：
    - `resend._domainkey.mail.nextclaw.io` TXT
    - `send.mail.nextclaw.io` MX
    - `send.mail.nextclaw.io` TXT

## 发布/部署方式

- 已完成：
  1. 远程 migration
  2. 生产 worker deploy
- 暂未完成：
  - `NextClaw Platform` 前端生产发布
- 暂停前端发布的原因：
  - 新前端已切到邮箱验证码登录
  - 当前 Resend 域名未完成验证，真实验证码无法发出
  - 若此时发布前端，会把线上用户入口切到不可登录状态

## 用户/产品视角的验收步骤

1. 先在 DNS 服务商完成 `mail.nextclaw.io` 的 3 条 Resend 记录。
2. 等 Resend 后台把域名状态从 `pending` 变为 `verified`。
3. 域名 verified 后，重新执行线上验证码发送验证。
4. 验证通过后，再发布 `NextClaw Platform` 前端。
5. 最终从用户视角验收：
   - 输入邮箱
   - 收到验证码
   - 登录进入平台
   - 看到设备列表
   - 点击打开设备
