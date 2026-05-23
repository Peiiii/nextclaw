# v0.19.12-resizable-right-panel

## 迭代完成说明

- 抽取 `ResizableRightPanel` 作为 docked 右侧面板的共享布局 owner，集中管理宽度、横向拖拽、最小/最大宽度和拖拽遮罩。
- `DocBrowser` 的 docked 模式改为复用共享右侧面板，删除原先组件内部的 docked resize state/ref/handler；floating 模式仍保留自身的浮窗拖拽和双轴 resize。
- 删除 `DocBrowser` context 中不必要的派生字段和未使用 API，让右侧面板收敛后非测试代码保持净减少。
- `ChatSessionWorkspacePanel` 的 desktop docked 模式改为复用共享右侧面板，子会话、文件预览和 session cron 面板不再使用固定响应式宽度。
- 会话列表切换不再清空 workspace panel 状态；右侧栏状态继续归属 parent session，切到别的会话时仅因 `workspacePanelParentKey` 不匹配而隐藏，切回 parent session 后恢复打开状态。
- 测试侧补充共享右侧面板、DocBrowser docked handle、chat workspace handle 的覆盖，并把 chat workspace 测试从 feature barrel 改为直接导入目标组件，避免无关导出触发测试环境副作用。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- src/shared/components/resizable-right-panel/resizable-right-panel.test.tsx src/shared/components/doc-browser/doc-browser.test.tsx src/shared/components/doc-browser/doc-browser-context.test.tsx src/features/chat/components/conversation/chat-conversation-panel.test.tsx src/features/chat/managers/chat-session-list.manager.test.ts`
  - 通过，5 个测试文件、36 个测试用例通过。
- `pnpm --filter @nextclaw/ui tsc`
  - 通过。
- `pnpm --filter @nextclaw/ui exec eslint src/shared/components/resizable-right-panel/resizable-right-panel.tsx src/shared/components/resizable-right-panel/resizable-right-panel.test.tsx src/shared/components/doc-browser/doc-browser.tsx src/shared/components/doc-browser/doc-browser.test.tsx src/shared/components/doc-browser/doc-browser-context.tsx src/shared/components/doc-browser/doc-browser-context.test.tsx src/features/chat/components/chat-session-workspace-panel.tsx src/features/chat/components/conversation/chat-conversation-panel.test.tsx src/features/chat/managers/chat-session-list.manager.ts src/features/chat/managers/chat-session-list.manager.test.ts`
  - 通过，无 errors；剩余 3 个既有 warning，集中在 `DocBrowser` / `DocBrowserProvider` 超长函数和 context destructuring。
- `pnpm --filter @nextclaw/ui lint`
  - 未通过，阻塞来自本次未触达的既有 lint errors；本次触达文件已使用 targeted ESLint 验证。
- `pnpm lint:new-code:governance`
  - 通过。
- `pnpm check:governance-backlog-ratchet`
  - 通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
  - 通过，无 errors；非测试代码新增 137 行、删除 147 行、净减 10 行。提示 `DocBrowser` / `DocBrowserProvider` 接近文件预算，但本次二者均减少行数。
- 本地 Vite 冒烟：
  - `pnpm --filter @nextclaw/ui exec vite --host 127.0.0.1 --port 5184`
  - Playwright 打开 `http://127.0.0.1:5184/`，页面标题为 `NextClaw - Chat`，无 page error，并确认新增 `ResizableRightPanel` 模块可由 Vite 正常转换加载。

## 发布/部署方式

- 未执行发布或部署。
- 本次仅修改源码与测试，不涉及数据库 migration、远程 deploy、线上 API smoke 或桌面安装包验证。

## 用户/产品视角的验收步骤

1. 打开 NextClaw UI 桌面宽度页面。
2. 打开内嵌文档浏览器并保持 docked 侧栏模式，拖拽左侧边缘，确认右侧文档面板宽度变化且不会小于最小宽度。
3. 在 chat 会话中打开子会话/文件预览/session cron 右侧 workspace 面板，拖拽左侧边缘，确认右侧 workspace 面板宽度变化。
4. 缩到移动布局时，workspace 面板仍使用 overlay，不显示 resize handle。

## 可维护性总结汇总

- 本次使用 `post-edit-maintainability-guard` 与人工 maintainability review。
- 正向减债动作：职责收敛 + 复用 + 删除。右侧 docked resize 的状态和事件处理从 `DocBrowser` 专属实现收敛到共享 owner，chat workspace 不再维持固定宽度的平行行为；同时删除过早加入的宽度持久化、独立 types 文件、未使用 context API、不必要的派生 context 字段，以及会话切换时破坏 workspace panel 记忆的清状态逻辑。
- 代码增减报告：本次 UI 相关改动总计新增 194 行、删除 161 行、净增 33 行；非测试代码新增 137 行、删除 147 行、净减 10 行。
- 测试代码净增长来自新增共享右侧面板、DocBrowser docked handle 和 chat workspace handle 覆盖；生产代码保持净减少。
- 目录组织符合当前 L3 前端结构：跨 feature 稳定 UI primitive 放入 `shared/components/resizable-right-panel/`；业务内容仍留在各自 feature/component owner。
- 剩余观察点：`DocBrowser` 仍接近文件预算，后续若继续触达应优先拆分内容渲染和 floating overlay 逻辑。

## NPM 包发布记录

不涉及 NPM 包发布。
