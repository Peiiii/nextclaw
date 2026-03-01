# 2026-03-01 Marketplace Source Link Wrap

## 背景 / 问题

- Skill 详情卡片中的 `Source` 长链接会超出卡片容器，影响可读性与布局稳定性。

## 决策

- 在详情页 HTML 模板中为元信息文本与 source 链接增加强制断词策略。
- 不调整内容结构，只修复样式行为。

## 变更内容

- 用户可见变化：
  - Marketplace skill/plugin 详情页中的超长 source URL 会在卡片内换行显示，不再溢出容器。
- 关键实现点：
  - `packages/nextclaw-ui/src/components/marketplace/MarketplacePage.tsx`
  - `.meta` 添加 `overflow-wrap: anywhere; word-break: break-word;`
  - `.source` 添加 `overflow-wrap: anywhere; word-break: break-all;`

## 验证（怎么确认符合预期）

```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc
```

验收点：

- TypeScript 校验通过。
- 打开 skill 详情页，超长 source 链接在卡片内部自动换行，无水平溢出。

## 用户/产品视角验收步骤

1. 进入 Marketplace 技能详情。
2. 选择带长 `sourceUrl` 的条目。
3. 观察 `Source (...)` 行，长链接应在卡片内换行，且不破坏边框布局。

## 发布 / 部署

- 本次变更涉及 `@nextclaw/ui`（以及携带 UI 产物的 `nextclaw`）。
- 按 `docs/workflows/npm-release-process.md` 执行 changeset/version/publish。

## 影响范围 / 风险

- Breaking change：否。
- 风险低，仅样式断词策略调整。
