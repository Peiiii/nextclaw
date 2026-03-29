# 迭代完成说明

本次完成了一次整批发布闭环，覆盖三类内容：

- 新增 NextClaw 内置 AI skill：[cross-channel-messaging](../../../packages/nextclaw-core/src/agent/skills/cross-channel-messaging/SKILL.md)，让 AI 在“当前回复 / `sessions_send` / `message`”之间做正确选择。
- 补齐微信渠道的 self-notify route 提示同步：新开普通 UI/NCP 会话时，AI 也能拿到已保存的微信账号与用户 route，并在明确场景下直接通过微信主动发消息。
- 把最近尚未正式发布的 NCP session realtime sync 与相关公开包漂移一并纳入本次整批发布，避免只修一处、留下未发版本继续悬空。

相关迭代记录：

- [v0.14.286-cross-channel-messaging-skill](../v0.14.286-cross-channel-messaging-skill/README.md)
- [v0.14.287-weixin-self-notify-route-sync](../v0.14.287-weixin-self-notify-route-sync/README.md)
- [v0.14.284-ncp-session-realtime-sync-convergence](../v0.14.284-ncp-session-realtime-sync-convergence/README.md)
- [v0.14.285-incremental-maintainability-paydown-governance](../v0.14.285-incremental-maintainability-paydown-governance/README.md)

# 测试/验证/验收方式

本次发布前已完成：

- 单元测试：
  - `pnpm -C packages/nextclaw-openclaw-compat exec vitest run src/plugins/channel-runtime.test.ts`
  - `pnpm -C packages/nextclaw exec vitest run src/cli/commands/ncp/nextclaw-ncp-context-builder.test.ts`
  - `packages/nextclaw/node_modules/.bin/vitest run /Users/tongwenwen/Projects/Peiiii/nextclaw/packages/extensions/nextclaw-channel-plugin-weixin/src/index.test.ts`
- 定向构建：
  - `pnpm -C packages/nextclaw-core build`
  - `pnpm -C packages/nextclaw-openclaw-compat build`
  - `pnpm -C packages/extensions/nextclaw-channel-plugin-weixin build`
  - `pnpm -C packages/nextclaw build`
- 真实微信链路冒烟：
  - 隔离 `NEXTCLAW_HOME` 启动服务
  - 新开 UI/NCP 会话
  - 让 AI 调用 `message` 直接发出微信消息 `NC_WEIXIN_SMOKE_1774797187698`

发布阶段补充验证：

- `pnpm release:version`
- `pnpm release:publish`
- 发布后核对 git tags 与关键包线上版本

# 发布/部署方式

本次按项目标准 NPM 发布流程执行：

1. 提交功能改动与迭代记录。
2. 创建整批 release changeset。
3. 执行 `pnpm release:version` 生成版本号与 changelog 变更。
4. 提交 version bump。
5. 执行 `pnpm release:publish`，跑发布批次的 `build` / `lint` / `tsc` 后发布到 npm，并生成 git tags。
6. 推送发布相关 commits 与 tags。

# 用户/产品视角的验收步骤

1. 升级到本次发布后的 NextClaw 版本。
2. 确保本机微信渠道已登录，且已有默认账号与授权用户 route。
3. 新开一个普通 AI 会话，直接要求 AI “做完后通过微信通知我”。
4. 观察 AI 是否无需你手动再给 `accountId` / `to`，就能调用既有消息能力主动发出微信消息。
5. 同时检查最近的 NCP session realtime sync 相关行为是否已包含在当前发布版本中，而不是停留在未发 commit 状态。
