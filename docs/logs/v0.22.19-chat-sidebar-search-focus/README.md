# v0.22.19 Chat 侧栏搜索焦点修复

## 迭代完成说明

本次修复 chat 侧栏“搜索对话”输入框点击后无法稳定获得焦点的问题。

根因不是外层输入框抢焦点，也不是搜索 input 自己主动 blur，而是输入框左侧的 `Search` 装饰图标覆盖在 input 的可点击区域上，并且没有设置 `pointer-events-none`。用户点到图标区域时，点击命中 svg 而不是 input，浏览器焦点会落回页面主体，看起来就像输入框刚 focus 又 blur。

确认方式：

- Playwright 在真实 `/chat` 页面点击搜索输入框中部时，`document.activeElement` 能保持为搜索 input。
- Playwright 点击搜索输入框左侧图标覆盖区域时，修复前 active element 为 `BODY`；修复后 active element 为搜索 input。

修复方式：

- 为桌面 `ChatSidebarDesktopToolbar` 和移动 `ChatSidebarMobileToolbar` 中的搜索装饰图标补上 `pointer-events-none`。
- 在 `chat-sidebar-toolbar.test.tsx` 中固定该交互约束，避免后续再把输入框内部装饰图标变成鼠标命中目标。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test src/features/chat/components/layout/__tests__/chat-sidebar.test.tsx src/features/chat/components/layout/__tests__/chat-sidebar-toolbar.test.tsx`：通过，2 个测试文件 / 26 个测试。
- Playwright 真实页面冒烟：打开 `http://127.0.0.1:5176/chat`，点击搜索输入框左侧图标覆盖区域后，`document.activeElement` 为 placeholder 等于 `Search conversations...` 的 input。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui lint`：通过；保留 1 条既有 warning：`chat-thread.manager.test.ts` 文件行数超过 800，非本次触达文件。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/features/chat/components/layout/chat-sidebar-toolbar.tsx packages/nextclaw-ui/src/features/chat/components/layout/__tests__/chat-sidebar-toolbar.test.tsx`：通过，0 error / 0 warning，非测试代码 `+2/-2`，净增 0。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。

## 发布/部署方式

不涉及单独部署。该修复进入 `@nextclaw/ui` 前端构建产物后，随下一次 UI/桌面发布带出。

## 用户/产品视角的验收步骤

1. 打开 chat 页面。
2. 点击左侧会话列表顶部“搜索对话”输入框的放大镜图标区域。
3. 输入框应立即获得焦点，键盘输入应进入搜索框。
4. 在移动布局下重复上述步骤，行为应一致。

## 可维护性总结汇总

- 已使用 post-edit maintainability guard 做定向检查：2 个触达文件，0 error，0 warning。
- 本次是用户可见 bugfix，生产代码保持 `+2/-2`，非测试净增 0 行。
- 没有新增状态、effect、全局焦点捕获或特殊兜底；只把装饰图标从点击命中链路中移除，焦点 owner 仍然是原 input。
- 定向测试放入独立 toolbar 测试文件，避免继续撑大已经到预算线的 `chat-sidebar.test.tsx`。

## NPM 包发布记录

本次不直接执行 NPM 发布，但属于用户可见 UI bugfix，已新增 `.changeset/chat-sidebar-search-focus.md`，标记 `@nextclaw/ui` patch，等待后续统一发布带出。
