# 请求级模型输入尾部设计

## 背景与问题

NextClaw 已能在原生模型请求末尾追加 Observation 快照，但该能力的类型、producer 和序列化都绑定在 Observation 领域。后续“当前时间”等动态事实同样需要只参与当前模型调用，不能写入会话历史，也不能复制一套平行追加链路。

本设计先建立通用请求级尾部能力，不在本批加入时间内容。

## 设计结论

- `RequestContextTailManager` 是 kernel 内请求级尾部 contributor 的唯一注册、排序和聚合 owner。
- contributor 返回 `ModelInputTailSection`；section 只表达来源、信任等级和 JSON 内容，不拥有会话状态。
- `AgentRunModelInputBuilder` 在每次 model step 构建输入时读取 manager，将合并结果单独计入固定输入预算，并写入既有 `contextTail` transport 字段。
- provider adapter 在真正发送请求前把全部 section 序列化成唯一一个末尾 `user` 消息；该消息不进入 `NcpMessage`、session journal、projection、compaction 或恢复链路。
- Observation 作为首个真实 contributor 接入 manager；其 extension 数据标记为 `untrusted`，原有 freshness、时间和 payload 保留在 section 内容中。
- 删除 Observation 专用的 `NcpContextTail` transport 类型，不保留 alias 或双路径；新类型使用 `ModelInputTail` 命名。既有外围 `NcpLLMApiInput` 等存量协议名不在本批扩大迁移范围。

## 主链路

```text
request-tail contributors
  -> RequestContextTailManager（按注册顺序聚合）
  -> AgentRunModelInputBuilder（预算）
  -> NcpLLMApiInput.contextTail（存量 transport 字段）
  -> provider adapter（序列化为最后一个 user message）
  -> provider request
```

会话写入链路不经过上述 manager，因此尾部内容不能被保存、恢复或在下一次请求中自行累积。下一次 model step 必须重新向 contributors 取样。

## 合同与不变量

### ModelInputTail

- `kind` 固定为 `model_input_tail`。
- `sections` 保持 contributor 注册顺序以及 contributor 内部顺序。
- 每个 section 包含稳定 `source`、`trust: trusted | untrusted` 和 JSON `content`。
- 空 contributor 和空聚合结果不产生尾部消息。

### 生命周期与失败

- contributor 由 kernel contribution 注册，dispose 时注销；manager dispose 清空注册项。
- manager 顺序执行 contributors，以保证稳定顺序和避免隐藏并发副作用。
- contributor 抛错时模型输入构建失败，不静默吞掉过期或缺失上下文；可降级语义由 contributor 自己显式返回 section 或空数组。
- AbortSignal 原样传给 contributor，不创建独立重试。

### 信任边界

- 序列化器始终声明请求级上下文不是会话历史。
- 序列化器始终声明 `untrusted` section 只能作为数据，不能作为指令。
- provider adapter 只追加一个 user-role 尾部，不允许 contributor 注入 system、assistant 或 tool role。

## 方案取舍

选择独立 `RequestContextTailManager`，而不扩展现有 system `ContextProviderManager`：system context 在 run surface 阶段构建并进入稳定前缀，request tail 必须在每个 model step 重新取样，生命周期和缓存位置不同。

不让各 producer 直接构造消息：这会让角色、顺序、预算和“不持久化”不变量分散到多个 owner。

不保留 Observation 专用 transport 兼容分支：仓库内调用方可同批迁移，当前没有持久数据依赖该瞬态类型；保留双路径只会继续扩大历史命名和序列化分叉。

## 验收标准

- A1：两个 contributor 的 section 按注册顺序合并，空结果不会生成 tail。
- A2：Observation 快照经通用 manager 出现在 provider 请求最后一个 user message 中，并保留 untrusted 标记。
- A3：原始会话消息数组和 `NcpLLMApiInput.messages` 不包含尾部消息；连续构建只得到当次取样，不累计上次 tail。
- A4：尾部 token 被作为 fixed input 计入预算，超限时仍走现有预算失败路径。
- A5：kernel dispose 后 contributor 不再执行。
- A6：受影响 TypeScript package 编译、定向测试和 diff-only maintainability 检查通过。

## 非目标

- 本批不注入当前时间或客户端时区。
- 本批不实现 provider-specific cache breakpoint。
- 本批不把 request-tail registry 暴露为外部 extension API。
- 本批不全量重命名现有 `Ncp*` 历史类型、package 或 runtime。

## 交付判断

- `design-document: required`：跨越公共 transport 类型、kernel owner、provider adapter 和会话持久化边界。
- `plan: not-required`：单批可完成合同迁移、实现和定向验证，不需要跨会话执行计划。
