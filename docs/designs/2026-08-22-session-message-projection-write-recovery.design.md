# 会话消息投影写入失败恢复设计

## 1. 状态

- 日期：2026-08-22
- 状态：Design Ready
- 风险：L3，涉及 Windows 文件系统、会话持久化投影、分页读取与失败恢复
- 实现 owner：`NcpAgentSessionMessageProjectionStore`
- 事实源：NCP session JSONL journal
- 关联设计：[会话消息分页与动态高度虚拟时间线设计](./2026-07-18-chat-message-virtual-timeline.design.md)

## 2. 问题描述

Windows 用户在长会话中遇到以下错误：

```text
EPERM: operation not permitted, rename
<session>/.message-projections/<session-id>/meta.json.<pid>.<uuid>.tmp
->
<session>/.message-projections/<session-id>/meta.json
```

消息投影由三个派生文件组成：

```text
.message-projections/<session-id>/
  messages.jsonl
  offsets.idx
  meta.json
```

`messages.jsonl` 保存消息快照，`offsets.idx` 保存 ordinal 到字节位置的索引，`meta.json` 是投影的提交清单，记录版本、稳定消息数、已处理 journal byte offset、数据长度、context window、活动消息和待处理压缩消息。正常写入先推进 data/index，最后通过同目录临时文件原子替换 `meta.json`。

当前缺口是：

1. 同一会话的 `synchronize`、context window 更新和分页读取没有共享一个操作顺序 owner，可能竞争同一个 meta 或观察中间提交态。
2. Windows 上目标文件被杀毒软件、索引器或其它短暂文件句柄占用时，`rename` 可能返回 `EPERM`、`EACCES` 或 `EBUSY`；当前没有有限重试。
3. `writeMeta` 失败后不会清理本次临时文件，现场因此保留了 `.tmp`。
4. projection 是可重建缓存，但其存储错误会继续向上传播，可能让已经成功追加的 journal、session summary 发布或 agent run 被缓存错误干扰。
5. projection 缺失或无效时当前读取会尝试重建；如果 projection 根目录持续不可写，UI 没有纯读的 journal 降级路径。

## 3. 现场证据与判断边界

用户提供的正式 `meta.json` 与失败遗留临时文件属于同一 session、同一 projection v6、同一 context compaction checkpoint：

| 字段 | 后续正式 meta | 失败遗留 temp |
| --- | ---: | ---: |
| `total` | 304 | 303 |
| `projectedJournalOffset` | 259,180,536 | 259,177,614 |
| `dataBytes` | 7,778,119 | 7,776,702 |
| `contextWindow.updatedAt` | 2026-08-22T09:36:22.954Z | 2026-08-22T09:33:35.833Z |

这证明至少发生过一次 meta 原子替换失败，且后续写入已经恢复；它不是 journal 事实永久丢失。

现场附带分析认为“旧 offset 会直接导致消息显示不全”，但现有代码不能证明这一因果：

- data/index 已推进而 meta 未提交时，`readMeta` 会根据 `dataBytes` 和固定宽度 offset 文件长度判定投影无效，随后走重建。
- 只有 context window 单独更新失败、消息文件未变化时，旧 meta 仍可能结构有效；此时明确过期的是 context window 快照，而不是消息事实。
- 旧 `projectedJournalOffset` 会扩大 journal tail 重放范围，本身不等于遗漏消息。

因此，本设计不把“这次 EPERM 已经证明 UI 丢消息”写成根因结论。可确认的问题是投影提交缺少并发、重试、隔离、降级和恢复的完整合同；用户可见消息不全仍需 Windows 真实复现验证。

## 4. 必须保持的不变量

1. JSONL journal 是会话事实源；projection 永远是可删除、可重建的派生读模型。
2. journal 已成功追加后，projection 失败不得反向改变该事实，也不得中断 agent run。
3. 读取只能使用已证明内部一致的 projection；不能返回半页或混合两个提交版本。
4. 同一会话的 projection 操作只有一个顺序 owner；最后一次成功 mutation 的状态获胜。
5. retry 必须有明确 errno、次数和总时长边界；持久权限错误不能被无限重试伪装成健康。
6. projection 不可用时优先保证消息完整，再接受当前请求退化为全量 journal replay。
7. 降级必须可观察、可自动恢复，并且不能由页面轮询隐藏触发新的写操作。
8. 不改变 cursor、HTTP、journal schema、模型输入或 context compaction 语义。

## 5. 方案比较

### 方案 A：只重试 `rename`

优点是改动最小，能吸收 Windows 短暂文件占用。缺点是同会话操作仍可能乱序，读取仍可能撞上中间状态，重试耗尽后仍会把派生缓存错误传播到主链路，也无法覆盖 projection 目录持续不可写。

结论：必要但不充分。

### 方案 B：直接覆盖 `meta.json`，或先删除目标再 rename

直接覆盖会暴露半写 JSON；先删除再 rename 会制造 meta 不存在窗口，若进程在两步之间退出，恢复比当前更差。

结论：破坏原子提交，不采用。

### 方案 C：完全绕过 projection，每次直接重放 journal

消息正确性最好，但长会话的首次打开、分页和刷新都会退化为与完整 journal 长度相关的读取与重放，等于删除已经交付的分页读模型。

结论：只适合作为故障降级，不作为正常主路径。

### 方案 D：迁移到 SQLite

SQLite 能提供事务、锁和一致性恢复，但当前消息 projection 只是单会话可重建索引。迁移会引入 schema、数据库生命周期、Node 20 兼容或额外 SQLite 依赖、Desktop/NPM 打包和旧 projection 迁移问题。仓库已有 `node:sqlite` 会话搜索，但该功能在不支持的 runtime 上可以禁用；聊天历史主链路不能使用相同的可选合同。

结论：当前故障不值得触发存储引擎迁移。若未来出现跨会话复杂查询、多索引事务或明确的多进程共享写入，再单独评估。

### 方案 E：串行化 + 有限重试 + 故障隔离 + journal 降级

该方案保留现有高性能主路径，同时关闭同进程竞态、Windows 短暂锁定、派生缓存反向破坏事实写入和 projection 持久不可写四类失败。

结论：推荐。

## 6. 推荐设计

### 6.1 单一操作顺序 owner

`NcpAgentSessionMessageProjectionStore` 在对象内部维护按 session ID 的 operation chain。以下公共操作均通过同一链路进入对应的内部 `*Now` 实现：

- `rebuild`
- `synchronizeJournalTail` / `synchronize`
- `updateContextWindow`
- `readMeta` / `readPage` / `listPage`
- `delete`

同一 session 串行，不同 session 继续并行。读取也进入队列，避免在 data/index 已推进、meta 尚未提交的窗口读取。内部实现不得再次调用需要 enqueue 的公共方法，必须调用 `*Now`，避免队列重入死锁。

这个 operation chain 只解决同一进程内的真实竞态，不升级为公共 mutex、registry 或新 service。跨进程共享写同一数据目录不在本批范围内。

### 6.2 保留原子提交并增加有限重试

`writeMeta` 继续使用：

```text
write unique temp in the same directory
  -> rename temp to meta.json
```

只对 Node filesystem error code `EPERM`、`EACCES`、`EBUSY` 做有限指数退避：

- 总等待时间不超过 1 秒；
- 每次仍 rename 同一个已完整写入的 temp；
- 不重写内容，不删除正式 meta；
- 成功后结束，不留下 temp；
- 最终失败时 best-effort 删除本次 temp。

JSON 序列化错误、schema 错误、非 Node filesystem 错误继续 fail-fast。实现不解析错误 message，不接受可配置的无限 retry。

### 6.3 projection 失败不能回滚 journal

journal append 是事实提交点。它成功后，已识别的 projection storage error 由 projection store 转换为 degraded 状态，不再让以下链路失败：

- `appendSessionEvent`
- session summary 发布
- 正在执行的 agent run

未知错误和数据合同错误仍向上抛出，避免把实现缺陷吞成缓存降级。

context window 是投影快照。其 meta 更新失败时：

- 不回滚消息；
- 不阻断已经计算出的新 summary 向 UI 发布；
- degraded 周期内不再把旧 meta 的 context window 作为新鲜事实返回。

### 6.4 degraded 状态与纯读 journal 降级

projection store 内维护一个进程内 `degradedSessionIds` 集合。以下情况进入 degraded：

- meta rename 在有限重试后仍失败；
- rebuild、data 或 index 的已识别存储操作失败；
- mutation 发现当前 projection 已不满足一致性条件。

读取发现 session degraded，或者投影无效且重建仍遇到已识别存储错误时，从既有 `source.loadSession(sessionId)` 得到完整 journal replay，并按现有 ordinal cursor 合同在内存中切页：

- 无 cursor：返回最后 `limit` 条，保持时间正序；
- 有 cursor：返回 cursor 边界之前的一页；
- 保持 `total`、`startCursor`、`hasPreviousPage` 和无重复/无遗漏合同；
- context window 由最新页的既有 SessionManager owner 重新计算；历史页不能用旧 projection 快照覆盖客户端已知的新值。

该读取路径纯读，不尝试写 projection。恢复只由后续明确 mutation 触发：若 session degraded，mutation 先基于最新 journal 完整重建；成功后清除 degraded 并恢复随机分页。

进程重启后 degraded 集合不会持久化。消息 data/index 与 meta 不一致仍由现有长度和版本校验发现；仅 context window 写失败留下的结构有效旧 meta 不影响消息完整性，最新页会重新计算 context window。本批不为软缓存失败新增持久 dirty marker。

### 6.5 可观察性

每个 degraded 周期最多记录一次 warning，包含：

- session ID；
- projection operation；
- filesystem errno；
- rename attempts；
- fallback mode。

恢复成功时记录一次 recovery。当前使用 kernel 现有日志能力，不依赖或扩张新的 observation 子系统；后续统一诊断 owner 可以消费这些结构化信号。

## 7. 生命周期矩阵

| 场景 | 写入 | 读取 | 结果 |
| --- | --- | --- | --- |
| 普通运行 | data/index 后原子提交 meta | projection 随机分页 | 行为不变 |
| 同会话并发 mutation/read | operation chain 串行 | 排在相同队列 | 不观察中间提交态 |
| Windows 短暂锁定 | 1 秒内有限重试 | 成功后继续 projection | 最多短暂延迟 |
| retry 耗尽 | journal 保持成功，进入 degraded | journal 内存分页 | 消息继续可读，run 不被缓存中断 |
| context window 写失败 | 不回滚消息，不阻断 summary | 不信任旧 context 快照 | 消息完整，最新用量重新计算 |
| 刷新/重新进入会话 | 能验证则使用 projection | 无效则重建，仍不可写则降级 | 不返回半页 |
| 进程重启 | 重新校验 version/长度 | 重建或 journal 降级 | 不依赖内存 degraded 状态保证消息正确 |
| 持久权限/只读文件系统 | 有限尝试后告警 | journal 可读则保持只读可用 | 不无限重试，不伪装健康 |
| 后续 mutation 成功 | 从最新 journal 重建并清除 degraded | 恢复随机分页 | 自动恢复性能路径 |

## 8. 实现范围

主要修改：

- `packages/nextclaw-kernel/src/stores/ncp-agent-session-message-projection.store.ts`
- `packages/nextclaw-kernel/src/stores/ncp-agent-session-message-projection.store.test.ts`
- `packages/nextclaw-kernel/src/stores/ncp-agent-session-journal.store.test.ts`
- 若现有调用合同无法证明 projection error 已隔离，只允许最小修改 `ncp-agent-session-journal.store.ts` 或 `session-summary-projection.service.ts`，不得把 retry/fallback 决策移出 projection owner。

不新增 service、manager、repository、registry、公共 lock API 或通用 atomic-file helper。若实现中发现其它 store 也有同类真实 Windows 复现，另立共享抽象设计，不在本批顺带迁移。

## 9. 验证标准

### 投影原子性与竞态

1. 同 session 的 synchronize、context window 更新和 read 并发时严格按 operation chain 排序。
2. 不同 session 的操作仍可并行。
3. 读取不会观察 data/index 与 meta 的中间提交态。
4. concurrent context updates 最终保存队列中的最后一次状态。

### Windows 错误恢复

1. 注入 `EPERM`、`EACCES`、`EBUSY`，在限定次数内恢复时只提交一个完整 meta。
2. 非 retryable error 不重试。
3. retry 总时长有确定上限，测试使用可注入 delay，不依赖真实等待。
4. 最终失败后本次 temp 被 best-effort 清理。

### 降级与恢复

1. projection 写失败不改变已追加 journal，也不阻断 session summary 或 agent run。
2. degraded latest/cursor 分页与完整 journal replay 对照，无重复、无遗漏，`total` 和 pageInfo 一致。
3. degraded 读取不触发 projection 写入。
4. 后续 mutation 成功重建、清除 degraded 并恢复 projection 分页。
5. context window 写失败后消息页仍完整，最新页返回重新计算的 context window。
6. version mismatch、长度不一致、旧 projection、刷新和进程重建路径保持有效。

### 工程验证

1. 运行 projection store 与 journal store 定向 Vitest。
2. 运行 `@nextclaw/nextclaw-kernel` 匹配范围 TypeScript 检查；测试和 lint 不能替代 `tsc`。
3. 运行 targeted lint 和 diff-only maintainability check。
4. 在 Windows runner 或可注入的 Windows errno filesystem seam 上验证 retry；若只能注入错误，明确披露未做真实杀毒软件占用复现。
5. 使用长会话夹具连续读取 latest 到 `hasPreviousPage=false`，分别验证正常 projection、degraded 和恢复后三条路径等价。

## 10. 兼容、迁移与交付

- 不升级 journal schema 或 projection version。
- 不迁移现有会话；现有 projection 继续校验和惰性重建。
- 不改变 HTTP/SDK/UI contract。
- 属于用户可见可靠性修复，实现交付时应添加 changeset，并在用户文档或故障排查说明中说明 Windows 会话历史恢复行为。
- 不需要数据库迁移、发布前数据脚本或用户配置。

## 11. 非目标与后续触发条件

本批不处理：

- 多个 NextClaw 进程同时写同一数据目录的正式支持；
- 把 message projection 迁移到 SQLite；
- 把所有 JSON store 迁入共享 atomic-write 框架；
- 修改消息虚拟列表、HTTP pagination、模型输入或上下文压缩；
- 把 retry 次数暴露为用户配置。

满足以下任一条件时，另行评估 SQLite 或跨进程写 owner：

- 确认存在多个受支持 writer 同时操作同一 session projection；
- projection 需要跨会话查询、多二级索引或多表事务；
- 完成本设计后 Windows 仍出现不可接受的同类故障率；
- runtime 基线和 Desktop/NPM 发布合同能够让聊天主链路稳定依赖 SQLite。

## 12. Design Ready 结论

推荐采用“同会话操作串行化 + Windows 有限 rename 重试 + projection 故障隔离 + journal 纯读降级”。

它保持 JSONL journal 的唯一事实源地位，不改变公共协议，不牺牲正常分页性能；同时确保派生缓存在短暂锁定、持久不可写、刷新和重启场景下都不会让用户失去会话消息。新增状态和函数全部留在现有 projection owner 内，当前不需要更大的存储引擎或架构迁移。
