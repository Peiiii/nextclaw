# 2026-02-16 MiniMax API Hint Display

## 背景 / 问题

- 已写入 `providers.minimax.apiBase` 的提示，但 UI 输入框已有值时 placeholder 不可见
- 需要确保提示在实际填写场景中可见

## 决策

- 保持 UI 结构不变，仅在 API Base 输入框下展示 hint 的 help 文案

## 变更内容

- Provider 配置弹窗的 API Base 增加 help 文案展示（来自 `uiHints`）

## 验证（怎么确认符合预期）

```bash
pnpm build
pnpm lint
pnpm tsc
```

验收点：

- build 成功，UI 产物更新
- lint 仅有已知 max-lines 警告
- tsc 无类型错误

## 发布 / 部署

按 `docs/workflows/npm-release-process.md` 执行（如需发布）：

```bash
pnpm changeset
pnpm release:version
pnpm release:publish
```

## 影响范围 / 风险

- Breaking change? 否
- 回滚方式：回退本次版本并移除 help 展示
