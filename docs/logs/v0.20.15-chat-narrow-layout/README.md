# v0.20.15 Chat Narrow Layout

## 迭代完成说明

本次修复聊天主区在右侧 dock browser 占用较宽空间时的窄布局问题，并把过程中沉淀出的前端样式 owner 规则落到可触发 skill。

根因有两层：

- 欢迎页使用 `h-full` 且垂直居中，内容高度超过滚动容器时顶部会被推到不可滚动区域之外，导致头像和标题被切掉。
- 欢迎页能力卡片固定三列，输入栏工具条默认展示长文字，窄容器下会挤压主输入区域或形成低质量换行。

修复方式：

- 欢迎页改为 `min-h-full`，空间足够时保持居中，空间不足时让内容自然撑开滚动高度。
- 能力卡片从固定三列改为基于 `auto-fit + minmax` 的自适应 grid。
- 输入栏使用组件自身的 container query，在输入栏容器低于 `440px` 时进入紧凑模式，仅隐藏工具条表面文字，保留图标、当前值可访问标签和下拉内容。
- 紧凑样式留在 `@nextclaw/agent-chat-ui` 输入栏组件内，不写入宿主全局 CSS。
- 新增 `frontend-style-encapsulation` skill，并在 `AGENTS.md` 增加路由，覆盖前端样式、响应式布局、紧凑模式和样式 owner / 可移植性判断。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/agent-chat-ui test -- src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx`：通过，1 个测试文件、22 个用例。
- `pnpm --filter @nextclaw/ui test -- src/features/chat/components/chat-welcome.test.tsx`：通过，1 个测试文件、2 个用例。
- `pnpm --filter @nextclaw/agent-chat-ui tsc`：通过。
- `pnpm --filter @nextclaw/ui tsc`：通过。
- `pnpm --filter @nextclaw/agent-chat-ui exec eslint <触达输入栏文件>`：0 errors，保留既有 props destructuring warning。
- `pnpm --filter @nextclaw/ui exec eslint <触达欢迎页文件>`：通过。
- `pnpm --filter @nextclaw/ui build`：通过，Vite 构建成功；保留既有大 chunk warning。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <触达文件>`：通过，0 errors，2 warnings。

真实登录态聊天页未通过浏览器完成端到端截图验证，因为本机 UI 服务要求认证。已用组件测试、类型检查、targeted lint、governance 和 Vite build 覆盖实现合同；用户可在已登录窗口中复核右侧 dock browser 宽度变化下的实际视觉效果。

## 发布/部署方式

未执行发布、部署或 NPM publish。本次只完成源码修复、规则沉淀、本地测试、类型检查、构建与治理验证。

## 用户/产品视角的验收步骤

1. 打开聊天页，保持空白欢迎态。
2. 将右侧 dock browser 拉宽，使中间聊天主区变窄。
3. 预期欢迎页顶部头像、标题和副标题可正常滚到，不再被切在滚动区域之外。
4. 预期能力卡片按可用宽度变为两列或一列，不再被压成窄竖条。
5. 将输入栏宽度压到极窄，预期技能、模型、思考等工具控制主界面优先展示图标，当前值仍可通过下拉、`aria-label` 或 hover title 理解。
6. 将输入栏宽度恢复到中等窄宽度，预期不会过早进入 icon-only，仍尽量展示有价值文字。

## 可维护性总结汇总

已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 做收尾复核。

本次属于非新增用户能力的 UI 质量修复。生产源码非测试部分净减 1 行；新增测试用于锁定窄布局回归；新增 skill 属于规则沉淀，不计入生产代码复杂度。

正向减债动作：

- 删除欢迎页固定高度和固定三列假设。
- 将输入栏紧凑样式收回组件 owner，避免宿主全局 CSS 对 reusable package 内部结构形成隐式依赖。
- 将触达的输入栏 toolbar 跨目录 parent-relative import 收敛为包内 alias import，满足当前 module contract。

剩余债务：

- `chat-input-bar` 目录已有文件数预算 warning，本次未新增文件，后续可按 toolbar、composer、slash menu 等职责继续拆分。
- `chat-input-bar.test.tsx` 接近测试文件预算，本次只新增回归断言；后续若继续扩展输入栏测试，应拆出 fixtures/builders 或按行为分组拆文件。

## NPM 包发布记录

不涉及 NPM 包发布。
