# Chat 消息时间线排序与重启中断恢复设计

## 背景与问题

会话 `ncp-mshtafzu-bee69c33` 在运行中的 agent 进程被重启后，出现了后发送的用户消息显示在旧 assistant 回复之前的现象。页面看到的顺序为：

```text
17:57:58 user
18:03:02 user
17:58:08 assistant（旧运行遗留）
18:03:08 assistant（新运行）
```

这不是单纯的 CSS、React key 或列表倒序问题。端到端证据表明：

- `17:57:58` 的用户消息启动了旧 run；旧 assistant 在 `17:58:08` 后持续输出，但没有 `message.abort`、`run.finished` 或 `run.error` 终止事件。
- 后端进程在 `17:58:17` 被终止，`17:58:19` 重新启动；内存中的 run owner 因而消失。
- `18:03:02` 的新用户消息启动了新 run，journal 中旧 streaming assistant 与新 run 同时存在。
- conversation state 内部把稳定消息和 `streamingMessage` 分开保存；React、kernel `SessionRun` 与 journal replay 都把 streaming 机械追加到稳定数组末尾。
- message projection 又按收到的数组顺序分配固定 ordinal，于是临时的错误拼接顺序被持久化。

因此，直接在 Chat 列表组件内排序只能遮住当前页面，无法修复 kernel 快照、journal replay、分页 projection 和重启后的历史重建。

## 目标与验收标准

### 目标

- 稳定消息、optimistic 消息与 streaming assistant 统一按 conversation timeline 物化。
- 重启造成旧 run 缺少终止事件时，下一次不同 run 的 `run.started` 能结算旧 streaming assistant，不与新 assistant 合并或覆盖。
- 已被旧 projection 固化的错误 ordinal 自动失效并从 journal 重建。
- UI、kernel 内存快照、journal replay 和分页历史使用同一个时间线语义。

### 可观察验收标准

- 当 streaming assistant 的 timestamp 早于后来用户消息时，展示和快照顺序均为 `旧 user → streaming assistant → 后来 user`。
- journal 中存在 `旧 run streaming → 后来 user → 新 run.started` 时，完整回放保留两个不同 assistant，旧 assistant 结算为 final，新 assistant 独立继续。
- projection 迁移后，历史分页按时间线返回，不再保留旧版本的错误 ordinal。
- 正常单 run 的 streaming、完成、abort、tool call 和 optimistic 消息行为不回归。

## 设计原则与关键取舍

- **单一事实 owner**：消息时间线顺序归 `@nextclaw/ncp-toolkit` conversation state；UI 和 kernel 只消费统一物化结果。
- **信息专家**：已有 `insertMessageByTimeline()` 掌握 timestamp 稳定插入规则，本轮复用它，不再新增第二套 comparator。
- **可预测恢复**：新 run 开始而旧 streaming 尚未终止，代表旧 run 已被新的 session run 事实取代；按现有 `message.abort` 语义结算旧消息并取消未完成 tool，而不是静默丢弃或与新消息合并。
- **journal 为事实源**：projection 仍是可重建索引。通过 projection 版本升级迁移，不在读路径长期保留新旧排序兼容分支。
- **单一路径优先**：删除 React、SessionRun、journal replay 三处平行的末尾追加逻辑，统一调用 conversation timeline materializer。
- **避免协议级过度承诺**：timestamp 只决定展示时间线，不充当 stream cursor 或因果一致性协议；严格无缝重连仍属于 revision/cursor 的长期演进。

关键取舍：旧 run 缺少终止事件时使用与 `message.abort` 一致的 final 结算语义，而不是 error。理由是现有 abort 已定义为“保留可见内容、取消未完成工具、消息可继续作为历史上下文”，也不会向用户伪造一次 provider 错误。

## Owner 与数据流

```text
NCP events / hydrated history
          │
          ▼
DefaultNcpAgentConversationStateManager
  ├─ stable messages
  ├─ streamingMessage
  ├─ run.started supersession settlement
  └─ insertMessageByTimeline()
          │
          ├────────► React visibleMessages
          ├────────► kernel SessionRun snapshot
          └────────► journal replay result
                              │
                              ▼
                   message projection v3
                              │
                              ▼
                         paged history API
```

### Conversation timeline owner

`agent-conversation-state-manager.utils.ts` 已有稳定插入 owner：

```ts
insertMessageByTimeline(
  messages: readonly NcpMessage[],
  message: NcpMessage,
): NcpMessage[]
```

本轮把它从 toolkit 公共入口导出，React 与 kernel 在存在 transient 消息时直接调用。它不修改输入，也不改变 state manager 将 streaming 独立保存的内部合同；同时避免为了“一次条件调用”增加无语义的新 wrapper。

### Superseded run 结算

`handleRunStarted()` 收到不同于当前 active run 的新 run 时，如果仍有 streaming assistant，则先执行现有 abort 结算路径：

1. 保留已生成的文本、reasoning 和工具结果；
2. 未完成 tool invocation 标为 cancelled；
3. streaming assistant 按 timestamp 插入稳定消息；
4. 清理旧 run execution/tool-call 临时状态；
5. 再建立新 active run。

相同 run 的重复或迟到 `run.started` 继续遵循现有 settled-run 防护，不重复结算。

### Projection 迁移

message projection 版本从 `2` 升到 `3`。`readMeta()` 对旧版本返回无效，`listPage()` 按既有重建流程从 journal materialization 生成新 ordinal。迁移是一次性、可观测、可删除的版本边界，不保留兼容读分支。

## 代码落点

- `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-conversation-state-manager.utils.ts`
- `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-conversation-state.manager.ts`
- `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/index.ts`
- `packages/ncp-packages/nextclaw-ncp-react/src/hooks/use-ncp-agent-runtime.ts`
- `packages/nextclaw-kernel/src/managers/session-run.manager.ts`
- `packages/nextclaw-kernel/src/utils/ncp-agent-session-journal.utils.ts`
- `packages/nextclaw-kernel/src/stores/ncp-agent-session-message-projection.store.ts`
- 对应 toolkit、React、kernel 回归测试。

不新增 UI 专用排序 helper，不修改 ChatMessageList，不引入新的 service/manager/factory。

## 非目标

- 本轮不实现 SSE cursor、revision 或服务端事件回放。
- 不对 `POST /send` 做透明重试，避免缺少幂等合同时重复创建消息。
- 不把多进程同时写 projection 的临时文件冲突并入本次排序修复；该问题需要单独确认进程 ownership 合同。
- 不自动重启用户当前运行中的 NextClaw 实例；源码验证使用测试与隔离运行实例。

## 验证方案

### 定向回归

- toolkit：streaming assistant 位于后来 user 之前；新 run 结算旧 orphan assistant，并保留两个 assistant id。
- React：optimistic user 与较早 streaming assistant 同时存在时，`visibleMessages` 顺序正确。
- kernel SessionRun：快照使用统一物化顺序。
- journal：完整回放 `旧 streaming → 后来 user → 新 run` 后内容、id、状态与顺序正确。
- projection：旧版本 meta 失效并重建；分页输出为修复后的时间线顺序。

### 工程验证

- 触达 package 的 TypeScript `tsc`。
- 相关 Vitest 定向测试与 package 全量测试。
- 触达文件 ESLint。
- `lint:new-code:governance`、`check:governance-backlog-ratchet`、maintainability guard。
- 使用隔离临时 home/source runtime 验证真实 messages API，不写入仓库、不重启用户当前实例。

## 可维护性与回滚

本次是非新增用户能力的 bugfix，生产语义代码目标净增不大于 `0`：公开既有 timeline insert owner、增加 supersession 判定，同时删除三处错误拼接和 abort 清理分支。测试与设计文档不计入生产语义门槛。

若需要回滚，恢复 production 代码并把 projection version 回退即可；v3 projection 是可删除缓存，不影响 journal 事实数据。回滚后已经生成的 v3 projection 会因版本不匹配再次按旧逻辑重建。
