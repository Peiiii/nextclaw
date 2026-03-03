# v0.0.3 Validation

## 执行命令

- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-engine-plugin-codex-sdk tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-engine-plugin-claude-agent-sdk tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-engine-plugin-codex-sdk exec eslint src/index.ts`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-engine-plugin-claude-agent-sdk exec eslint src/index.ts`

## 结果

- 两个扩展包 `tsc` 均通过。
- 两个扩展包 `eslint` 均通过（无新增 warning/error）。

## 冒烟说明

- 本轮未执行线上 UI 冒烟；建议按 [ACCEPTANCE](./ACCEPTANCE.md) 用 `codex-sdk` 或 `claude-agent-sdk` 引擎各验证一次。
