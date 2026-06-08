# v0.20.50-chat-sticky-scroll-lifecycle

## 迭代完成说明

本次围绕聊天消息列表偶发滚动异常做小范围滚动生命周期优化。

- `packages/nextclaw-agent-chat-ui/src/components/chat/hooks/use-sticky-bottom-scroll.ts`
  - 将 sticky-bottom 的 rAF 调度职责收回 hook owner 内部。
  - unmount cleanup 改为读取当前 `scheduledScrollFrameRef.current` 并取消，避免只捕获 mount 时的旧 frame id。
  - 删除单行单用的 `scrollElementToBottom` helper，减少跨 helper 的状态修改和心智负担。
- `packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.tsx`
  - 给主会话滚动容器增加 `data-chat-scroll-container="true"`，用于真实 DOM 定位和组件测试断言。
- `packages/nextclaw-agent-chat-ui/src/components/chat/hooks/use-sticky-bottom-scroll.test.tsx`
  - 新增 hook 测试，覆盖 unmount 时取消当前排队 rAF。
- `packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.test.tsx`
  - 补充断言，确认消息列表挂在主会话滚动容器下。

根因未完全定位：真实浏览器里的偶发 wheel 失效无法稳定复现。本次修复的是代码中已确认存在的生命周期风险点，而不是声称已经证明浏览器现场问题的唯一根因。内层 reasoning/file/tool 局部滚动保持不变，不牺牲既有阅读体验。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-agent-chat-ui exec vitest run src/components/chat/hooks/use-sticky-bottom-scroll.test.tsx src/components/chat/ui/chat-message-list/chat-message-list.test.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-list.file-operation.test.tsx`
  - 结果：3 个测试文件通过，28 个测试通过。
- `pnpm -C packages/nextclaw-agent-chat-ui tsc`
  - 结果：通过。
- `pnpm -C packages/nextclaw-ui tsc`
  - 结果：通过。
- `pnpm exec eslint packages/nextclaw-agent-chat-ui/src/components/chat/hooks/use-sticky-bottom-scroll.ts packages/nextclaw-agent-chat-ui/src/components/chat/hooks/use-sticky-bottom-scroll.test.tsx packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.tsx packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.test.tsx`
  - 结果：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
  - 结果：通过；非测试代码净减 3 行。
- `pnpm check:governance-backlog-ratchet`
  - 结果：通过。
- `pnpm check:generated-clean`
  - 结果：通过。

未执行真实浏览器 smoke：用户明确认为这类偶发问题测不出来，本次按单测、类型、lint、治理和可维护性替代验证收尾。

`pnpm lint:new-code:governance` 当前被工作区中非本次触达的 `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-markdown.tsx` 参数 mutation 阻塞，未作为本次滚动修复范围处理。

## 发布/部署方式

不涉及部署、数据库 migration 或运行时配置变更。若本批次进入前端/NPM 发布，随正常包发布流程带出即可。

## 用户/产品视角的验收步骤

1. 打开聊天会话并进入有较多消息内容的会话。
2. 定位主消息滚动容器：`[data-chat-scroll-container="true"]`。
3. 滚动消息列表，观察 wheel 是否作用于主会话滚动容器。
4. 展开 reasoning/file/tool 局部内容，确认内层滚动体验仍保留。

## 可维护性总结汇总

已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 口径复核。总计新增 93 行、删除 57 行、净增 36 行；排除测试后新增 54 行、删除 57 行、净减 3 行。

正向减债动作：简化。调度逻辑回到 `useStickyBottomScroll` 这个生命周期 owner 内部，删除单行 helper，并避免普通 helper 修改入参。没有新增 UI 层级、没有新增 fallback、没有改变嵌套滚动体验。

## NPM 包发布记录

需要随统一发布流程发布 patch：

- `@nextclaw/agent-chat-ui`：sticky-bottom scroll lifecycle cleanup 行为修复，待统一发布。
- `@nextclaw/ui`：主会话滚动容器增加稳定 DOM 语义属性，待统一发布。
