# 域名总表（内部）

> 非面向用户文档。用于运维/发布时统一查看 Nextclaw 当前线上域名。
>
> 最近校验时间：2026-03-08

## 0) 配置事实源

| 配置项 | 事实源文件 |
| --- | --- |
| Platform 用户站域名 | Cloudflare Pages 项目 `nextclaw-platform-console`（控制台） |
| Platform 管理站域名 | Cloudflare Pages 项目 `nextclaw-platform-admin`（控制台） |
| Platform API 域名 | `workers/nextclaw-provider-gateway-api/wrangler.toml` 的 `routes` |
| 前端生产 API Base | `apps/platform-console/.env.production`、`apps/platform-admin/.env.production` |
| 一键平台发布命令 | 根目录 `package.json` 的 `deploy:platform*` 脚本 |

## 1) 平台前端（Cloudflare Pages）

| 站点 | Pages 项目 | 业务域名 | Pages 默认域名 | 校验结果 |
| --- | --- | --- | --- | --- |
| 用户站 | `nextclaw-platform-console` | `https://platform.nextclaw.io` | `https://nextclaw-platform-console.pages.dev` | 200 / 200 |
| 管理后台 | `nextclaw-platform-admin` | `https://platform-admin.nextclaw.io` | `https://nextclaw-platform-admin.pages.dev` | 200 / 200 |
| 文档站 | `nextclaw-docs` | `https://docs.nextclaw.io` | `https://nextclaw-docs.pages.dev` | 200 / 200 |
| Landing | `nextclaw-landing` | `https://nextclaw.io`、`https://bibo.bot`、`https://openclaw-pro-max.com` | `https://nextclaw-landing.pages.dev` | `nextclaw.io`=200, `bibo.bot`=200, `openclaw-pro-max.com`=TLS 异常 |

## 2) API（Cloudflare Workers）

| 服务 | Worker 名称 | 业务域名 | workers.dev 默认域名 | 校验结果 |
| --- | --- | --- | --- | --- |
| Provider Gateway API | `nextclaw-provider-gateway-api` | `https://ai-gateway-api.nextclaw.io` | `https://nextclaw-provider-gateway-api.15353764479037.workers.dev` | `/health`=200, `/v1/models`=200（两域名一致） |
| Marketplace API | `nextclaw-marketplace-api` | `https://marketplace-api.nextclaw.io` | `https://nextclaw-marketplace-api.15353764479037.workers.dev` | `/health`=200, `/api/v1/skills/items`=200 |

## 3) 待处理/历史域名

| 域名 | 当前状态 | 备注 |
| --- | --- | --- |
| `https://api.nextclaw.io` | 不可用（HTTP 空响应 / HTTPS TLS 失败） | 不要用于生产流量，需单独确认是否废弃或重新绑定 |

## 4) 维护规则

1. 每次新增站点/Worker/自定义域名后，必须同步更新本文件。
2. 每次发布后至少校验一次：前端首页 `200`，API 关键健康接口 `200`。
3. 若域名证书或解析异常，先记录在“待处理/历史域名”并标注日期与现象。
