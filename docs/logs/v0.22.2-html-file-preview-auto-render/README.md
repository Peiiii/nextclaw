# v0.22.2 HTML File Preview Viewer Contract

## 迭代完成说明

本次修复右侧工作区打开本地 HTML 文件时 viewer 语义不清的问题。根因分两层：会话中的 `show_file` 实际工具参数没有带 `viewer`，但 AI 回复声称自己用了渲染模式；随后 UI 曾把 HTML 缺省/auto 都解析成 rendered，导致普通 Markdown 文件链接点击后也直接进入渲染视图，和“文件链接默认看源码、渲染必须显式声明”的预期冲突。

修复后，`show_file` 省略 `viewer` 会归一为 `source`；Markdown 文件链接默认也进入源码预览。只有 `show_file(..., viewer: "rendered")` 或 Markdown 链接显式写 `?viewer=rendered` 时，右侧 workspace 才创建 `preview:rendered` tab 并使用 iframe 渲染。同一个 HTML 文件的源码 tab 和渲染 tab 继续使用不同 tab identity，可以同时存在。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel exec vitest run src/tools/show-content.tools.test.ts`
- `pnpm -C packages/nextclaw-kernel exec vitest run src/tools/show-content.tools.test.ts src/contributions/context-provider/providers/reply-format-context.provider.test.ts src/contributions/context-provider/providers/context-provider-contract.provider.test.ts`
- `pnpm -C packages/nextclaw-ui exec vitest run src/features/chat/managers/__tests__/chat-thread.manager.test.ts src/features/chat/features/workspace/components/__tests__/chat-session-workspace-file-preview.test.tsx src/features/chat/features/workspace/utils/__tests__/chat-workspace-panel-view-model.utils.test.ts`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-agent-chat-ui exec vitest run src/components/chat/ui/chat-message-list/__tests__/chat-message-markdown.test.tsx`
- `pnpm -C packages/nextclaw-agent-chat-ui tsc`
- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw-agent-chat-ui lint`
- `pnpm -C packages/nextclaw-core lint`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-ui lint`
- `git diff --check`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <本次相关文件>`
- `pnpm lint:new-code:governance -- <本次相关文件>`
- `pnpm check:governance-backlog-ratchet`
- 全量 `pnpm lint:new-code:governance` 当前被工作区无关改动拦住：`packages/ncp-packages/nextclaw-ncp-http-agent-server/src/parsers.ts` 和 `packages/ncp-packages/nextclaw-ncp/src/types/events.ts` 的命名/角色边界问题不属于本次改动范围。
- 浏览器验收：在 `http://127.0.0.1:5174/chat/sid_bmNwLW1yN3I3bjZ4LWZkZGZiYzky` 点击普通 HTML Markdown 链接后，右侧 workspace 打开源码预览，`iframe[data-testid="workspace-html-preview"]` 为 0，`[data-file-code-surface="true"]` 为 1。
- 浏览器验收：在同一页面注入源码/渲染两个 workspace tab 做 DOM 冒烟，两个 tab 使用不同 key 同时存在；渲染 tab 显示 iframe，源码 tab 显示 code surface；tab 标题只保留用户标题或文件名，不额外显示 `源码` / `渲染` tag。

## 发布/部署方式

无需单独部署。本次改动进入 `@nextclaw/kernel` 与 `@nextclaw/ui` 后，随下一次常规 NPM/桌面发布带出。

## 用户/产品视角的验收步骤

1. 让 AI 生成或引用一个本地 `.html` 文件。
2. 点击普通本地 HTML 文件 Markdown 链接时，右侧应打开源码预览。
3. 点击带 `?viewer=rendered` 的 HTML 文件 Markdown 链接时，右侧应打开渲染预览。
4. AI 需要主动展示 HTML 效果时，必须调用 `show_file` 并显式传入 `viewer: "rendered"`。
5. 同一个 HTML 文件的源码预览和渲染预览应使用不同 tab，不互相覆盖；tab 标题保持用户给定标题或文件名，不额外加 `源码` / `渲染` tag。

## 可维护性总结汇总

本次把默认策略放回两个真实 owner：kernel 负责给工具请求明确 `source` 合同，agent-chat-ui 负责从 Markdown 链接 query 解析显式 viewer，UI workspace manager/preview 负责按 viewer 选择具体展示方式。没有新增工具别名或专用 HTML 特判通道；预览 tab identity 继续使用既有 `preview:rendered` 机制。

新增测试覆盖工具归一化、Markdown `?viewer=rendered`、项目根相对 HTML 链接、HTML 默认源码、显式 rendered 和源码/渲染 tab 共存。tab 展示层不暴露内部 viewer 状态，避免为了协议细节增加视觉噪音。

可维护性守卫结果：总变更 `+198 / -33 / net +165`，非测试变更 `+18 / -31 / net -13`。正向减债动作是简化：把 Markdown 本地文件扩展名从数组拼接收成正则合同常量，并把 HTML preview 的默认 source 判定压回 workspace manager 的单一路径；没有新增并行 viewer 通道或 UI tag 组件。

## NPM 包发布记录

- 涉及包：`@nextclaw/agent-chat-ui`、`@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/ui`
- 发布状态：待下一次统一 NPM/桌面发布带出
- Changeset：`.changeset/html-file-preview-auto-render.md`
