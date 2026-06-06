# Context Compaction Message ID Contract

## 背景

长会话自动压缩会在时间线中插入一条 service message，用来提示“正在压缩较早上下文”或“较早上下文已自动压缩”。此前这条 message 的 `id` 由 `sessionId + checkpoint.id` 拼接得到。滚动压缩发生多次时，多个 journal event 写入了同一个 message id，replay 后被状态管理器按 id upsert 成一条消息，导致用户只看到一次压缩记录。

这个问题的核心不是 UI 展示，而是身份合同错误：`message.id` 被误用成了 checkpoint 的业务键。

## 设计原则

1. `message.id` 是普通消息身份，必须和 user / assistant message 一样唯一、随机、不可由业务状态推导。
2. `checkpoint.id` 是压缩链的逻辑身份，只能放在 `metadata.checkpoint.id` 中，用于表达同一会话压缩状态的连续演进。
3. 同一次 begin / finish 对应同一条 service message：begin 写入 `compressing`，finish 用相同 `message.id` 更新为 `compressed`。
4. 下一次滚动压缩必须生成新的 service message id，使时间线保留新的压缩记录。
5. 旧 journal 中已经落盘的拼接 id 只能在 replay 时做只读兼容展开，不能继续作为新写入格式。

## 推荐方案

在 context compaction preflight begin 阶段生成一个随机 `context-compaction-message-${randomUUID()}`，并把它保存在 pending work 中。begin 返回的 timeline message 使用这个 id；finish 消费同一个 pending work，因此使用同一个 id 写回最终 compressed message。

checkpoint 仍保留原来的 `id` 和 `createdAt`，表示这是同一条上下文压缩链在滚动推进；覆盖范围、摘要、updatedAt 和 token 估算随每次压缩更新。

## 被拒绝的方案

- `sessionId + checkpoint.id`：会让同一 checkpoint 链上的多次滚动压缩互相覆盖。
- `sessionId + checkpoint.id + coveredCount`：可以临时避开覆盖，但仍然把 message id 绑定到业务状态，不符合普通消息身份合同。
- 新增单独的 timeline message id 体系：会制造第二套 ID 概念。正确做法是直接使用普通 `message.id`，timeline 只是消息用途，不是另一种身份系统。

## 历史兼容

旧 journal 里已经存在形如 `sessionId:service:context-compaction:checkpointId` 的重复 message id。replay 时若检测到这类旧 id，且 message metadata 中带有 checkpoint 覆盖计数，则临时投影为 `legacyId:coveredSessionMessageCount`，使多次历史压缩记录重新展开。

这条兼容只服务旧数据读取，不会影响新写入。删除条件是确认用户历史 journal 完成迁移或不再需要展示旧 marker。

## 验收清单

- 新压缩事件的 `message.id` 匹配随机 service message id，不再拼接 `sessionId` / `checkpoint.id` / coverage。
- 同一次 begin / finish 的 `message.id` 完全一致。
- 已经存在 compressed checkpoint 的会话再次越窗时，会生成新的 timeline message。
- 旧 journal 中多个相同 legacy id 的 context compaction marker，reload 后能展开为多条消息。
- preview / projection 继续以最新 compressed checkpoint 的 `updatedAt` 为边界，而不是依赖 marker 数组位置。
