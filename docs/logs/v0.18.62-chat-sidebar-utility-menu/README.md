# v0.18.62 Chat Sidebar Utility Menu

## 迭代完成说明

- 将聊天主侧栏左下角平铺的设置、帮助文档、主题和语言入口收敛为单个设置菜单入口。
- 主题和语言在一级菜单中只显示当前值，候选项进入各自选择器，避免低频偏好项在一级菜单平铺膨胀。
- 二级选择器改为右侧紧凑子菜单形态，箭头方向与弹出方向一致；统一菜单文字为 13px，并修复二级选择器关闭后父菜单残留的问题。
- 新增 `ChatSidebarUtilityMenu` 单职责组件，主 `ChatSidebar` 只保留菜单状态和业务状态接线。
- 更新侧栏测试，覆盖菜单展开、帮助文档入口和主题切换入口。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/ui test -- src/features/chat/components/layout/chat-sidebar.test.tsx`
- `pnpm --filter @nextclaw/ui exec eslint src/features/chat/components/layout/chat-sidebar.tsx src/features/chat/components/layout/chat-sidebar-utility-menu.tsx src/features/chat/components/layout/chat-sidebar.test.tsx src/shared/lib/i18n/index.ts`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/features/chat/components/layout/chat-sidebar.tsx packages/nextclaw-ui/src/features/chat/components/layout/chat-sidebar-utility-menu.tsx packages/nextclaw-ui/src/features/chat/components/layout/chat-sidebar.test.tsx`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- Playwright 打开 `http://127.0.0.1:5177/chat`，确认存在一个 `Settings menu` 按钮；展开后一级菜单只显示 `Settings`、`Help Docs`、`Theme / Warm`、`Language / English`，`Cool` 默认不在一级菜单里，点击 `Theme` 选择器后才出现。
- Playwright 复验二级菜单：触发器右侧文字为 `13px`，`Cool` 选项浮层宽度约 `99px`，打开二级菜单后点击外部可将父子浮层全部关闭。

## 发布/部署方式

- 本次只改前端源码与测试，未执行发布或部署。

## 用户/产品视角的验收步骤

- 进入聊天主界面。
- 观察桌面侧栏左下角只有一个设置入口，而不是四个常驻操作行。
- 点击设置入口，弹出菜单中可以进入完整设置、打开帮助文档；主题和语言以二级选择器切换。
- 打开主题或语言二级菜单时，候选项在右侧紧凑展示；点击外部区域后所有相关菜单关闭。

## 可维护性总结汇总

- 已使用 `post-edit-maintainability-guard`。首轮 guard 发现把菜单内联进 `chat-sidebar.tsx` 会让文件跨过 500 行预算，随后拆出 `chat-sidebar-utility-menu.tsx`，使主侧栏文件从 406 行降到 388 行。
- Guard 最终无 error；保留 warning：`chat-sidebar.test.tsx` 接近文件预算，`ChatSidebar` 函数仍超过函数长度预算但本次已从 219 行下降到 205 行；共享 `ui` 目录仍是既有目录预算 warning，本次未新增该目录文件。
- 本次正向维护动作是职责收敛与拆分：弹层菜单展示逻辑进入独立组件，主侧栏继续负责列表、状态接线和布局。

## NPM 包发布记录

不涉及 NPM 包发布。
