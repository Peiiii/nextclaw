# v0.22.14 Chat 设置菜单焦点稳定性修复

## 迭代完成说明

本次修复 chat 流式输出期间点击左下角设置菜单后，菜单短暂出现又立刻关闭的问题。

根因不是输入框内容变化，而是 streaming 期间 chat composer 会把浏览器 DOM focus 恢复到 `contenteditable` 输入区域。Radix Popover 会把这个焦点转移判断为 `focusOutside`，于是触发外部焦点关闭，导致用户刚打开的设置菜单被误关。

确认方式：

- 在真实 chat 页面点击 `Settings menu` 后，程序性 focus 到 `.nextclaw-chat-input-bar-shell [role="textbox"][contenteditable="true"]`，修复前菜单会被关闭。
- 额外验证真实点击输入框仍会关闭菜单，避免把正常外部点击关闭行为一并拦掉。

修复方式：

- 在 `ChatSidebarUtilityMenu` 的 `PopoverContent` 中只拦截目标为 chat composer 的 `onFocusOutside`，保留 pointer/click outside 的默认关闭语义。
- 删除 Docs/Apps 菜单项重复 handler 与重复 JSX，统一成同一组 action item 渲染，保持本次非功能修复的生产代码净减。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test src/features/chat/components/layout/__tests__/chat-sidebar.test.tsx src/features/chat/components/layout/__tests__/chat-sidebar-utility-menu.test.tsx`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui lint`
- Playwright 真实页面冒烟：打开设置菜单后程序性 focus 到 composer，菜单仍保持打开；随后真实点击 composer，菜单关闭。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/features/chat/components/layout/chat-sidebar-utility-menu.tsx packages/nextclaw-ui/src/features/chat/components/layout/__tests__/chat-sidebar-utility-menu.test.tsx`

## 发布/部署方式

不涉及部署。该修复进入常规前端构建产物后随下一次 UI/桌面发布带出。

## 用户/产品视角的验收步骤

1. 打开一个正在流式输出的 chat 会话。
2. 在流式输出过程中点击左下角设置按钮。
3. 设置菜单应保持打开，不应出现“闪一下就关闭”。
4. 继续点击输入框或页面外部区域时，设置菜单仍应正常关闭。

## 可维护性总结汇总

- 已使用 post-edit maintainability guard 做定向检查：2 个触达文件，0 error，0 warning。
- 非测试生产代码 `+29/-30`，净减 1 行，满足非功能修复不增加生产语义代码的约束。
- 本次修复没有新增状态 owner、全局开关或额外生命周期；只在 popover owner 内处理它自己的外部焦点关闭语义。
- 同步删除 Docs/Apps 菜单项重复 handler，减少同一 action 后关闭菜单的重复表达。

## NPM 包发布记录

本次不直接执行 NPM 发布，但属于用户可见 UI bugfix，已新增 `.changeset/chat-settings-menu-focus.md`，标记 `@nextclaw/ui` patch，等待后续统一发布带出。
