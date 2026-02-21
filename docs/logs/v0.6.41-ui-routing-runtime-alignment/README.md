# v0.6.41-ui-routing-runtime-alignment

## 迭代完成说明（改了什么）

本次迭代补齐了“前端配置能力”与已落地运行时能力的对齐，重点覆盖 OpenClaw 对齐中缺失的 UI 入口：

1. 新增 Runtime 配置页（Routing & Runtime）
- 新增 `Routing & Runtime` 导航页签。
- 可视化编辑并保存：
  - `agents.list`（多角色常驻列表）
  - `bindings`（`channel + accountId + peer -> agentId` 路由分诊）
  - `session.dmScope`
  - `session.agentToAgent.maxPingPongTurns`

2. UI Server 新增 runtime 保存接口
- 新增 `PUT /api/config/runtime`。
- 支持一次性保存 `agents.list`、`bindings`、`session`。
- `GET /api/config` 视图补齐 `bindings` 与 `session` 返回。

3. ChannelForm 补齐 Discord/Telegram 关键策略字段
- Telegram 新增可编辑字段：
  - `accountId`
  - `dmPolicy`
  - `groupPolicy`
  - `groupAllowFrom`
  - `requireMention`
  - `mentionPatterns`
  - `groups`（JSON）
- Discord 新增可编辑字段：
  - `proxy`
  - `mediaMaxMb`
  - `accountId`
  - `dmPolicy`
  - `groupPolicy`
  - `groupAllowFrom`
  - `requireMention`
  - `mentionPatterns`
  - `groups`（JSON）

## 测试 / 验证 / 验收方式

### 工程验证

- `pnpm -C packages/nextclaw-server tsc`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-server lint`
- `pnpm -C packages/nextclaw-ui lint`
- `pnpm build`
- `pnpm lint`
- `pnpm tsc`

结果：通过（均无 error；lint 存在既有 `max-lines` / `max-lines-per-function` warning）。

### 冒烟验证（非仓库目录写入）

- 执行环境：`/tmp`
- 命令：`pnpm -C packages/nextclaw-server exec tsx /tmp/nextclaw-runtime-smoke.ts`
- 脚本：使用 `packages/nextclaw-server/src/ui/config.ts` 的 `updateRuntime` + `updateChannel` 对临时配置文件进行真实写入与读取验证。
- 观察点：
  - `agents.list` 成功落盘
  - `bindings` 成功落盘
  - `session.dmScope` / `maxPingPongTurns` 成功落盘
  - Discord channel 新字段（含 `groups`）成功落盘
  - `buildConfigView()` 返回包含 `bindings/session`
- 输出：

```txt
SMOKE_OK {
  agentList: 2,
  bindingAgent: 'engineer',
  dmScope: 'per-account-channel-peer',
  pingPong: 0,
  discordAccountId: 'zongzhihui',
  discordGroupPolicy: 'allowlist',
  viewBindings: 1,
  viewSessionScope: 'per-account-channel-peer'
}
```

### 用户/产品视角验收步骤

1. 打开前端配置页，确认侧边栏出现 `Routing & Runtime`。
2. 在 `Routing & Runtime` 中新增至少 2 个 agent（如 `main`、`engineer`），并设置 1 条 `bindings` 路由。
3. 设置 `dmScope=per-account-channel-peer`，并设置 `maxPingPongTurns=0` 后保存。
4. 进入 Channels，打开 Discord/Telegram 配置，填写 `accountId`、`dmPolicy`、`groupPolicy`、`requireMention`、`mentionPatterns`、`groups` 后保存。
5. 回到 Runtime 页或通过读取配置确认值未丢失。
6. 通过真实对话验证：
   - 路由命中指定 agent；
   - 未 `@` 不触发、`@` 后触发；
   - `maxPingPongTurns=0` 时无 agent 间自动循环。

产品验收通过标准：前端可配置、保存稳定、行为可预测、与运行时一致。

## 发布 / 部署方式

- 已执行发布闭环：
  1. `pnpm changeset version`
  2. `pnpm release:check`
  3. `pnpm changeset publish`
  4. `pnpm changeset tag`
- 已发布版本：
  - `nextclaw@0.6.24`
  - `@nextclaw/server@0.4.8`
  - `@nextclaw/ui@0.3.12`
- 部署方式：升级到上述版本后重启 Gateway/UI 进程即可生效。
- 发布后文档影响检查：已更新 `docs/guides/openclaw-alignment-gap-report.md`，补充前端对齐进展。
