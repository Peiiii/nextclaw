# Bibo 托管个人搭档快速首发设计

日期：2026-09-24。目标：从用户提出需求起两小时内，公开上线基于 NextClaw 的 Bibo 独立网页服务。

## 已确认的用户选择

- 独立网页服务；沿用 Bibo 与 bibo.bot，已有概念站及 NextClaw 产品保持可用。
- 所有人可注册；成本优先；底层运行 NextClaw，不复制 Agent 核心。
- 用户首次使用后有真实对话结果、隔离的长期上下文和下次继续入口。背景工作和通知能力必须按已实现程度描述。

## 现状与方案

`apps/bibo-camera-site` 是已上线概念站。为避免新 DNS 权限和对已有路由的覆盖，首发在独立 Worker 的 `bibo.bot/app/` 路由，保留既有 `bibo.bot/*` 概念站 Worker。`@nextclaw/harness` 提供 Node.js Agent、session 与 run 公共入口。现有 NextClaw 服务是单人运行时，不允许把多个公众账号放进同一内核；直接在 Cloudflare Worker 内运行 Node runtime 不成立。Cloudflare Containers 能运行 Docker 镜像并按账号路由，Container 休眠时本地文件会丢失，必须在每次任务完成后把 NextClaw home 快照写入 R2，并在启动时恢复。Container DO 为每个账号串行化请求，R2 保存快照。这样既复用 NextClaw 的 Agent/记忆链路，也避免空闲账号持续计费。

首发 Worker 在 `bibo.bot/app/` 提供静态应用、注册/登录代理、鉴权、任务入口；复用现有平台账号 API，Worker 校验 token 后只用服务端账号 ID 路由 Container，不能由浏览器指定实例 ID。注册验证码仍由 NextClaw 账号服务发送，网页如实说明。Bibo 不修改现有账号库、概念站 route 或 NextClaw 宿主。Container 镜像只包 `@nextclaw/harness` 及所需 runtime；独立 HTTP 宿主调用其公共接口。每个账号拥有唯一 NextClaw home；请求体、快照、日志不跨用户。首发只启用文本聊天和会话继续，不开放 NextClaw 系统管理 UI、任意 CLI、外部连接与后台自动任务。公开页不宣称全天候代办。

快照只在一次任务完成后原子替换；失败时保留上次版本并明确反馈，不能向用户声称刚才内容已保存。正在运行时 Container 不允许休眠。为降低公开注册的滥用成本，每账号限流 12 次/小时、容器总并发上限 5、请求 4000 字和运行时限 85 秒；达到限制明确返回可重试原因。现有 NextClaw 模型网关的上游密钥真实返回 401，故首发 Bibo 单独代理 DeepSeek Flash：沿用平台身份验证，密钥仅保存在 Worker Secret，Durable Object 限制每账号每天 30 次、全站每天 200 次模型调用，单次输入最多 128 KiB、输出最多 2048 token。模型必须经过生产实测，失败则禁止公开宣称服务可用。

## 交付链路与黄金验收

1. 新用户访问 `bibo.bot/app/`，填写邮箱、验证码和密码注册并登录；发送一段介绍自己目标的消息；NextClaw 返回一条真实结果。刷新后能看到同一会话，继续提问并得到相关答复。
2. 两个不同账号分别说出私有信息，刷新与重新进入后各自上下文保持，不能看到对方内容。账号 token 无效时只能看到登录态，不能调用容器或读快照。
3. 用户访问既有 `bibo.bot` 概念页及 NextClaw 官网，原页面和主要操作继续可用。Bibo 首发入口有真实可访问域名、用户说明、失败反馈与公开范围的限额提示。

## Active acceptance contract

- contract-id: BIBO-2026-09-24
- scope-revision: 2（用户明确更正为 Bibo 独立网页、全公开、Cloudflare 优先）
- plan: required；部署和隔离链路需分批执行，执行过程中以此文记录结果。

| ID | Required | 验收 | Status |
| --- | --- | --- | --- |
| B1 | true | Bibo 独立注册与登录可用，未登录请求被拒绝 | not-run |
| B2 | true | 真实调用 NextClaw Harness 并返回首个任务结果 | not-run |
| B3 | true | 两账号隔离；重启与刷新后记忆和会话连续 | not-run |
| B4 | true | 限流、时限、失败恢复和成本上限生效 | not-run |
| B5 | true | `bibo.bot/app/` 公开可达；既有产品入口未受影响 | not-run |
| B6 | true | 用户文档、类型检查、真实冒烟、Review 和发布记录完成 | not-run |

## 方案 Review 自审

主链路从注册到隔离任务、持久化和继续使用闭合；既有单人 runtime 由账号容器隔离而非重写为多用户。R2 快照在容器中只恢复到本地 POSIX 文件系统，不将 SQLite 直接挂对象存储。若账号、容器或模型实际不可用，不能把静态 Bibo 页面当作完成上线。后台主动工作和跨渠道通知是后续明确阶段，首发页面不作对应承诺。
