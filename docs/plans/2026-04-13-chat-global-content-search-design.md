# Chat Global Content Search Deferred Design

日期：2026-04-13

相关文档：

- [NextClaw 产品愿景](../VISION.md)
- [chat-session-display.ts](../../packages/nextclaw-ui/src/components/chat/chat-session-display.ts)
- [use-ncp-session-list-view.ts](../../packages/nextclaw-ui/src/components/chat/ncp/use-ncp-session-list-view.ts)
- [ncp-chat-page-data.ts](../../packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-page-data.ts)
- [ncp-session.ts](../../packages/nextclaw-ui/src/api/ncp-session.ts)
- [ui-session-service.ts](../../packages/nextclaw/src/cli/commands/ncp/ui-session-service.ts)

## 1. 背景

当前前端里用户感知到的“全局搜索”，本质上仍是 session 列表筛选，而不是聊天正文搜索。

现状特征如下：

- 前端只拉取 session summary 列表，不拉取所有 session 的消息正文。
- 搜索匹配字段目前主要是 `session key / label / projectRoot / projectName`。
- 聊天内部的用户消息、assistant 文本回复、绘画 prompt 文本，并不会进入当前搜索结果。

因此，用户现在说“我记得聊过这个内容，但忘了在哪个会话里”，NextClaw 还不能像 ChatGPT 那样直接靠全文检索把相关对话找出来。

## 2. 这次要回答的真实问题

这次不是决定“现在立刻开做”，而是先把未来方案讲清楚：

1. 这个能力是否值得做？
2. 如果以后做，最佳实践是什么？
3. 为什么它现在优先级可以偏低？

结论先写在前面：

- 值得做，因为它会直接增强 NextClaw 作为统一工作台入口的检索能力。
- 但它不是前端小修，需要后端索引、结果建模和跳转定位能力配套。
- 当前可以先不做，实现上应明确走“后端索引驱动的全局内容搜索”，而不是临时前端扫消息。

## 3. 为什么当前优先级不高

这个需求看起来像“把搜索框变聪明一点”，但真实工作量不在搜索框，而在搜索底座。

它至少包含四类额外复杂度：

1. 数据层复杂度  
   当前 session summary 不含正文；若要搜聊天内容，必须建立独立搜索数据面，而不是复用现有列表接口。

2. 结果模型复杂度  
   搜索结果不能只返回“某个会话命中了”，还要回答：
   - 是哪条消息命中的
   - 命中了哪段文本
   - 点击后如何跳回对应会话和对应消息

3. 噪音治理复杂度  
   不是所有 message part 都适合进入搜索：
   - tool result 是否纳入
   - 大段 JSON 是否纳入
   - system / service message 是否纳入
   - 绘画 prompt 是否和普通聊天同权重

4. 性能与维护复杂度  
   若没有索引而是临时全量扫描，会随着 session 和消息增长明显退化，并且很难做排序、分页和 snippet 高亮。

所以这个功能适合作为一个完整专题来做，而不是夹在高优链路中顺手补。

## 4. 产品目标

未来若做，这个能力应该服务于 NextClaw 的统一入口定位，而不是新增一个零散功能点。

目标应收敛为：

1. 用户可以通过一个统一搜索入口，找到“曾经聊过的内容”。
2. 搜索结果不仅告诉用户“哪个会话相关”，还要告诉用户“为什么相关”。
3. 点击结果后，用户能直接回到对应会话，并尽量定位到命中的消息上下文。
4. 聊天、绘画 prompt、后续 agent 会话，不应各自做一套搜索系统，而应尽量复用同一套内容检索底座。

## 5. 非目标

首版明确不应做以下内容：

1. 不做图片视觉内容理解搜索。
2. 不做 OCR 作为首发必选项。
3. 不做 embedding-only 的语义搜索首版。
4. 不做所有 tool 输出的无差别索引。
5. 不做前端本地全量拉取后全文过滤。

这几个方向都可能有价值，但不适合作为第一批能力混在一起上线。

## 6. 备选方案比较

### 方案 A：前端临时拉正文后本地过滤

做法：

- 前端在打开全局搜索时，拉取更多 session message 数据。
- 在浏览器里直接做字符串匹配。

优点：

- 表面开发快。
- 不需要先补后端索引结构。

缺点：

- 数据量稍大就会卡。
- 无法稳定分页、排序和 snippet 命中解释。
- 会把搜索能力锁死在当前 UI，不利于 CLI / API / 未来工作台统一复用。

结论：

- 不推荐。

### 方案 B：只搜最近 N 个会话的正文

做法：

- 仍以现有 session 列表为主。
- 额外只对最近 N 个会话拉正文做轻量搜索。

优点：

- 比方案 A 稍轻。
- 可作为临时过渡版。

缺点：

- 行为不稳定，用户会遇到“明明聊过但搜不到”。
- 命中边界依赖最近窗口，体验不够可预测。
- 最后大概率还是要重做成真正的索引搜索。

结论：

- 除非后续出现非常强的短期需求，否则不建议作为正式方案。

### 方案 C：后端索引驱动的全局内容搜索

做法：

- 在消息持久化或 session 更新时，构建可搜索文本索引。
- 前端只负责提交查询、展示结果、跳转定位。

优点：

- 行为可预测。
- 性能和排序能力更稳定。
- 能服务 UI、CLI、API 等多个入口。
- 能自然纳入绘画 prompt 等文本内容，而不必另造系统。

缺点：

- 初始工程量更高。

结论：

- 这是未来应采用的正式方向。

## 7. 推荐的未来方案

推荐方案是：

**统一入口不变，新增“聊天内容搜索”后端能力，并把聊天正文与绘画 prompt 文本纳入同一套全文索引。**

这里的关键不是“索引所有内容”，而是“索引该索引的内容”。

首版建议纳入的文本范围：

- session label
- 用户文本消息
- assistant 文本消息
- 绘画 prompt 文本
- 绘画 negative prompt / style / model 等明确文本字段

首版建议排除或降权的内容：

- 大段 tool result
- 原始 JSON
- system/service 内部提示
- 纯图片附件本体

## 8. 架构原则

未来正式实现时，建议遵循以下原则：

### 8.1 搜索是独立查询面，不复用 session list

当前 `listSessions` 返回的是 summary，不应该继续强行承载全文搜索。

未来应新增专门的搜索链路，例如：

- `searchSessionsByContent(query, filters)`

而不是继续扩充：

- `listSessions(limit)`

### 8.2 以索引文档为中心，而不是以原始消息遍历为中心

应为每个 session 或 message 构建搜索文档，而不是查询时再回头扫全量原始消息。

推荐至少拆成两个层级：

1. `session-level searchable summary`
2. `message-level searchable entry`

这样既能给会话排序，也能返回命中片段。

### 8.3 搜索结果必须带命中解释

结果至少应包含：

- `sessionId`
- `sessionLabel`
- `matchedMessageId`
- `matchedTextSnippet`
- `matchedField`
- `sessionType`
- `updatedAt`

否则用户只能知道“搜到了”，却不知道“为什么搜到”。

### 8.4 点击结果后要能回到内容，而不是只回到会话

若最终只能打开会话顶部，再让用户自己往下翻，这个能力的实际价值会打折。

因此首版最好至少支持：

1. 打开命中的 session
2. 在前端高亮命中的消息
3. 尽量滚动到该消息附近

## 9. 推荐的数据模型

未来可考虑新增统一的搜索文档抽象，例如：

- `SessionSearchDocument`
- `SessionSearchHit`

### 9.1 SessionSearchDocument

建议字段：

- `sessionId`
- `messageId`
- `sessionType`
- `sessionLabel`
- `projectRoot`
- `projectName`
- `role`
- `fieldType`
  - `session-label`
  - `user-text`
  - `assistant-text`
  - `drawing-prompt`
  - `drawing-negative-prompt`
- `searchText`
- `timestamp`
- `metadata`

### 9.2 SessionSearchHit

建议字段：

- `sessionId`
- `messageId`
- `sessionLabel`
- `sessionType`
- `snippet`
- `matchedField`
- `score`
- `timestamp`

## 10. 推荐的 owner 边界

若未来进入实现，不建议继续堆一组平铺 helper。按当前项目治理，更适合直接收敛为清晰 owner class：

- `SessionContentSearchIndexer`
  - 负责把 session/message 转成搜索文档
- `SessionContentSearchQueryService`
  - 负责执行查询、排序、过滤和分页
- `SessionContentSnippetBuilder`
  - 负责生成 snippet 与高亮窗口

这样可以避免“索引逻辑一段、查询逻辑一段、snippet 逻辑一段，到处散落”的函数蔓延。

## 11. API 设计建议

未来建议新增独立接口，而不是继续滥用 session list：

`GET /api/ncp/session-search?q=<query>&limit=<n>&sessionType=<optional>&projectRoot=<optional>`

返回结构建议为：

```json
{
  "query": "docker compose",
  "total": 2,
  "hits": [
    {
      "sessionId": "ncp-123",
      "messageId": "msg-9",
      "sessionLabel": "部署排查",
      "sessionType": "native",
      "matchedField": "assistant-text",
      "snippet": "...检查 docker compose 的 volume 映射...",
      "timestamp": "2026-04-13T08:00:00.000Z",
      "score": 0.92
    }
  ]
}
```

首版不必一开始就暴露复杂过滤，但至少应给未来过滤预留参数位。

## 12. 前端交互建议

未来前端不应继续把这个能力实现成“会话列表筛选增强版”，而应升级为真正的全局搜索结果面板。

推荐交互：

1. 顶部仍保留统一搜索入口。
2. 输入关键词后，结果区分为：
   - 会话结果
   - 内容命中结果
3. 内容命中结果展示：
   - 会话标题
   - 命中片段
   - 时间
   - 会话类型
4. 点击后：
   - 进入会话
   - 尝试滚动并高亮命中消息

如果首版必须控制范围，也可以先只展示“内容命中结果”，不同时做太多分组和高级过滤。

## 13. 分阶段计划

### Phase 0：现在先不做

当前动作仅限于：

- 记录方案
- 明确为什么优先级偏低
- 避免未来重新讨论时误把“会话筛选”当“全文搜索”

### Phase 1：关键词全文搜索 MVP

范围：

- 只搜文本
- 只搜用户消息、assistant 文本、session label、绘画 prompt 文本
- 返回 snippet
- 支持打开 session 并定位消息

不做：

- OCR
- 语义搜索
- tool result 全量纳入

### Phase 2：搜索体验完善

范围：

- 类型过滤
- 项目过滤
- 更好的排序与高亮
- 更稳定的命中定位体验

### Phase 3：高级能力

按需评估：

- OCR
- embedding / hybrid retrieval
- tool result 结构化索引

只有在 Phase 1 已经证明用户确实高频使用时，才值得进入这一层。

## 14. 验收标准

未来如果正式做，至少应满足：

1. 输入一个只出现在聊天正文里的关键词，也能搜到对应会话。
2. 搜索结果能显示命中片段，而不是只显示会话名。
3. 点击结果后能打开对应会话，并尽量定位到命中消息。
4. 普通聊天与绘画 prompt 文本可以共享同一套搜索入口。
5. 搜索结果不因“只看最近几个会话”而随机漏结果。

## 15. 为什么这个方向值得，但现在可以不做

这项能力本质上是“把历史交互变成可重新进入的工作记忆”，长期非常重要。

但它对当前产品阶段来说，不属于最小闭环能力，而是一个典型的“值得做，但应该在主链路更稳之后再做”的专题。

因此，本次最合理决策不是仓促开工，而是：

1. 先把正确方案写清楚。
2. 先明确拒绝错误路线：
   - 前端全量拉正文搜索
   - 最近窗口伪全局搜索
   - 聊天和绘画各做一套搜索
3. 后续等优先级上来后，直接按 Phase 1 的收敛版落地。

## 16. 后续触发条件

当出现以下任一信号时，可以把本专题重新提上来：

1. 用户开始频繁依赖历史聊天找回信息。
2. session 数量明显增长，单靠 label 已经难以定位。
3. 绘画 prompt 与普通聊天都开始形成可复用知识资产。
4. 产品开始强化“工作台 / 历史 / 知识回访”能力。

在这些条件出现前，这份文档即作为 defer 设计基线保留。
