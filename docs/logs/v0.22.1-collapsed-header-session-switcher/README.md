# v0.22.1 Collapsed Header Session Switcher

## 迭代完成说明

本次在会话页 header 的当前会话标题处补充了折叠左栏场景下的会话切换入口。当桌面端左侧栏处于收起状态时，已有会话标题和新会话草稿态的 `新任务` 标题都会变成可点击的 popover 触发器，popover 内展示最近会话、支持本地搜索，并调用既有 `chatSessionListManager.selectSession` 完成切换；左栏展开或移动端仍保持原来的纯标题行为。

新增的标题切换器只承接折叠态补位，不复刻 sidebar 的编辑、分组和工具栏能力。会话列表仍复用 NCP 会话列表视图，并通过显式 `query` override 避免被隐藏的 sidebar 搜索词过滤。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- src/features/chat/components/conversation/__tests__/chat-conversation-header-section.test.tsx src/features/chat/features/ncp/hooks/__tests__/use-ncp-session-list-view.test.tsx`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/ui lint`
- `pnpm --filter @nextclaw/ui build`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`

## 发布/部署方式

无需单独部署。本次改动进入 `@nextclaw/ui` 后随下一次常规 NPM/桌面发布带出。

## 用户/产品视角的验收步骤

1. 进入已有会话的聊天页。
2. 收起左侧栏。
3. 点击 header 中当前会话标题；也可以在新会话草稿页点击 `新任务` 标题。
4. 在弹出的最近会话列表中输入关键字，确认列表按会话 key、标签、项目名或项目路径过滤。
5. 选择另一个会话，确认页面切换到目标会话。
6. 展开左侧栏后确认 header 标题恢复为纯标题，不出现重复切换入口。

## 可维护性总结汇总

本次把折叠态会话切换能力封装在 `ChatSessionTitleSwitcher`，由外层组件先判断桌面折叠态，再按需挂载真正读取会话列表的 popover，避免 expanded/mobile 场景产生额外查询订阅。搜索状态只保留在 popover 内部，并通过 `useNcpSessionListView({ query })` 复用既有会话过滤合同，不污染 sidebar 搜索状态。基础 header 只新增 `titleContent` 插槽，保持布局 owner 纯展示；会话切换仍通过现有 manager，不新增第二套选择状态。

`post-edit-maintainability-guard` 通过，无阻塞项；保留 1 个测试文件增长警告，后续拆分缝是把 `chat-conversation-header-section.test.tsx` 的 fixture/builder 与行为断言分离。`post-edit-maintainability-review` 结论：通过；本次是新增用户可见能力，非测试代码净增长集中在一个按需挂载的业务组件、一个 header 插槽和一个会话列表 query override，没有新增平行状态链路或 sidebar 复制实现。

## NPM 包发布记录

- 涉及包：`@nextclaw/ui`
- 发布状态：待下一次统一 NPM/桌面发布带出
- Changeset：`.changeset/collapsed-header-session-switcher.md`
