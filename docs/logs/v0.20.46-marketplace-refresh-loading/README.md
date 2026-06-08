# v0.20.46 Marketplace Refresh Loading

## 迭代完成说明

本次把技能市场后续搜索、排序刷新从“清空列表后显示 skeleton”调整为保留上一批结果并给出轻量更新反馈。初始加载仍使用 skeleton；已有数据后的搜索/排序刷新会继续展示旧结果，同时在搜索框、列表标题和列表顶部进度线提示正在更新，降低操作中断感。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test -- src/features/marketplace/hooks/use-marketplace.test.tsx src/features/marketplace/components/marketplace-page.test.tsx`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui exec eslint src/features/marketplace/hooks/use-marketplace.ts src/features/marketplace/hooks/use-marketplace.test.tsx src/features/marketplace/components/marketplace-page.tsx src/features/marketplace/components/marketplace-page.test.tsx src/features/marketplace/components/marketplace-page-parts.tsx src/features/marketplace/components/marketplace-catalog-grid.tsx src/features/marketplace/components/mcp/mcp-marketplace-page.tsx src/shared/lib/i18n/marketplace-labels.utils.ts`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm check:generated-clean`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`

## 发布/部署方式

无需单独部署。该改动进入 `@nextclaw/ui` 后随后续统一前端/NPM 发布生效。

## 用户/产品视角的验收步骤

1. 打开技能市场。
2. 初始进入时确认仍显示 skeleton 加载态。
3. 在已有结果后搜索或切换排序，确认原列表不被清空。
4. 确认搜索框和列表区域出现轻量的 updating 状态，待新结果返回后自然替换列表。

## 可维护性总结汇总

本次优先复用 React Query 的 placeholder data 机制，只放宽同一列表表面下 `q` / `sort` 变化时的旧数据保留条件；UI 反馈继续留在 Marketplace 现有页面和 catalog grid 组件内，没有新增 manager 或一次性 bridge。`post-edit-maintainability-guard` 通过；报告显示源码/测试触达范围总增减为 `+168 / -9 / +159`，非测试代码为 `+52 / -9 / +43`。剩余警告为 Marketplace 页面接近文件预算、i18n 目录已有记录豁免，均未形成本次阻塞。

## NPM 包发布记录

涉及 `@nextclaw/ui` 用户可见体验改动，已添加 `.changeset/marketplace-refresh-loading.md`，状态为待后续统一发布。
