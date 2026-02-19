# 2026-02-19 Restart Sentinel Hardening

## 问题复盘（真实现场）

- 用户在 Discord 实测：AI 触发重启后无回执，且后续看起来“不记得自己重启过”。
- 现场日志可见历史错误：`Error sending to discord: DiscordAPIError[50035] ... content must be <= 2000`。
- 根因是重启通知文本可能过长（尤其 `stats.reason`），触发 Discord 长度限制；发送失败后用户侧看不到即时回执。

## 本次修复

1. **重启通知文本收敛（避免超长）**
   - 在 `restart-sentinel.ts` 对 note/reason 与最终消息做长度上限与截断。
   - 目标是确保跨渠道发送稳定，不因异常长 reason 触发硬错误。

2. **缺失 sessionKey 的路由兜底**
   - 在 `service.ts` 中，当哨兵未携带 `sessionKey` 时，自动回退到最近一个可路由会话（非 CLI）。
   - 避免通知落到 `cli:default` 导致用户通道“无感”。

3. **保留失败回退记忆**
   - 发送仍失败时继续写入 `pending_system_events`，由下次消息注入系统提示。

## 关键文件

- `packages/nextclaw/src/cli/restart-sentinel.ts`
- `packages/nextclaw/src/cli/commands/service.ts`

## 验证（含端到端）

### 1) 开发校验

```bash
pnpm build
pnpm lint
pnpm tsc
```

### 2) /tmp 隔离冒烟

```bash
pnpm dlx tsx /tmp/nextclaw-restart-e2e-guard-smoke.ts
```

覆盖点：
- 超长 reason 会被截断；
- 缺失 sessionKey 可回退最近可路由会话；
- reply 失败可降级发送；
- 持续失败会入 `pending_system_events`。

### 3) 本机真实服务端到端

- 向 `~/.nextclaw/run/restart-sentinel.json` 注入超长 reason 哨兵并重启服务。
- 观察结果：
  - 哨兵被消费（文件消失）；
  - 服务重启后 Discord 通道恢复连接；
  - 最近时间窗口无新增 `Invalid Form Body` / `Error sending to discord`。

## 结论

- 重启通知链路在“超长内容 + 缺失 sessionKey”两类高风险场景下已加固。
- 用户不需要再重复做回归测试来确认该类故障。
