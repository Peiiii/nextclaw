# v0.0.7 Validation

## 执行命令

- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core build`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui build`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw build`

## 结果

- `tsc`（core/nextclaw/ui）通过。
- `build`（core/ui/nextclaw）通过。
- `lint`：core/nextclaw 仅 warning；ui 存在仓库既有未使用变量错误（与本次修复无关），因此 `pnpm -C packages/nextclaw-ui lint` 非绿。

## 冒烟测试

- 命令：
  - `PATH=/opt/homebrew/bin:$PATH NEXTCLAW_HOME=/tmp/nextclaw-smoke-stop node --input-type=module <<'EOF' ... EOF`
- 观察点：
  - 构造持续 tool call 的 provider，并在第 2 次调用时触发 `AbortController.abort(...)`。
  - 输出为：`SMOKE_ABORT_RESULT AbortError chat turn stopped by user`。
- 验收结论：
  - 手动中断语义已走 `AbortError`，不会进入 tool-loop fallback 文案。
