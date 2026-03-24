# 迭代完成说明

- 本次落地了飞书能力对齐路线的 Phase 1 底座，不是照搬 OpenClaw 壳层，而是按 NextClaw 的 AgentOS 目标吸收可复用的纯飞书层能力。
- 新增 [`@nextclaw/feishu-core`](../../../../packages/extensions/nextclaw-feishu-core/package.json)，沉淀了飞书配置模型、多账号解析、Lark client 管理、基础 probe 与消息内容转换能力。
- [`@nextclaw/core`](../../../../packages/nextclaw-core/src/config/schema.ts) 已切到新的飞书 schema，并补齐了标签与帮助文案。
- [`@nextclaw/channel-runtime`](../../../../packages/extensions/nextclaw-channel-runtime/src/channels/feishu.ts) 的 Feishu runtime 已改为复用 `@nextclaw/feishu-core`，接入 `accountId` 路由、多账号、`domain`/brand、mention 策略与 richer inbound conversion。
- [`@nextclaw/ui`](../../../../packages/nextclaw-ui/src/components/config/channel-form-fields.ts) 已补齐当前真实支持的飞书关键字段，避免产品表面与运行时能力继续错位。
- 设计与判断沉淀见：
  - [飞书官方插件的 AgentOS 视角评估](../../plans/2026-03-24-feishu-agentos-evaluation.md)
  - [飞书能力复用与架构设计](../../plans/2026-03-24-feishu-code-reuse-architecture-design.md)
  - [飞书 Upstream 吸收执行计划](../../plans/2026-03-24-feishu-upstream-adoption-plan.md)

# 测试/验证/验收方式

- 已完成定向验证：
  - `pnpm install`
  - `pnpm -C packages/extensions/nextclaw-feishu-core test`
  - `pnpm -C packages/extensions/nextclaw-feishu-core lint`
  - `pnpm -C packages/extensions/nextclaw-feishu-core tsc`
  - `pnpm -C packages/extensions/nextclaw-feishu-core build`
  - `pnpm -C packages/nextclaw-core lint`
  - `pnpm -C packages/nextclaw-core tsc`
  - `pnpm -C packages/nextclaw-core build`
  - `pnpm -C packages/extensions/nextclaw-channel-runtime lint`
  - `pnpm -C packages/extensions/nextclaw-channel-runtime tsc`
  - `pnpm -C packages/extensions/nextclaw-channel-runtime build`
  - `pnpm -C packages/nextclaw-ui lint`
  - `pnpm -C packages/nextclaw-ui tsc`
  - `pnpm lint:maintainability:report`
- maintainability 定向守卫已通过：
  - `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
  - 结果：`Errors: 0`, `Warnings: 1`
- 发布前还需在干净 worktree 中执行正式 release 闭环：
  - `pnpm release:version`
  - `pnpm release:publish`
  - 隔离目录 CLI 冒烟

# 发布/部署方式

- 本次属于 npm 包发布，不涉及远程 migration、服务部署或线上 API 发布。
- 由于当前主工作区存在用户自己的 UI/NCP 脏改动，本次正式发布必须在干净 worktree 中进行，只带出飞书相关改动，避免把无关内容打入 npm 产物。
- 发布流程：
  1. 在干净 worktree 中应用本次飞书 Phase 1 改动
  2. 执行 `pnpm release:version`
  3. 执行 `pnpm release:publish`
  4. 用隔离目录执行安装与启动冒烟
  5. 提交本次发布闭环 commit

# 用户/产品视角的验收步骤

1. 安装本次发布后的最新版 `nextclaw`。
2. 打开配置 UI，进入 Feishu 渠道配置，确认可见并可填写新增字段，如 `domain`、`accountId`、多账号相关字段与消息策略字段。
3. 用飞书 bot 在私聊和群聊分别发送消息，确认 mention / DM / group 基础策略按配置生效。
4. 配置多账号后触发 outbound 发送，确认消息可按目标账号路由。
5. 观察复杂飞书消息进入 NextClaw 后的内容展示，确认不再只剩粗糙纯文本降级。
