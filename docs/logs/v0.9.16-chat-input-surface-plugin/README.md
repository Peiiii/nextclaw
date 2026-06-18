# v0.9.16 Chat Input Surface Plugin

## 迭代完成说明

本次把 chat 输入框的 slash skill 选择能力迁移到通用 input surface plugin 机制，并新增 `@ Panel App` 引用入口。

第一期 `@ Panel App` 只作为输入体验、文本协议和展示层回显：选择候选后在 composer 中形成 `panel_app` token，发送时序列化为普通用户文本 `@panel-app:<appId>`，消息展示层再从该文本协议派生 `panel_app` inline token，并用不同于 skill 的图标与色系展示。本次不新增 `referenced_panel_apps` metadata，不新增 kernel context provider，也不把 Panel App 解析逻辑耦合进输入插件机制。

目录组织同步收敛：业务无关的 input surface 类型和函数式插件原语进入 `packages/nextclaw-agent-chat-ui/src/lib/input-surface/`，默认皮肤菜单进入 `packages/nextclaw-agent-chat-ui/src/components/chat/ui/input-surface/`，NextClaw 产品 adapter 保留在 `packages/nextclaw-ui/src/features/chat/features/input/input-surface-plugins/`。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-agent-chat-ui test -- src/components/chat/ui/chat-input-bar/__tests__/chat-composer.utils.test.ts src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar.test.tsx src/components/chat/ui/chat-input-bar/__tests__/chat-slash-menu.test.tsx`
- `pnpm -C packages/nextclaw-agent-chat-ui test -- src/components/chat/ui/chat-message-list/chat-message-list.test.tsx src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar.test.tsx`
- `pnpm -C packages/nextclaw-ui test -- src/features/chat/features/input/utils/__tests__/chat-composer-state.utils.test.ts src/features/chat/features/input/utils/__tests__/chat-inline-token.utils.test.ts src/features/chat/features/input/input-surface-plugins/__tests__/panel-app-reference-plugin.test.ts src/features/chat/pages/__tests__/ncp-chat-page.test.ts`
- `pnpm -C packages/nextclaw-ui test -- src/features/chat/features/input/utils/__tests__/chat-inline-token.utils.test.ts src/features/chat/features/message/utils/__tests__/chat-message.utils.test.ts`
- `pnpm -C packages/nextclaw-ui test -- src/features/chat/features/message/components/__tests__/chat-message-list.container.test.tsx src/features/chat/pages/__tests__/ncp-chat-page.test.ts src/features/chat/features/input/utils/__tests__/chat-composer-state.utils.test.ts src/features/chat/features/input/input-surface-plugins/__tests__/panel-app-reference-plugin.test.ts`
- `pnpm -C packages/nextclaw-agent-chat-ui tsc`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-agent-chat-ui lint`
- `pnpm -C packages/nextclaw-ui lint`
- `pnpm -C packages/nextclaw-ui build`
- `pnpm lint:maintainability:guard`
- `pnpm clean:generated`
- `git diff --check`

## 发布/部署方式

本次只完成源码实现与本地验证，未执行部署。

## 用户/产品视角的验收步骤

1. 在 chat 输入框输入 `/`，确认 skill 候选、键盘选择和插入行为保持不变。
2. 在 chat 输入框输入 `@`，确认出现 Panel App 候选。
3. 选择某个 Panel App 后继续输入文字并发送，确认发送文本中包含 `@panel-app:<appId>`，且消息气泡内该协议文本被渲染为 `panel_app` inline token，图标与色系不同于 skill token。
4. 确认该操作不会打开 Panel App、授权 client、创建 bridge session 或生成 Panel App 运行 metadata。

## 可维护性总结汇总

已运行 maintainability guard 与治理检查，结果通过；警告仅为既有文件接近预算：`chat-input-bar.test.tsx` 和 `chat-input-bar.container.tsx`。本次是新增用户能力，非测试代码净增长来自新增通用 input surface primitive、产品侧 adapter、`@ Panel App` 搜索与测试覆盖。

正向减债动作：删除 slash menu 内部的大段专用实现，将其收敛为通用 `ChatInputSurfaceMenu` 的兼容 wrapper；`ChatInputBarContainer` 删除 skill-only slash query 构造，改由 `useChatInputSurfaceState` 组装产品侧插件，文件行数从 497 行降到 491 行。

目录结构复核：`nextclaw-solution-design` 已要求方案覆盖目录组织，本次不需要修改该 skill；`packages/nextclaw-agent-chat-ui/module-structure.config.json` 显式允许 `src/lib/`，用于承载跨项目复用的 input surface core。

## NPM 包发布记录

不涉及 NPM 包发布。
