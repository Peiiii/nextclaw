# 会话历史摘要结构保真与压缩边界修复设计

## 背景与问题

用户在会话 `sid_bmNwLW10NXBpOG5nLTc0dWY0eHk0` 中观察到：自动上下文压缩线出现后，点击继续产生的新思考有一部分显示在压缩线之前。

端到端证据已经确认：

- 服务端 checkpoint 是 `mid-run`，记录旧 assistant message 的 `continuationMessageCoveredPartCount = 67`；模型输入投影从该边界之后继续，不会重新执行已覆盖内容。
- 历史 UI 接口使用 `toolPayload=summary`。摘要生成器原本只保留第一个工具调用，直接删除同一 assistant message 后续的 `tool-invocation` parts；完整消息与摘要消息因此具有不同的 parts 拓扑和编号。
- 前端时间线投影会隐藏 continuation prompt、把 continuation assistant 合并回原 assistant surface，并依据 checkpoint 的 covered part count 插入 inline compaction marker。它需要 parts 的结构顺序保持不变。
- 结果是：后端记录的边界坐标来自完整消息，前端却在裁剪后的 parts 上定位，压缩线和继续内容可能错位。

这不是“前端是否应该重建流式消息”的问题。流式状态确实需要由前端把稳定消息和 `streamingMessage` 合并；问题是历史摘要在省略详情时破坏了消息结构合同。

## 用户任务与成功标准

用户看到的助手时间线必须满足：

```text
压缩前的旧内容
压缩线
Continue 后新增内容
```

成功标准：

1. 历史摘要可以省略工具调用的 `args`、`result` 和大结果内容，但不能删除任何原始 part 槽位，也不能改变 parts 顺序。
2. 摘要消息与完整消息拥有相同的 parts 数量；每个被省略详情的工具调用仍保留 `toolName`、`toolCallId`、状态和执行时间等结构字段。
3. UI 不因结构占位节点构造大量完整工具卡；被标记为详情延迟的工具调用在摘要展示中不单独渲染，过程摘要继续显示真实工具调用总数，用户主动加载详情后显示完整工具过程。
4. 相同 checkpoint、相同消息前缀在实时流和刷新重载中得到相同的 marker 位置；Continue 后第一段新增内容必须位于 marker 之后。
5. canonical journal、kernel model projection 和 detail API 继续使用完整消息；摘要视图不能回写或污染 canonical message。

## 当前 owner 与不变量

| Owner | 责任 | 本次约束 |
| --- | --- | --- |
| canonical NCP message | 保存完整、有序的 message parts | 不截断、不删除、不改变顺序 |
| `buildSessionMessageHistoryPayloadView` | 生成 UI 历史轻量视图 | 只裁剪详情字段，保留每个结构节点 |
| `DefaultNcpAgentConversationStateManager` / runtime hook | 合并稳定消息、实时消息和 optimistic message | 继续复用现有时间线插入逻辑 |
| `chat-message-timeline` projector | 隐藏内部消息、合并 continuation、插入 marker | 只消费稳定结构，不猜测缺失节点 |
| chat adapter | 将摘要结构转成展示 parts | 过滤 deferred placeholder，详情加载后自然恢复完整卡片 |

设计命中的架构原则：

- `single-complete-owner`：part 的结构和顺序由 message producer/canonical message 共同定义，UI 不再通过删除节点改变语义坐标。
- `information-expert`：历史摘要生成器最清楚哪些字段可以延迟，负责清空详情并标记 deferred；UI 只负责展示。
- `equivalence-by-construction`：摘要消息保留与完整消息等长的结构骨架，实时态与刷新态不再依赖手工 offset 映射来维持等价。
- `simple-structure-first`：不新增 timeline service、offset remapper 或第二套排序器；使用现有 parts 数组和一个可选的 deferred 标记。

## 候选方案

### 方案 A：保留所有 tool parts，只清空详情并标记 deferred（采用）

摘要视图保留每个 `tool-invocation` part，只把 `args`、`result`、`resultContentItems` 清空；对被隐藏详情的节点设置 `payloadDeferred: true`。前端 adapter 过滤这些节点的视觉卡片，但 raw projected message 仍保留它们用于 part 边界计算。

优点：

- parts 数量、顺序和工具调用身份稳定；checkpoint 的 covered part count 继续有效。
- 不改变 NCP message 的 part 类型，不需要新增 extension placeholder 或 offset 映射。
- 详情加载后返回 canonical message，去掉 deferred 标记即可恢复现有完整工具卡路径。

代价：摘要 JSON 仍包含轻量工具骨架，但不包含大 args/result；对于数百个调用，结构开销受工具数量预算约束，且 UI 不会构造对应的完整卡片。

### 方案 B：用 extension placeholder 替代被隐藏 tool part

保持数组长度，但把 tool part 转成 UI extension。此方案需要所有读取方理解新的 extension 类型，并增加“占位 extension 不应渲染”的分支；还会让同一个 NCP message 在摘要视图中改变 part 类型，扩大协议语义差异。放弃。

### 方案 C：继续删除 parts，并新增 full-to-summary offset remapper

为每个 checkpoint 保存或计算摘要坐标，前端按映射重建 marker 位置。此方案保留了结构丢失，要求每个 producer/consumer 同步维护映射，且后续任何 part projection 都可能再次破坏坐标。放弃。

## 推荐主链路

```text
canonical full message
        │
        ├── model input / detail API：完整 parts
        │
        └── UI history summary：
              保留全部 parts
              清空大 payload
              标记 payloadDeferred
                    │
                    ▼
              timeline projector
              使用稳定 part 数组插入 marker
                    │
                    ▼
              chat adapter 过滤 deferred 视觉卡片
```

具体实现：

1. 在 `NcpToolInvocationPart` 增加可选的 `payloadDeferred?: boolean`，明确它只表示当前传输视图没有携带工具详情，不改变工具调用的生命周期语义。
2. `deferMessageToolPayload` 遍历原 parts：所有工具调用都保留；首个代表性调用继续用于已有过程摘要，其余工具调用保留结构字段并设置 `payloadDeferred: true`。所有被延迟调用的 args/result/resultContentItems 都不下发。
3. UI 的 NCP adapter 跳过 `payloadDeferred` 工具调用的 card view model，避免摘要历史重新支付逐调用卡片构造成本；原有 metadata 仍提供真实 `toolCallCount` 和工具名称。
4. compaction timeline projector 不新增逻辑；它继续对 raw projected message 使用 covered part count。新增回归测试保证摘要后的结构长度足以承接该边界。
5. detail message 使用 canonical 完整 parts，未设置 `payloadDeferred`，现有工具卡和展开行为保持不变。

## 兼容与失败边界

- `payloadDeferred` 是可选字段；canonical message、model input、journal 和 detail API 不写入该字段。
- 旧的已缓存摘要响应若没有该字段，刷新后从新的 API view 重新获得结构保真的消息；不新增长期兼容 remapper。
- 如果历史摘要生成失败，沿用现有完整消息路径，不返回一个结构不完整的半摘要消息。
- 若 detail 请求失败，摘要 metadata 与 lightweight process summary 保留，用户仍可重试；不把空详情当成完整消息覆盖。
- 本次不修改 checkpoint v1 wire 字段，不迁移 journal，不改变模型压缩算法。

## 实现范围与非目标

触达范围：

- `packages/ncp-packages/nextclaw-ncp/src/types/message.ts`
- `packages/nextclaw-server/src/features/sessions/utils/session-message-history-payload.utils.ts`
- `packages/nextclaw-ui/src/features/chat/features/session/utils/ncp-session-adapter.utils.ts`
- 对应 server、UI adapter、timeline 的定向测试。

非目标：

- 不重写 chat timeline projector，不新增第二套排序器。
- 不移除历史大载荷预算和 detail cursor，不把完整工具结果重新塞回首屏摘要。
- 不改动用户当前运行中的 NextClaw 宿主、服务或桌面实例。
- 不执行 commit、push、PR、发布或部署。

## 验证标准

### 结构合同

- 大工具消息进入 summary view 后，`summary.parts.length === canonical.parts.length`。
- tool-invocation 数量、顺序、toolName、toolCallId、state 和 execution 保持不变；只有详情字段被清空，且 deferred 节点带标记。
- canonical 原对象不被修改。

### UI 展示

- adapter 对摘要视图不生成被 deferred 节点的 tool-card；代表性卡片、过程摘要和最终文本仍正常。
- detail message 仍生成完整工具卡。
- timeline fixture 使用“摘要后的结构骨架 + coveredPartCount + hidden continuation + continuation assistant”，断言 marker 位于 continuation 首个 part 之前。

### 真实复验

- 同一用户会话 URL 和同一 API 入口重新读取消息，比较 summary 与 full payload 的 message/part 结构。
- 断言该会话 checkpoint 的 `coveredPartCount` 不超过 summary assistant parts 长度。
- 通过浏览器 DOM 断言压缩 divider 后面出现 Continue 产生的新文本，divider 前没有该 continuation 的首段文本。
- 刷新后重复一次，确认实时 projection 与冷重载 projection 的顺序一致。
