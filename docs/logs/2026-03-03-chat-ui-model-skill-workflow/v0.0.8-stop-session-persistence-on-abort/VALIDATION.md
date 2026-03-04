# v0.0.8 Validation

## 执行命令

- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core build`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc`

## 结果

- `nextclaw-core` 的 `tsc/build` 通过。
- `nextclaw-core lint` 通过（仅既有 max-lines warnings，无新增 error）。
- `nextclaw tsc` 通过。

## 冒烟测试

- 在隔离目录执行（`NEXTCLAW_HOME=/tmp/nextclaw-smoke-stop-persist`）模拟流式多工具 + 中途 stop。
- 观察点：
  - 输出 `SMOKE_ABORT AbortError chat turn stopped by user`。
  - 输出 `SMOKE_SESSION_FILE_EXISTS true`。
  - session 文件行数 > 1，包含 metadata + 事件。
- 结论：中断后会话已持久化，不会因刷新而“消失”。
