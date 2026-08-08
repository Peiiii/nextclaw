# Agent 暗色表面修复

## 迭代完成说明

- 修复 Agent 创建与编辑弹窗在暗夜、炭夜主题下仍使用固定浅色渐变的问题；弹窗现在复用共享 `popover`、`border`、`foreground` 与 `muted` token。
- 同步收敛 Agent 详情弹窗、高级配置、列表卡片、加载态和空态中的固定浅色表面，避免相邻入口继续出现同类漏网项。
- 根因是 Agent 业务组件用固定十六进制色和浅色渐变覆盖了共享 `DialogContent` 已有的主题表面，而不是主题状态或 Radix Portal 丢失。用户截图、全仓固定色扫描和真实 DOM 计算样式共同确认了这一点。
- 修复落在现有主题 owner 的消费边界：删除业务组件的固定色并复用语义 token，没有新增页面级暗色判断、CSS 覆盖或平行主题路径。
- 同批次追加修复“新增 Agent”草稿丢失：旧实现先跳转 `/chat`、再通过独立内存事件请求输入提示，存在路由挂载与事件消费时序竞争；现在统一由 `ChatSessionListManager` 创建 Main Agent 草稿，并通过 `/chat/draft` route state 携带初始提示词。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- src/features/agents/components/__tests__/agents-page.test.tsx`：通过，1 个测试文件共 4 项；新增断言锁定创建/编辑与详情弹窗使用 `bg-popover`，且编辑弹窗不再包含固定渐变。
- `pnpm --filter @nextclaw/ui tsc`：通过。
- `pnpm --filter @nextclaw/ui lint`：0 error；3 条既有测试文件长度 warning 与本次改动无关。
- `pnpm --filter @nextclaw/ui build`：通过；只有既有的动态导入和大 chunk warning。
- `pnpm lint:new-code:governance` 与 `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`：0 error、1 warning；`agent-dialogs.tsx` 保持 473 行，接近 500 行预算但本次未增长。
- 固定色复扫：`nextclaw-ui` 的任意十六进制视觉类只剩共享 Agent 头像及其测试；头像已显式声明浅色/暗色配对，不属于漏网项。
- 本地真实页面 `http://127.0.0.1:5174/agents`：从“更多操作 → 编辑”打开同一 Agent 弹窗。暗夜主题下弹窗背景/正文为 `rgb(21, 24, 30)` / `rgb(238, 233, 221)`；炭夜主题下为 `rgb(38, 38, 38)` / `rgb(224, 224, 224)`。两套主题均完成截图复核，验收后恢复默认浅色主题。
- “新增 Agent”定向回归：修前 `startAgentDraftChat(..., "Create an agent")` 仍产生 `prompt: null`；修后 Agents 页面与会话 manager 两个测试文件共 20 项通过，route state 精确携带 prompt。
- “新增 Agent”真实冒烟：在 `http://127.0.0.1:5174/agents` 刷新后点击按钮，进入 `/chat/draft`；输入框精确显示“请直接创建一个默认示例 Agent，不要问我问题。创建完成后，简单告诉我它能做什么。”，当前 Agent 为 Main。
- 同批次追加验证时，`pnpm -C packages/nextclaw-ui lint` 通过；`pnpm -C packages/nextclaw-ui tsc` 被当前工作区无关的 `@nextclaw/server` 类型解析缺失及既有隐式 `any` 阻塞，本次触达文件无 TypeScript 报错。`pnpm lint:new-code:governance` 被无关的 `agent-context-window.manager.test.ts` 跨目录相对导入阻塞；governance backlog ratchet 与 generated-clean 检查通过。

## 发布/部署方式

- 本次未部署、未发布，也未提交或推送。
- 已新增 `.changeset/agent-dark-theme-surfaces.md`；`@nextclaw/ui` 需要 patch，进入后续统一发布批次。
- 不涉及数据库 migration、远程服务部署或线上 API 冒烟。

## 用户/产品视角的验收步骤

1. 打开“Agent 管理”，在任意 Agent 的“更多操作”中选择“编辑”。
2. 分别切换“暗夜”和“炭夜”，确认弹窗页头、正文、页脚、输入框、高级配置与提示卡使用一致的暗色表面，不再出现白色大底。
3. 打开“查看详情”，确认详情弹窗同样跟随当前主题。
4. 检查 Agent 列表、加载态和无 Agent 空态，确认背景、边框和文字会随主题切换且保持可读。
5. 点击“新增 Agent”，确认进入新的 Main Agent 草稿会话，输入框已预填默认示例 Agent 创建提示。

## 可维护性总结汇总

- `post-edit-maintainability-review` 结论：通过；本次顺手减债：是。
- 代码增减报告：新增 66 行、删除 76 行、净减 10 行；非测试生产代码新增 51 行、删除 52 行、净减 1 行。
- 正向减债动作：删除固定浅色渐变和十六进制色，复用共享主题 token，并把同一 Agent 功能域的相邻表面一起收敛到唯一主题 owner。
- 没有新增组件、helper、条件分支、effect、文件或目录层级；生产代码净减来自语义替换和固定样式删除，不是压缩行数或转移复杂度。
- 草稿修复删除了 Agents 页面独立的 `useNavigate + ChatDraftIntentManager` 旁路，复用会话 manager 已有的 draft route state 主链路；该追加范围总代码新增 66 行、删除 58 行、净增 8 行，非测试生产代码新增 31 行、删除 32 行、净减 1 行，maintainability guard 无发现。
- `agent-dialogs.tsx` 仍接近组件预算；若后续增加独立表单行为，应按创建/编辑共享表单段落这一自然缝拆分，当前纯样式修复不制造额外跳转。
- 复盘结论：现有 `frontend-style-encapsulation` 已明确要求主题 token 与真实明暗主题截图，机制本身没有缺口；本次用既有组件测试补上回归合同，无需新增常驻规则或治理脚本。

## NPM 包发布记录

- `@nextclaw/ui`：需要 patch，修复用户可见的暗色主题表面错误与“新增 Agent”草稿丢失；当前待统一发布。
