# 2026-02-23 UI Tooltip Portal Fix + Marketplace Card Refresh

## 背景 / 问题

- Marketplace 列表信息密度高，Tooltip 被裁剪/遮挡影响信息可读性。

## 决策

- 使用 Radix Tooltip Portal 提升渲染层级，统一 z-index 到设计系统。
- 同步优化 Marketplace 卡片信息密度与可读性（头像、提示信息、按钮样式）。

## 变更内容

- UI Tooltip 通过 Portal 渲染并使用 `--z-tooltip` 层级。
- Marketplace 列表卡片：头像缩略、标题/spec/摘要 Tooltip、按钮样式统一。
- `@nextclaw/ui` 升级到 `0.5.3` 并新增 `@radix-ui/react-tooltip` 依赖。

## 验证（怎么确认符合预期）

```bash
# release:publish 内含 release:check（build/lint/tsc）
pnpm release:publish

# smoke-check（非仓库目录）
NEXTCLAW_HOME=/tmp/nextclaw-ui-release-smoke pnpm -C /Users/peiwang/Projects/nextbot/packages/nextclaw dev start --ui-port 18813 > /tmp/nextclaw-ui-release-smoke.log 2>&1
sleep 2
curl -s http://127.0.0.1:18813/api/health
NEXTCLAW_HOME=/tmp/nextclaw-ui-release-smoke pnpm -C /Users/peiwang/Projects/nextbot/packages/nextclaw dev stop
```

验收点：

- `release:publish` 内置校验通过（build/lint/tsc）。
- `/api/health` 返回 `ok`。
- Marketplace 列表内标题/spec/摘要 Tooltip 不被裁剪且层级正确。
- lint 存在既有 warnings（max-lines），不影响本次发布结论。

## 发布 / 部署

按 [`docs/workflows/npm-release-process.md`](../../../docs/workflows/npm-release-process.md) 执行：

```bash
pnpm release:version
pnpm release:publish
```

## 用户 / 产品验收步骤

- 进入 Marketplace 列表页，悬停标题、spec、摘要，Tooltip 正常显示且不被遮挡。
- 切换 Installed/Extensions 标签，卡片布局与按钮样式正常。

## 影响范围 / 风险

- Breaking change：否
- 风险：低（UI 展示层变化）
