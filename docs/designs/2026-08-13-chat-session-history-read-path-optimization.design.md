# 会话历史读取链路低风险优化设计

## 背景

当前 NCP 会话在首次打开、切换或流恢复 hydration 时默认读取最近 80 条 `NcpMessage`。消息列表已经使用动态高度虚拟化，因此 DOM 挂载数量有界，但网络传输、JSON 解析、conversation state hydration 和服务端分页读取仍按整页发生。

进一步沿 `UI -> HTTP -> SessionManager -> journal projection` 调查后确认：

- UI 与服务端默认页大小都是 80；
- projection 即使没有未稳定 journal tail，也会构建完整 `messageId -> ordinal` Map；冷进程第一次访问已有 projection 时因此读取全部稳定消息；
- `SessionManager.listSessionMessagePage` 每一页都会重新读取完整 session 并计算 context window，包括用户向上加载历史 cursor 页；
- 首次页的 context window 不能无条件改为永久缓存，因为它还受消息、agent/profile、固定上下文和工具面影响，projection 目前没有覆盖这些输入的完整 freshness 合同。

问题不是“80 条都会变成 80 个 DOM 节点”，而是分页链路仍存在与完整会话长度相关、且部分重复的读取工作。

## 目标

1. 首次 hydration 和每次历史分页默认只传输 40 条消息。
2. idle、无 journal tail 的正常分页只读取目标 ordinal 范围，不扫描全部稳定消息 ID。
3. cursor 历史页不重复计算与当前会话状态相同的 context window。
4. 保持消息事实源、最新页顺序、cursor、流式 tail 去重、context window 首次页准确性和模型上下文语义不变。

## 当前 owner 与合同

- `NcpAgentSessionJournalStore`：JSONL journal 事实源、稳定边界和 projection 协调 owner。
- `NcpAgentSessionMessageProjectionStore`：随机分页、cursor、稳定消息与 tail 合并 owner。
- `SessionManager`：消息页业务合同和 context window 计算 owner。
- `NcpSessionRoutesController`：HTTP 默认值、最大值和错误映射 owner。
- `useNcpSessionMessageHistory`：UI hydration 与向上分页请求 owner。
- `useChatMessageVirtualizer`：DOM 可见范围 owner，本次不修改。

必须保持的不变量：

- journal 仍是唯一事实源，projection 仍可删除重建；
- 首次页返回最新消息且按时间线正序排列；
- cursor 表示当前页最早稳定消息之前的边界；
- 连续分页无重复、无遗漏；
- 运行中 tail 可以覆盖已有稳定消息快照，也可以追加新消息；
- 模型运行仍读取完整 session state，再由 compaction 与 token budget owner 投影、裁剪；UI 页大小不参与模型输入语义。

## 方案比较

### 方案 A：只把 80 改为 40

优点是改动最小，可以降低网络与前端 hydration 成本。缺点是服务端仍可能为 40 条请求读取完整稳定消息 ID，并在每个历史页重复计算完整 context window。

### 方案 B：缓存 context window，所有页都不再完整读取 session

理论收益最大，但现有 projection 的 `contextWindow: null` 无法区分“尚未计算”和“确实没有值”，也没有覆盖全局配置、工具面和运行中 tail 的 freshness 标识。直接复用会产生陈旧上下文用量，风险不可接受。

### 方案 C：页大小降载 + idle fast path + cursor 页复用当前快照

这是推荐方案：只删除能由当前输入直接证明为冗余的工作，不引入第二套缓存和新 freshness 协议。

- UI 与 HTTP 默认页大小统一改为 40；
- `tailMessages.length === 0` 时不构建 ordinal Map；
- 首次页继续完整计算最新 context window；
- cursor 页直接返回 projection 中随首次页写回的 context window，不重复读取完整 session；
- tail 非空时继续使用现有完整去重路径。

该方案没有改变状态 owner、持久化格式、cursor 编码或恢复分支。

## 推荐主链路

```text
打开/恢复会话
  -> GET latest messages?limit=40
  -> projection 读取 meta 与 journal tail
  -> 无 tail：随机读取最新 40 条
  -> 有 tail：沿现有 ordinal 去重与合并路径
  -> 首次页由 SessionManager 计算准确 context window 并写回 projection
  -> UI hydrate 40 条并连接实时 stream

向上加载历史
  -> GET messages?limit=40&cursor=...
  -> projection 随机读取前一页
  -> SessionManager 复用 projection 中当前 context window
  -> UI prepend，virtualizer 保持可见锚点
```

## 状态与恢复矩阵

| 场景 | 消息读取 | Context window | 必须保持的行为 |
| --- | --- | --- | --- |
| idle 首次打开 | 最新 40 条，无 tail fast path | 重新计算 | 最新页正序、总数准确 |
| 运行中首次打开 | 最新稳定页与 tail 合并 | 重新计算 | streaming message 不重复 |
| 向上加载历史 | cursor 前 40 条 | 复用首次页写回快照 | 无重复、无遗漏、锚点不跳 |
| stream 重连 | 重新 hydration 最新 40 条 | 重新计算 | server truth 覆盖旧前端状态 |
| 旧 projection | 按原机制惰性重建 | 重新计算 | 不迁移 journal，不丢消息 |
| projection 损坏 | 按原机制删除/重建 | 重新计算 | 明确失败或恢复，不返回半页 |

## 实现范围

修改：

- UI 默认消息页大小；
- HTTP 未提供 limit 时的默认页大小；
- projection `readPage` 的无 tail 分支；
- `SessionManager.listSessionMessagePage` 对 cursor 页的 context window 读取路径；
- 对应 UI、controller、projection 和 manager 定向测试。

不新增 service、manager、cache、索引文件或兼容分支。

## 非目标

- 不改变模型输入历史、context compaction 或 token budget；
- 不改变 cursor 编码、最大页大小 200 或 API 字段；
- 不改变虚拟列表 overscan、动态高度或滚动策略；
- 不把首屏 context window 改成无 freshness 证明的永久缓存；
- 不重启当前 NextClaw 实例，不提交、不发布。

## 最小充分验证

1. UI 默认 hydration 请求 `limit: 40`，显式 limit 仍被保留。
2. HTTP 缺省 limit 为 40，显式 limit 与最大 200 约束不变。
3. 冷实例读取已有 idle projection 时不调用完整 ordinal 读取路径，输出仍是最新页。
4. tail 覆盖已有消息和追加新消息的去重行为不变。
5. cursor 页不调用完整 session/context window 计算，首次页仍调用且返回准确快照。
6. 连续 cursor 分页无重复、无遗漏。
7. 受影响 package TypeScript 检查、定向测试和 targeted lint 通过。
8. diff-only 可维护性检查无未处理告警。
