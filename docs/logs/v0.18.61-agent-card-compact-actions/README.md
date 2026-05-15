# v0.18.61 Agent 卡片紧凑操作层

## 迭代完成说明

本次根据产品反馈收敛 Agent 管理界面的展示密度和操作层级：将原本偏展示橱窗式的大 Hero 收成轻量页头，将 Agent 卡片改为更紧凑的身份、描述、Runtime、主目录结构，并把编辑、移除等低频管理操作收进更多菜单。默认界面只保留轻量图标入口，减少常驻按钮噪音，让页面更接近 NextClaw 控制台的简约工作台风格。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui exec vitest run src/features/agents/components/agents-page.test.tsx`：通过，3 个测试通过。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui exec eslint src/features/agents/components/agents-page.tsx src/features/agents/components/agents-page.test.tsx`：0 error，1 个既有函数长度 warning。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/features/agents/components/agents-page.tsx packages/nextclaw-ui/src/features/agents/components/agents-page.test.tsx`：通过，保留 1 个既有函数长度 warning。
- `pnpm -C packages/nextclaw-ui build`：通过，保留 Vite chunk size warning。
- `pnpm -C packages/nextclaw-ui lint`：被无关既有错误阻塞；触达文件的 targeted ESLint 已通过。
- Browser 冒烟：在 `http://127.0.0.1:5175/agents` 打开真实页面，确认页面渲染 9 个 Agent 卡片，存在 9 个“开始对话”和 9 个“更多操作”入口，打开第二个更多菜单后可见“编辑/移除”。

## 发布/部署方式

未发布、未部署。本次只完成本地源码、测试和构建验证，未执行前端发布闭环。

## 用户/产品视角的验收步骤

1. 打开 Agent 管理页。
2. 确认页头更轻量，不再占据大面积首屏。
3. 确认每张 Agent 卡片更紧凑，默认可扫读名称、ID、描述、Runtime 和主目录。
4. 确认编辑、移除不再作为大按钮常驻展示，而是通过更多菜单展开。
5. 确认“开始对话”仍是可访问的轻量图标入口。

## 可维护性总结汇总

本次属于非功能 UI 简化改动，遵守了先删减再收敛的原则。生产代码净减 12 行，删除了卡片色带 tone 配置、大面积 Hero 装饰和常驻操作按钮结构；没有新增平行组件体系，直接复用现有 `Popover`、`Button`、`Card`、`TagChip`。维护性 guard 通过，但 `AgentsPage` 函数仍超过函数长度 warning 阈值，后续若继续改 Agent 页，应优先抽离列表空态/加载态区域来进一步降低页面 shell 长度。

## NPM 包发布记录

不涉及 NPM 包发布。
