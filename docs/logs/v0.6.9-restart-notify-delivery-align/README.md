# 2026-02-19 Restart Notify Delivery Align

## 背景

- 用户在本地（Discord）实测：触发 AI 自升级/重启后，长时间没有“重启完成”回执。
- 根因是重启回执此前走 `bus.publishOutbound`（仅入队），真实发送失败在异步分发层被日志吞掉，上层无法感知并触发 fallback。

## 断舍离改动

- 移除重启回执的“绕开统一发送链路”做法。
- 在 `ChannelManager` 提供统一 `deliver()`，让实时发送和队列发送复用同一净化/分发语义。
- `wakeFromRestartSentinel` 改为依赖 `ChannelManager.deliver()`：
  - 支持 `replyTo` 失败后自动降级为不带 `replyTo` 发送（Discord 常见场景）。
  - 失败重试后仍不可达时，写入 `pending_system_events`，保留恢复路径。

## 关键文件

- `packages/nextclaw-core/src/channels/manager.ts`
- `packages/nextclaw/src/cli/commands/service.ts`

## 验证

```bash
pnpm build
pnpm lint
pnpm tsc
pnpm dlx tsx /tmp/nextclaw-restart-notify-smoke.ts
```

冒烟结论：

- `replyTo` 失败可自动降级成功发送。
- 持续失败会落入 `pending_system_events`。
- 输出：`restart notify smoke: ok`。

## 发布

- 本次为修复迭代，尚未执行 npm 发布。
- 若需发布，按 `docs/workflows/npm-release-process.md` 走 `release:version + release:publish`。
