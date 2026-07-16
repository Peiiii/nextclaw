# v0.23.15 窄屏会话历史加载与标题切换

## 迭代完成说明

- 修复窄屏布局首次从会话列表进入已有会话时，历史消息可能被清空、详情页显示为空的问题。
- 端到端证据确认：窄屏 `/chat` 与 `/chat/:sessionId` 使用不同页面分支，进入详情时 hydration hook 会先收到空 `sessionId`，随后收到目标会话；旧的空会话 reset 在等待 `client.stop()` 之后才清理本地状态，因此可能晚于目标会话 hydration 完成并把新消息再次清空。
- 修复留在现有 `useHydratedNcpAgent` 生命周期 owner：空会话 reset 在进入异步边界前先失效旧请求并清理本地状态，`client.stop()` 晚返回时不再写本地状态。
- 窄屏会话详情标题现在复用桌面侧栏收起时的会话切换器，支持查看、搜索并切换已有会话；选择动作继续走 `ChatSessionListManager -> ChatUiManager.goToSession` 唯一路由链路。
- 没有增加移动端专用列表、fallback、第二套加载路径、新 owner 或辅助抽象。

## 测试/验证/验收方式

- 修前回归基线：新增竞态测试，控制两次 `client.stop()` 逆序完成；旧实现中目标会话完成 hydration 后，较早的空会话 reset 晚返回会把消息从 `[historyMessage]` 清成 `[]`。
- `pnpm -C packages/nextclaw-ui exec vitest run src/features/chat/components/conversation/__tests__/chat-conversation-header-section.test.tsx src/features/chat/components/conversation/__tests__/chat-conversation-header.test.tsx src/features/chat/components/layout/__tests__/chat-page-shell.test.tsx src/features/chat/features/ncp/hooks/__tests__/use-hydrated-ncp-agent.test.tsx`：通过，4 files / 16 tests。
- `pnpm -C packages/ncp-packages/nextclaw-ncp-react tsc`：通过。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/ncp-packages/nextclaw-ncp-react lint`：0 error；2 条既有 warning 位于 `ncp-attachments.ts`。
- `pnpm -C packages/nextclaw-ui lint`：0 error；1 条既有 warning 位于 `cron-config.tsx`。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `post-edit-maintainability-guard`：0 error、0 warning。
- 真实窄屏冒烟：复用 `http://127.0.0.1:5174` 当前源码开发实例，将浏览器视口设为 `390 x 844`；从 `/chat` 点击已有会话后，标题显示“切换会话”按钮，展开可见搜索框与会话列表；选择另一会话后 URL、标题和消息内容同步切换，弹层关闭，控制台无错误。
- 未运行生成物清理：工作区已有不属于本修复的 UI 构建产物改动，避免覆盖并行工作。

## 发布/部署方式

- 本轮按用户要求以 scoped commit 收口；未执行 push、部署、NPM 发布或 GitHub release。
- 不涉及数据库 migration、后端部署、服务重启或远程 API 冒烟。
- 本批变更将通过 `.changeset/mobile-session-history-loading.md` 随后续统一发布带出。

## 用户/产品视角的验收步骤

1. 将 NextClaw 窗口缩窄到移动端布局，进入会话列表。
2. 点击一个已有历史消息的会话。
3. 确认页面进入对应会话详情，既有消息正常显示，不出现空白内容区。
4. 点击详情页标题，确认下拉面板展示搜索框和已有会话。
5. 搜索或直接选择另一个会话，确认路由、标题和消息内容切换到目标会话，面板自动关闭。
6. 返回列表后再进入其他已有会话，确认各会话历史仍与所选会话一致。

## 可维护性总结汇总

- 实现与测试代码合计新增 74 行、删除 8 行，净增 66 行；净增长全部来自竞态与移动端交互回归测试。
- 非测试生产代码新增 6 行、删除 6 行，净增 0 行。
- 正向减债动作：把本地状态失效与清理移动到异步边界之前，消除晚返回任务继续改写新会话状态的时序窗口；移动端直接复用现有标题切换器和统一选择 manager，没有复制列表与路由逻辑。
- 生产代码没有新增条件分支、文件、目录、helper、wrapper 或 owner；组件类型、key 与父级结构均未改变。
- `post-edit-maintainability-review` 结论：通过；修复保持单一 hydration 主链路，no maintainability findings。

## NPM 包发布记录

- `@nextclaw/ncp-react`：需要 patch，待统一发布。
- `@nextclaw/ui`：需要 patch，待统一发布。
- Changeset：`.changeset/mobile-session-history-loading.md`。
- 本次未执行 NPM 发布。
