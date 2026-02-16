# 2026-02-16 MiniMax API Base Hint

## 背景 / 问题

- MiniMax 在中国区与海外使用不同的 API Base URL
- 需要在 UI 的 apiBase 字段给出清晰提示，避免配置错误

## 决策

- 保持 UI 结构不变，仅通过 `uiHints` 的 placeholder 与 help 提示
- 在 core 的 `schema.hints` / `schema.help` 中补齐 MiniMax 专用提示

## 变更内容

- `providers.minimax.apiBase` 新增 placeholder（CN/Global URL）
- `providers.minimax.apiBase` 新增 help 文案（按账号区域选择）

## 验证（怎么确认符合预期）

```bash
pnpm build
pnpm lint
pnpm tsc
```

验收点：

- build 成功，UI 产物已更新
- lint 仅有已知 max-lines 警告
- tsc 无类型错误

## 发布 / 部署

按 `docs/workflows/npm-release-process.md` 执行：

```bash
pnpm changeset
pnpm release:version
pnpm release:publish
```

影响包：`nextclaw-core`、`nextclaw`。

## 影响范围 / 风险

- Breaking change? 否
- 回滚方式：回退相关版本并移除提示
