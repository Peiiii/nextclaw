# 2026-08-07 v0.26.66-chat-message-timeline-ordering

## 迭代完成说明

- 修复 agent 运行中断或后端重启后，较早的 streaming assistant 被展示在后来 user 消息之后的问题。
- 真实会话证据确认旧 run 没有 `message.abort`、`run.finished` 或 `run.error` 终止事件；进程重启后，新 user 与新 run 进入同一 journal。
- 直接根因是 React、kernel `SessionRun` 和 journal replay 都把独立保存的 `streamingMessage` 机械追加到稳定消息末尾；projection 随后把错误顺序固化为 ordinal。
- toolkit 既有 `insertMessageByTimeline` 现在作为唯一公开排序 owner；optimistic、streaming、SessionRun 与 journal replay 都复用同一稳定插入规则。
- 新 run 开始时会按现有 abort 语义结算不同旧 run 遗留的 streaming assistant，保留已生成内容并避免与新 assistant 合并；message projection 升级到 v3，从 journal 自动重建旧索引。
- 方案设计见 `docs/designs/2026-08-07-chat-message-timeline-ordering.design.md`。

## 测试/验证/验收方式

- 定向 Vitest：toolkit timeline/settlement 5/5、kernel SessionRun/journal/projection/recovery 27/27、React runtime 7/7，共 39/39 通过。
- package 全量测试：`@nextclaw/ncp-toolkit` 42/42 通过；kernel 245/249、UI 845/865，剩余失败位于当前脏工作区已有的 ContextProvider、MessagingToolProvider、activity preview、QueryClient 测试夹具与 workspace/sidebar 文案或 query-key 漂移，不触达本次文件。
- TypeScript：`@nextclaw/ncp-toolkit`、`@nextclaw/ncp-react`、`@nextclaw/kernel`、`@nextclaw/ui` 均通过。
- Production build：`@nextclaw/ncp-toolkit`、`@nextclaw/ncp-react`、`@nextclaw/kernel`、`@nextclaw/ui` 均通过。
- ESLint：全部本次触达源码与测试为 0 error、0 warning；toolkit/ncp-react 全包只有未由本次引入的既有 warning。
- 真实 journal 只读回放：会话 `ncp-mshtafzu-bee69c33` 共恢复 26 条消息，目标顺序为 `17:57:58 user → 17:58:08 assistant(final) → 18:03:02 user → 18:03:08 assistant(final)`。
- 将同一真实 journal 复制到临时目录后触发 projection v3 重建，返回总数 26、目标顺序完全一致；临时目录已清理，真实 session 数据未被改写。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、`git diff --check` 与 `pnpm release:summary -- --json` 均通过；`pnpm clean:generated` 确认没有需保留或清理的 tracked 构建产物。

## 发布/部署方式

- 本次源码、测试、changeset、设计文档与迭代记录随当前本地提交纳入版本历史；未推送、未发布、未部署。
- 没有重启当前 5174/18792 NextClaw 实例；真实数据验收使用当前源码的只读 replay 与隔离 projection 重建，不影响正在运行的任务。
- 本轮不涉及数据库 migration、线上 API 或远程部署。

## 用户/产品视角的验收步骤

1. 在下一次正常重启或源码实例加载后打开原会话。
2. 确认 `01:57:58` 用户消息之后先显示 `01:58:08` 的旧助手回复，再显示 `02:03:02` 的“？”。
3. 确认旧助手内容仍保留，状态不再持续转圈，也没有与 `02:03:08` 的新助手回复合并。
4. 刷新页面或重新进入会话，确认历史顺序保持一致且没有重复消息。

## 可维护性总结汇总

- `post-edit-maintainability-guard --non-feature` 通过：10 个源码/测试文件总计 `+387 / -16 / net +371`，非测试语义代码 `+16 / -16 / net 0`，无需 line-growth exemption。
- 正向减债动作是复用既有 timeline insert owner，删除三处末尾追加的平行排序假设，并把 abort tool-call 清理分支收敛为单一路径；没有新增 production helper、service、manager、factory 或兼容分支。
- toolkit conversation state manager 从 600 行降到 599 行；测试进入既有 `__tests__/` 角色目录，避免 agent scope root 触及文件数预算。
- 守卫只保留三个接近文件预算的趋势 warning：conversation state manager 599/600、message projection store 358/400、journal utils 383/400。本次没有让这些文件净增长；后续只有出现新的独立职责或第二个消费者时再按 owner 拆分，避免空心抽象。
- 主观复核结论：排序事实收敛到唯一 owner，projection 继续是 journal 的可重建派生数据，重启中断采用明确生命周期边界；无可维护性阻塞项。

## NPM 包发布记录

- 已新增 `.changeset/chat-message-timeline-ordering.md`，登记 `@nextclaw/ncp-toolkit`、`@nextclaw/ncp-react`、`@nextclaw/kernel`、`@nextclaw/ui` 与产品包 `nextclaw` 的 patch 变更。
- `@nextclaw/server` 与 `@nextclaw/service` 仅消费 kernel/toolkit 的现有公共合同，本次没有源码、协议或发布内容变化，不单独登记 patch。
- 当前状态：待后续统一发布；本轮不执行 NPM release。
