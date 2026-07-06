# v0.22.12 Workspace File Refresh

## 迭代完成说明

本次为会话工作区右侧文件预览增加了刷新入口。用户打开文件预览后，可以在右上角工具区点击刷新图标，重新读取当前文件内容；如果当前文件以 HTML 渲染预览展示，刷新也会让 iframe 使用新的刷新版本重新加载，避免文件路径不变时浏览器继续使用旧内容。

实现上沿用现有工作区顶部操作区，不新增单独工具栏。刷新状态只保存在 `ChatSessionWorkspacePanel` 的本地 UI 状态里：源码预览通过失效 `useServerPathRead` 的 React Query key 重新读文件；渲染预览通过传入递增的 `refreshVersion` 给 HTML iframe URL 添加刷新参数。该状态不写入会话 store，也不改变 tab identity。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui exec vitest run src/features/chat/features/workspace/components/__tests__/chat-session-workspace-panel.test.tsx src/features/chat/features/workspace/components/__tests__/chat-session-workspace-panel-content.test.tsx src/features/chat/features/workspace/components/__tests__/chat-session-workspace-file-preview.test.tsx`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui lint`
- `git diff --check`
- `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/shared/hooks/use-server-path-read.ts packages/nextclaw-ui/src/features/chat/features/workspace/components/chat-session-workspace-panel.tsx packages/nextclaw-ui/src/features/chat/features/workspace/components/chat-session-workspace-panel-nav.tsx packages/nextclaw-ui/src/features/chat/features/workspace/components/chat-session-workspace-panel-content.tsx packages/nextclaw-ui/src/features/chat/features/workspace/components/chat-session-workspace-file-preview.tsx packages/nextclaw-ui/src/shared/lib/i18n/locales/en-US/chat.json packages/nextclaw-ui/src/shared/lib/i18n/locales/zh-CN/chat.json packages/nextclaw-ui/src/features/chat/features/workspace/components/__tests__/chat-session-workspace-panel.test.tsx packages/nextclaw-ui/src/features/chat/features/workspace/components/__tests__/chat-session-workspace-panel-content.test.tsx packages/nextclaw-ui/src/features/chat/features/workspace/components/__tests__/chat-session-workspace-file-preview.test.tsx`
- `pnpm check:governance-backlog-ratchet`
- 浏览器冒烟：在 `http://127.0.0.1:5174/chat/sid_bmNwLW1yN3I3bjZ4LWZkZGZiYzky` 打开右侧文件预览，确认存在 `刷新文件` 按钮，点击后 `/api/server-paths/read` 请求从 1 次增至 2 次，且仍保持源码预览而不是误切到 HTML iframe。

## 发布/部署方式

无需单独部署。本次改动进入 `@nextclaw/ui` 后随下一次常规 NPM/桌面发布带出。

## 用户/产品视角的验收步骤

1. 在会话里打开一个右侧工作区文件预览。
2. 修改同一个文件的本地内容，或等待工具链写入新的文件内容。
3. 点击右上角刷新图标。
4. 确认当前 tab 保持不变，源码预览重新读取文件；如果该 tab 是 HTML 渲染预览，则页面重新加载新内容。
5. 切到非文件 tab 时确认不会显示文件刷新按钮。

## 可维护性总结汇总

本次是新增用户可见能力，允许必要的非测试代码增长。实现没有把刷新状态持久化到 workspace store，也没有新增平行的读文件 API；读文件 query key 抽出为共享函数，确保组件刷新和 hook 使用同一个缓存合同。HTML 渲染刷新只追加版本参数，不改变 viewer 判定和文件 tab identity。

`post-edit-maintainability-guard --paths ... --no-fail --json` 通过且无 findings；但当前 touched paths 的行数统计包含本次开始前已经存在的 workspace panel 最大化改动和对应未跟踪测试，因此不能把该统计当作刷新按钮的纯净增量。针对本次刷新范围，已使用定向测试、`tsc`、`lint`、`git diff --check`、scoped governance 和浏览器冒烟验证行为。`post-edit-maintainability-review` 结论：刷新实现 owner 清晰，复用现有顶部操作区、React Query 缓存和文件预览链路，没有新增持久状态或重复数据源；剩余风险是后续提交时必须用精确路径或精确 hunk，避免把最大化面板 WIP 混入刷新按钮提交。

## NPM 包发布记录

- 涉及包：`@nextclaw/ui`
- 发布状态：待下一次统一 NPM/桌面发布带出
- Changeset：`.changeset/workspace-file-refresh.md`
