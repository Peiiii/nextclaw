# 2026-02-16 UI Hints List Descriptions

## 背景 / 问题

- Providers/Channels 列表描述仍是硬编码，与后端 config schema 的提示体系不一致
- 希望前端文案统一来源于 `uiHints`，保持一致性与可维护性

## 决策

- 保持 UI 结构不变，仅替换列表描述来源
- 以 `uiHints` 的 `help` 作为优先描述，缺失时回退到现有默认描述
- 在 core 层补齐 provider/channel 级 `schema.help`，作为统一事实源

## 变更内容

- Providers/Channels 列表描述改为基于 `uiHints`（保留兜底文案）
- `schema.help` 增加 provider/channel 级描述（含 openai/常用 channel）

## 验证（怎么确认符合预期）

```bash
pnpm build
pnpm lint
pnpm tsc
```

验收点：

- build 成功，`packages/nextclaw/ui-dist` 产物更新
- lint 仅有已知 max-lines 警告
- tsc 无类型错误

## 发布 / 部署

按 `docs/workflows/npm-release-process.md` 执行：

```bash
pnpm changeset
pnpm release:version
pnpm release:publish
```

影响包：`nextclaw-core`、`@nextclaw/ui`、`nextclaw`。

## 影响范围 / 风险

- Breaking change? 否
- 回滚方式：回退本次版本并还原 `uiHints` 相关改动
