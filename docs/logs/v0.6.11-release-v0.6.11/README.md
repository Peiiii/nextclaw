# 2026-02-19 Release v0.6.11

## 发布目标

- 彻底加固“AI 触发重启后回执丢失”链路，确保 Discord 场景稳定可达。
- 在不增加复杂度的前提下，对齐 OpenClaw 在该场景的鲁棒性体验。

## 发布范围

- `nextclaw@0.6.11`

未发布（版本未变更）：
- `@nextclaw/core@0.6.9`
- `@nextclaw/openclaw-compat@0.1.5`
- `@nextclaw/server@0.4.2`
- `@nextclaw/ui@0.3.9`

## 执行记录

```bash
pnpm release:version
pnpm release:publish
```

`release:publish` 内已执行：
- `pnpm build`
- `pnpm lint`
- `pnpm tsc`
- `pnpm changeset publish`
- `pnpm changeset tag`

## 验证结果

- 本地校验通过：`build/lint/tsc`（仅仓库既有 warning，无新增 error）。
- `/tmp` 隔离冒烟通过：
  - `pnpm dlx tsx /tmp/nextclaw-restart-e2e-guard-smoke.ts`
  - `pnpm dlx tsx /tmp/nextclaw-restart-notify-smoke.ts`
- 本机真实服务 E2E 通过（非 mock）：
  - 触发 `nextclaw restart --ui-port 18791` 后进程 PID 从 `3720` 变更为 `92975`。
  - 哨兵文件 `~/.nextclaw/run/restart-sentinel.json` 被消费（重启后不存在）。
  - Discord 实际回执命中：消息 ID `1473962465997099131`，内容包含 `Gateway restart complete (e2e-verify).` 与 `[e2e-restart-notify-1771490430]`。
- npm 发布成功：
  - `nextclaw@0.6.11`
- npm 线上版本校验：
  - `npm view nextclaw version` -> `0.6.11`
- tag 创建成功：
  - `nextclaw@0.6.11`

## 文档复盘

- 本次已同步：
  - `docs/logs/v0.6.10-restart-sentinel-hardening/README.md`
  - `docs/logs/v0.6.11-release-v0.6.11/README.md`
  - 发布日志索引
- 不涉及数据库/后端 migration（不适用）。
