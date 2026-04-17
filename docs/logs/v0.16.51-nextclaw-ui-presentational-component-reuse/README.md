# v0.16.51-nextclaw-ui-presentational-component-reuse

## 迭代完成说明

- 只针对 `packages/nextclaw-ui` 做前端展示层复用治理，先补统一的纯展示组件，再回收多个技术型页面里散落的样式和结构。
- 新增共享展示组件：
  - `notice-card`
  - `setting-row`
  - `tag-chip`
  - `textarea`
- 将 Agent、Marketplace、MCP Marketplace、Remote、Account、Provider 配置等页面中的提示块、设置行、标签、输入框样式收口到共享组件。
- 继续把 Marketplace / MCP Marketplace 中的展示卡片、详情文档拼装、对话框和页面数据处理外提成独立模块，避免大页面继续膨胀。
- 将本轮触达的历史 PascalCase 页面/组件文件与对应测试统一迁移到 kebab-case，补齐新增代码治理要求。
- 规划文档：[`docs/plans/2026-04-17-nextclaw-ui-presentational-component-reuse-plan.md`](../../plans/2026-04-17-nextclaw-ui-presentational-component-reuse-plan.md)

## 测试 / 验证 / 验收方式

- 通过：`pnpm -C packages/nextclaw-ui exec eslint src/app.tsx src/components/chat/chat-page-shell.tsx src/components/config/channel-form-fields-section.tsx src/account/components/account-panel.tsx src/components/agents/agent-dialogs.tsx src/components/agents/agents-page.tsx src/components/agents/agents-page.test.tsx src/components/common/tag-input.tsx src/components/config/provider-enabled-field.tsx src/components/config/runtime-presence-card.tsx src/components/marketplace/marketplace-page.tsx src/components/marketplace/marketplace-page.test.tsx src/components/marketplace/marketplace-detail-doc.ts src/components/marketplace/marketplace-list-card.tsx src/components/marketplace/marketplace-page-data.ts src/components/marketplace/mcp/mcp-marketplace-page.tsx src/components/marketplace/mcp/mcp-marketplace-page.test.tsx src/components/marketplace/mcp/mcp-marketplace-doc.ts src/components/marketplace/mcp/mcp-marketplace-dialogs.tsx src/components/marketplace/mcp/mcp-marketplace-card.tsx src/components/remote/remote-access-page.tsx src/components/remote/remote-access-page.test.tsx src/components/ui/notice-card.tsx src/components/ui/setting-row.tsx src/components/ui/tag-chip.tsx src/components/ui/textarea.tsx`
- 通过：`pnpm -C packages/nextclaw-ui tsc --noEmit`
- 通过：`pnpm -C packages/nextclaw-ui test -- --run src/components/marketplace/marketplace-page.test.tsx src/components/marketplace/mcp/mcp-marketplace-page.test.tsx src/components/agents/agents-page.test.tsx src/components/remote/remote-access-page.test.tsx src/components/config/runtime-presence-card.test.tsx`
- 通过：`pnpm -C packages/nextclaw-ui build`
- 通过：`node scripts/governance/lint-new-code-governance.mjs -- <本轮 UI 触达文件列表>`
- 通过（仅本轮文件，含 warning 但无 error）：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <本轮 UI 触达文件列表>`
- 未全绿：`pnpm lint:maintainability:guard`
  - 阻断项来自当前工作区里其它并行改动触发的治理错误，如 `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend/agent-run-executor.ts`、`packages/nextclaw/src/cli/runtime.ts`、`packages/nextclaw-ui/src/lib/i18n.runtime-control.ts` 等，不属于本次 UI 复用整改范围。

## 发布 / 部署方式

- 本次未执行实际发布。
- 若需要以前端发布链路交付，可按项目约定执行 `/release-frontend` 或 `pnpm release:frontend`。
- 若只需本地确认，可继续使用 `pnpm -C packages/nextclaw-ui build` 产物做静态验收。

## 用户 / 产品视角的验收步骤

1. 打开 NextClaw UI，依次进入 Agents、Marketplace、MCP Marketplace、Remote、Account 与相关配置页。
2. 确认各类提示块、标签、设置行、文本域的视觉语言明显统一，不再出现同类技术组件在不同页面风格漂移。
3. 在 Agents 页面执行创建/编辑；在 Marketplace / MCP Marketplace 页面执行安装、启停、查看详情；确认弹窗与卡片样式一致，交互可用。
4. 检查路由跳转与懒加载页面正常，重命名后的 kebab-case 文件没有引入白屏、404 或测试回归。

## 可维护性总结汇总

- 长期目标对齐 / 可维护性推进：是。本次不是继续在每个页面单点补样式，而是先补共享展示组件，再把页面卡片、文档拼装、对话框和页面数据处理逐步外提，方向上更接近“复用更通用、页面更薄、复杂点更少”。
- 本次是否已尽最大努力优化可维护性：是，在当前一次性交付范围内已经把最直接的复用面、命名治理和大页面拆分做到了可验证的收敛；剩余 warning 主要是历史热点文件接近预算或目录级既有扁平债务。
- 是否优先遵循删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好的原则：是。虽然净代码量会上升，但新增主要来自把原本塞在单个大页面里的结构明确拆到稳定复用模块，并同步删除了页面内部重复样式和重复文档拼装逻辑。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：页面文件体积与函数复杂度显著下降，`marketplace-page.tsx`、`mcp-marketplace-page.tsx`、`ProtectedApp` 等热点被压回治理安全区或近预算区；但文件数净增，原因是把原本混杂在页面里的展示/拼装职责拆成可复用模块，这是本次复用治理的最小必要增长。
- 抽象、模块边界、 class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：更清晰。共享 UI 组件只承载纯展示；Marketplace / MCP 的列表卡片、详情文档、弹窗与页面数据处理职责分离；表单重置从 effect 改成 keyed inner form，避免继续把状态修补留在 React effect。
- 目录结构与文件组织是否满足当前项目治理要求：本轮触达文件已补齐 kebab-case 命名并通过定向治理；但 `src/components/ui`、`src/components/config` 等目录仍存在既有扁平度 warning，本次未继续大规模整理，因为已经超出“统一展示复用组件”这次整改边界。
- 代码增减报告：
  - 新增：5028 行
  - 删除：3462 行
  - 净增：+1566 行
  - 说明：本次包含多组 PascalCase -> kebab-case 文件迁移，Git 在部分页面/测试文件上按“删除旧文件 + 新增新文件”统计，导致行数看起来大于真实语义增量。
- 非测试代码增减报告：
  - 新增：4123 行
  - 删除：2612 行
  - 净增：+1511 行
  - 说明：净增主要来自把共享展示组件、Marketplace/MCP 卡片与文档拼装、页面数据处理和 keyed form 拆到独立模块；虽然文件数增加，但页面热点文件和 effect 复杂度被同步压缩。
- 若本次涉及代码可维护性评估，是否基于独立于实现阶段的复核：是。已额外执行 `post-edit-maintainability-guard` 的定向复核，并结合人工复核判断剩余 warning 是否属于可接受的历史债务。
