# v0.19.28 Chat 新任务按钮宽度稳定

## 迭代完成说明

- 修复聊天侧边栏“新任务”入口刷新后从短状态生长到宽状态的视觉抖动。
- 根因：桌面创建区会在 session type 选项加载前后从单按钮布局切换到主按钮加下拉按钮布局；通用 Button 基类使用 `transition-all`，导致布局宽度变化被动画化。
- 确认方式：检查 `ChatSidebarDesktopToolbar` 的 `w-full` / `flex-1` 条件布局，以及 Button 基类的 transition 设置；补充测试锁定创建按钮不再包含 `transition-all`。
- 修复方式：将 Button 默认动画从 `transition-all` 收敛为 `transition-colors`，保留 hover/focus 颜色反馈，不再动画化宽度等布局属性。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test src/features/chat/components/layout/chat-sidebar.test.tsx`：通过，1 个测试文件 22 个测试通过。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui exec eslint src/shared/components/ui/button.tsx src/features/chat/components/layout/chat-sidebar.test.tsx`：0 errors，1 个既有测试文件长度 warning。
- `pnpm -C packages/nextclaw-ui lint -- src/shared/components/ui/button.tsx src/features/chat/components/layout/chat-sidebar.test.tsx`：被包级既有无关 lint errors 阻塞，错误不来自本次触达文件。
- `curl -fsS http://127.0.0.1:5174/src/shared/components/ui/button.tsx | rg -n 'transition-(all|colors)'`：确认 dev server 实际加载源码包含 `transition-colors`。
- `curl -fsS http://127.0.0.1:5174/src/features/chat/components/layout/chat-sidebar-toolbar.tsx | rg -n 'chatSidebarNewTask|transition-(all|colors)|flex-1 rounded-r-md|w-full'`：确认真实 dev 源码仍存在加载前后宽度布局条件，且按钮动画由 Button 基类控制。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/shared/components/ui/button.tsx packages/nextclaw-ui/src/features/chat/components/layout/chat-sidebar.test.tsx`：通过，0 errors。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。

## 发布/部署方式

- 未发布。
- 本次只是前端源码与测试修复，等待后续统一发布或前端发布批次带出。

## 用户/产品视角的验收步骤

1. 打开 NextClaw 前端聊天页。
2. 刷新页面。
3. 观察左侧桌面侧边栏顶部“新任务”创建区。
4. 预期：runtime 选项加载前后可能仍会发生一次布局重排，但按钮宽度不再出现被动画放大的“从短到宽生长”效果。

## 可维护性总结汇总

- 已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 规则做收尾判断。
- 总代码增减：新增 15 行，删除 1 行，净增 14 行。
- 非测试代码增减：新增 1 行，删除 1 行，净增 0 行，满足非功能改动门槛。
- 正向减债动作：简化。把 Button 默认过渡从全属性收敛到颜色属性，减少未来布局属性被误动画化的风险。
- 已知遗留：`chat-sidebar.test.tsx` 接近文件预算并有既有 `max-lines-per-function` warning，后续适合拆分测试 fixture/builders。

## NPM 包发布记录

不涉及 NPM 包发布。
