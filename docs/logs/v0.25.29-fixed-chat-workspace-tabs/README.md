# v0.25.29 会话工作台固定导航标签页

## 迭代完成说明

- 会话右侧工作台现在固定展示“子会话”“定时任务”“项目文件”三个导航标签页，名称不再混用“本会话定时任务”等更长表达。
- 根因是固定导航页与临时资源页共用了可关闭合同：view model 为三个导航页生成 `onClose`，并根据 `closedWorkspaceTabEntries` 隐藏它们；状态 owner 也允许把这些导航页写入关闭记录。
- 根因通过 view model、`closeWorkspaceTabSnapshot` 和真实 5174 页面三方确认。修复直接落在两个语义 owner：固定导航页不再生成关闭动作或读取关闭记录，状态 owner 同时拒绝关闭三类固定页；具体子会话、侧边对话草稿和文件等临时资源标签页继续保留原关闭能力。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- chat-workspace-panel-view-model.utils.test.ts chat-thread-workspace.manager.test.ts`：2 files / 14 tests 通过，覆盖固定标签页、遗留关闭记录、中文精确名称、临时资源关闭和状态 owner 拒绝关闭。
- `pnpm --filter @nextclaw/ui tsc`：通过。
- `pnpm --filter @nextclaw/ui lint`：0 error；本次触达测试拆分后不再新增函数长度 warning，package 仍有 `cron-config.tsx` 的 1 条既有 cognitive-complexity warning。
- 本次 4 个触达 TypeScript 文件 targeted ESLint 使用 `--max-warnings=0` 通过。
- `pnpm lint:new-code:governance -- <本次 6 个精确路径>`、`pnpm check:governance-backlog-ratchet` 与 `pnpm check:generated-clean` 均通过。全工作区治理另被并行 `apps/platform-admin` 新文件的 module-structure 错误阻塞，与本批无关。
- 真实浏览器验收：在当前源码 `http://127.0.0.1:5174/chat/sid_bmNwLW1ycTR5bjc5LWUyZWNiY2Y5` 点击“打开会话工作台”，三个目标标签页均存在、名称精确且关闭按钮数量为 0；切换“定时任务”后其进入 active 状态，三个固定标签页继续全部存在。

## 发布/部署方式

- 变更由 `.changeset/fix-chat-workspace-navigation-tabs.md` 记录，后续随 `@nextclaw/ui` patch 统一发布。
- 本次未执行 NPM 发布、部署或服务重启。

## 用户/产品视角的验收步骤

1. 打开任意已有会话，点击 Header 中的“打开会话工作台”。
2. 确认顶部始终展示“子会话”“定时任务”“项目文件”三个标签页。
3. 分别悬浮和键盘聚焦三个标签页，确认没有关闭按钮或关闭菜单。
4. 依次切换三个标签页，确认名称不变化且其他两个入口不会消失。
5. 打开具体子会话或项目文件，确认这些临时资源标签页仍可关闭。

## 可维护性总结汇总

- 可维护性复核结论：通过，no maintainability findings。
- TypeScript 代码与测试新增 `78` 行、删除 `45` 行、净增 `33` 行；排除测试后生产代码新增 `7` 行、删除 `26` 行、净减 `19` 行。
- 正向减债动作是删除固定页到关闭记录的转换 helper、三个 `onClose`、关闭记录过滤分支和无意义参数传递；没有新增组件、store、effect、helper、兼容路径或文件。固定导航与临时资源的行为边界更明确，生产主路径更少。
- maintainability guard 以 `--non-feature` 检查 4 个 TypeScript 文件，结果为 0 error / 0 warning；未触达红区，目录和文件数量均未增长。

## NPM 包发布记录

- `@nextclaw/ui`：需要 patch，包含用户可见的会话工作台固定导航行为，待统一发布。
- Changeset：`.changeset/fix-chat-workspace-navigation-tabs.md`。
- 本次未执行 NPM 发布。
