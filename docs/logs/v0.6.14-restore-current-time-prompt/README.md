# 2026-02-19 Restore current-time prompt line

## 背景 / 问题

- 在对齐 OpenClaw 提示词过程中，`nextclaw-core` 的系统提示词移除了显式“当前时间”行。
- 用户确认需要恢复该信息，以便模型在不额外调用工具时也能感知当前时间。

## 决策

- 恢复系统提示词中的 `Current time: ...` 注入。
- 不改变其余 OpenClaw 对齐结构与文案。

## 变更内容

- `packages/nextclaw-core/src/agent/context.ts`
  - 在 `getIdentity()` 中恢复 `now` 计算。
  - 在 `## Runtime` 段落恢复 `Current time: ${now}` 行。

## 验证（怎么确认符合预期）

```bash
pnpm build
pnpm lint
pnpm tsc
```

验收点：

- 系统提示词包含 `Current time:` 行。
- `build/lint/tsc` 通过（仅允许既有 warning）。

## 发布 / 部署

- 本次仅提示词文本修正，不涉及 migration。
- 如需发布 npm 包，按 `docs/workflows/npm-release-process.md` 执行。

## 影响范围 / 风险

- 影响范围：`@nextclaw/core` 系统提示词文本。
- 风险：低，仅恢复时间注入。
