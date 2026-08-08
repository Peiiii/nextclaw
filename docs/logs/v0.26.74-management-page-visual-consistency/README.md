# 管理页视觉一致性修复

## 迭代完成说明

- 修复 Agent 创建与编辑弹窗在暗夜、炭夜主题下仍使用固定浅色渐变的问题；弹窗现在复用共享 `popover`、`border`、`foreground` 与 `muted` token。
- 同步收敛 Agent 详情弹窗、高级配置、列表卡片、加载态和空态中的固定浅色表面，避免相邻入口继续出现同类漏网项。
- 根因是 Agent 业务组件用固定十六进制色和浅色渐变覆盖了共享 `DialogContent` 已有的主题表面，而不是主题状态或 Radix Portal 丢失。用户截图、全仓固定色扫描和真实 DOM 计算样式共同确认了这一点。
- 修复落在现有主题 owner 的消费边界：删除业务组件的固定色并复用语义 token，没有新增页面级暗色判断、CSS 覆盖或平行主题路径。
- 同批次追加修复“新增 Agent”草稿丢失：旧实现先跳转 `/chat`、再通过独立内存事件请求输入提示，存在路由挂载与事件消费时序竞争；现在统一由 `ChatSessionListManager` 创建 Main Agent 草稿，并通过 `/chat/draft` route state 携带初始提示词。
- 统一收件箱、Agent 管理与定时任务三个同级页面的标题区：全部复用共享 `PageHeader`，统一标题字号、字重、行高、说明文字和操作区位置。
- 删除 Agent 标题旁的总数胶囊、收件箱标题旁与筛选栏重复的未读数，以及定时任务的装饰性“自动化工作台”眉题；状态与数量继续由各页面内容区承载。
- 定时任务刷新动作保留紧凑图标形态，并补齐悬浮提示；共享标题组件保留可配置的语义标题层级，避免设置子页被错误提升为页面主标题。
- 修复宽屏下页面画布仍不一致的问题：收件箱与 Agent 管理原为 `1180px`，定时任务与技能市场原为 `1120px`；现在四个同级页面统一使用 `1180px` 最大画布宽度。

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
- 管理页标题真实验收：`/agents`、`/inbox`、`/cron` 的 `h1` 计算样式均为 `20px / 600 / 28px`，左上坐标均为 `x=304 / y=20`；三页视觉基线一致。
- 宽屏画布定向验收覆盖最大宽度生效的视口，确认 Agent 管理、定时任务与技能市场左右留白一致；补充 `ChatPageLayout` 回归测试锁定三页均使用 `max-w-[min(1180px,100%)]`。
- 页面视觉定向回归：Agent、收件箱、定时任务与主工作区画布共 4 个测试文件、19 项测试通过；Agent 与定时任务锁定一级标题语义，主工作区测试锁定四页共享画布合同。
- 标题区变更后的 `pnpm --filter @nextclaw/ui tsc`：通过。
- 最终 `pnpm --filter @nextclaw/ui lint`、`tsc` 与 `build` 均通过；构建只有既有的动态导入与大 chunk warning。
- `pnpm lint:new-code:governance`、governance backlog ratchet 与 generated-clean 检查全部通过；只有一个已有且已记录例外的 flat-directory warning。

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
6. 依次打开收件箱、Agent 管理与定时任务，确认标题字号、顶部与左侧基线、说明文字和右侧操作区保持一致；标题区域不再重复展示内容区已有数量。

## 可维护性总结汇总

- `post-edit-maintainability-review` 结论：通过；本次顺手减债：是。
- 本提交源码与测试新增 94 行、删除 93 行、净增 1 行；非测试生产代码新增 64 行、删除 93 行、净减 29 行。
- 正向减债动作：删除固定浅色渐变和十六进制色，复用共享主题 token；同时删除三套页面私有标题 JSX，让共享 `PageHeader` 成为唯一视觉 owner。
- 没有新增组件、helper、effect 或目录层级；生产代码净减来自语义 token 替换、删除三套重复标题结构和复用现有图标操作组件，不是压缩行数或转移复杂度。
- 草稿修复删除了 Agents 页面独立的 `useNavigate + ChatDraftIntentManager` 旁路，复用会话 manager 已有的 draft route state 主链路；该追加范围总代码新增 66 行、删除 58 行、净增 8 行，非测试生产代码新增 31 行、删除 32 行、净减 1 行，maintainability guard 无发现。
- `agent-dialogs.tsx` 保持 473 行；`cron-config.tsx` 从 461 行降至 453 行。两者仍接近 500 行预算，后续若增加独立行为，应沿表单段落或任务列表职责的自然边界拆分，本次不为纯视觉修复制造额外文件跳转。
- 复盘结论：现有 `frontend-style-encapsulation` 已明确要求共享样式 owner、主题 token 与真实明暗主题截图；问题来自页面没有复用既有 owner，而不是机制缺失。本次以删除重复结构和补充真实视觉验收闭环，无需新增常驻规则或治理脚本。

## NPM 包发布记录

- `@nextclaw/ui`：需要 patch，修复用户可见的暗色主题表面错误、“新增 Agent”草稿丢失及同级管理页标题区不一致；当前待统一发布。
