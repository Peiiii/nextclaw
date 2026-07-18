# v0.25.24 聊天字段聚焦样式收口

## 迭代完成说明

- 修复聊天模型选择器搜索框聚焦后出现额外高亮外圈和强调色边框的问题，并同步收口聊天 UI 默认输入框与下拉字段的聚焦样式。
- 根因是此前的字段视觉治理只修改了 `@nextclaw/ui` 的共享 `Input / Select / Textarea`，没有覆盖已拆分到 `@nextclaw/agent-chat-ui` 的 default-skin primitive；模型搜索框实际消费后者，因此仍保留旧的 primary focus ring。
- 通过组件调用链、Git 历史和真实页面计算样式确认了跨包 primitive 漏项。修复直接落在聊天 UI 的默认字段 owner，没有增加页面覆盖、全局选择器、wrapper 或第二套样式路径。
- 在现有模型选择器测试中补充聚焦视觉合同，防止该具体用户入口再次回退。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/agent-chat-ui test -- chat-input-bar-toolbar.test.tsx`：通过，1 个测试文件、5 项测试全部通过。
- `pnpm --filter @nextclaw/agent-chat-ui tsc`：通过。
- `pnpm --filter @nextclaw/agent-chat-ui lint`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-agent-chat-ui/src/components/chat/default-skin/input.tsx packages/nextclaw-agent-chat-ui/src/components/chat/default-skin/select.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar-toolbar.test.tsx`：通过，无 error 或 warning。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm lint:new-code:governance -- <本次 5 个路径>`：通过；全工作区检查仍被无关 WIP 中 `apps/platform-console/src/api/client.ts` 和 `workers/nextclaw-provider-gateway-api/src/types/platform.ts` 的文件角色命名阻塞。
- 真实源码页面 `http://127.0.0.1:5174/chat`：点击“选择模型: MiniMax/MiniMax-M3”后，“搜索模型”自动获得焦点；计算样式为普通 1px 边框、focus ring 宽度 0、无可见 outline 或 box-shadow，截图中不再出现额外外圈。

## 发布/部署方式

- 本次执行本地 commit；未执行 push、前端发布、NPM publish、Desktop 打包、宿主重启或运行时重启。
- 当前源码 Vite 实例已通过 HMR 消费修复；已安装产品实例需要后续 UI/NPM 版本发布后获得修复。
- 数据库 migration、后端部署与运行时更新不适用，本次只修改前端共享字段样式与回归测试。

## 用户/产品视角的验收步骤

1. 打开 NextClaw 聊天页。
2. 点击输入区右下角的当前模型，打开模型选择器。
3. 确认“搜索模型”输入框自动获得焦点后，仍只显示普通单层边框，没有额外高亮外圈或强调色边框。
4. 输入模型名称，确认搜索、选择和收藏操作保持正常。

## 可维护性总结汇总

- `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 结论为通过：总代码 `+8/-3`、净增 5 行；排除测试后生产代码 `+2/-2`、净增 0 行。
- 正向减债动作是职责收敛与复用：删除聊天包字段 primitive 的旧强调色 focus 合同，统一复用主应用已经采用的普通边框表达；没有新增组件、分支、状态、文件或目录。
- 这不是机械压缩行数：生产代码行数持平，但跨包平行视觉合同已收敛，模型搜索框和其它聊天字段由同一个 default-skin owner 获得一致行为。
- 没有文件级、目录级、函数级、命名职责或红区阻塞项，也没有保留新的维护债务。

## NPM 包发布记录

- `@nextclaw/agent-chat-ui`：已添加 patch changeset `.changeset/chat-field-focus-style.md`，尚未发布，待后续统一发布。
- `@nextclaw/ui`：作为用户实际消费的产品 UI 同步标记 patch，尚未发布，待后续统一发布。
