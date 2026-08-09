# Native 工具调用并行调度设计

## 背景与目标

NextClaw 的模型协议和流式编码已经能够表达同一模型轮次中的多个工具调用，但 Native runtime 当前把所有 ready tool call 放进单 worker FIFO，逐个等待完成。用户因此会看到多个工具卡片，却无法获得独立读取、搜索或抓取操作的真实并行收益。

本设计的可观察目标是：同一模型轮次内，明确声明为并行安全的工具可以真实重叠执行；未声明或可能修改外部状态的工具继续独占执行；下一轮模型请求只在本轮所有工具结算后开始。

## 当前链路与 owner

主链路为：

`provider tool_calls -> NCP stream encoder -> RuntimeToolCallExecutor -> NcpTool.execute -> MessageToolCallResult -> conversation state -> next model input`

- provider 和 stream encoder 负责保留调用身份、参数与模型顺序，不拥有执行安全策略；
- `RuntimeToolCallExecutor` 拥有 ready call、在途执行、取消与结果事件排空，是并发调度的唯一 owner；
- `NcpTool` 是工具自身能否安全并行的事实 owner；
- conversation state 通过 `toolCallId` 更新原有 invocation part，负责保持模型调用顺序，不按结果到达顺序重建调用列表。

当前违反点是调度器把所有工具统一串行，无法表达工具自身已知的只读/并行安全事实。

## 候选方案

### A. 全批次 `Promise.all`

实现最少，但会让文件写入、shell、消息发送、配置修改和未知 MCP 工具互相竞态，不能接受。

### B. pi 式全局 `parallel/sequential` 加单工具覆写

适合通用 SDK，但会在 NextClaw 中形成 runtime 配置与工具能力两个策略 owner；批次包含一个串行工具时整批串行也过于粗粒度。

### C. Codex 式工具能力声明与共享/独占门控（采用）

工具只声明自己是否支持并行，调度器统一决定何时准入。并行安全工具共享执行窗口；默认工具独占窗口。该方案只有一个调度 owner，默认向后兼容，并能逐步扩大安全并行覆盖面。

## 合同

### 工具能力

`NcpTool` 增加可选只读属性：

```ts
readonly supportsParallelToolCalls?: boolean;
```

- 只有显式 `true` 才允许与其他并行安全工具重叠；
- 缺省、`false`、未知工具和当前 MCP adapter 一律独占；
- 该字段只描述执行安全能力，不进入模型可见 tool schema，也不增加用户配置入口。

### 调度与公平性

- ready call 按模型流中的结束顺序进入 FIFO；
- 队首为并行安全工具时，只要没有独占调用且未达到并发上限即可启动；
- 队首为独占工具时，必须等待所有在途调用结束；独占工具开始等待后，后续并行调用不得越过它；
- 并发上限固定为 8，先作为 runtime 内部安全常量，不增加公共配置；
- 下一轮模型调用必须等待 ready queue 和所有在途调用均清空。

### 事件与模型回填顺序

- `MessageToolCallStart/Args/End` 继续保持模型源顺序；
- `MessageToolCallResult` 按真实完成时间发布，使 UI 和 journal 反映真实进度；
- conversation state 以 `toolCallId` 原位更新 invocation part，因此下一轮模型输入仍保持原始 tool-call 顺序；
- 单个工具的参数错误、执行异常或未知工具继续归一化为该调用自己的 result，不终止同批其他调用；
- runtime 级事件应用失败仍视为整轮错误。

### 取消

- 取消立即清空尚未启动的 ready call，并关闭结果事件队列；
- 已启动工具继续通过现有共享 `AbortSignal` 收到取消；
- run 无需等待不响应取消的工具才发布 `MessageAbort`；迟到结果不得重新打开已关闭队列或启动后续调用。

## 首批能力标记

首批只标记可从实现直接证明没有写副作用的内置工具：

- `read_file`
- `list_dir`
- `view_image`
- `web_search`
- `web_fetch`
- `memory_search`
- `memory_get`

写文件、编辑、shell、gateway、消息、session/project 变更、asset 写入和 MCP 工具保持独占。MCP catalog 当前未保留标准 tool annotations；在 catalog 正确传递 `readOnlyHint` 或明确 server opt-in 之前不推断其并行安全性。

## 场景矩阵

| 场景 | 预期行为 |
| --- | --- |
| 两个并行安全调用 | 在并发上限内真实重叠执行 |
| 两个默认调用 | 严格串行 |
| 并行、独占、并行 | 第一个可先执行；独占等待并形成栅栏；第三个不得越过独占 |
| 超过八个并行调用 | 同时在途不超过 8，其余保持 FIFO |
| 后发调用先完成 | result 事件先发布，但 invocation/model 顺序不变 |
| 一个工具失败 | 其他调用继续，失败形成独立 tool result |
| 运行中取消 | 立即发布 abort，未启动调用不执行，已启动调用收到 signal |
| journal 重放/刷新 | 依赖 toolCallId 原位更新，完成顺序不改变调用顺序 |

## 非目标

- 不新增全局 `parallel/sequential` 用户配置；
- 不按文件路径、URL 或其他资源键做细粒度锁；
- 不改变外部 Codex、Claude Code、Hermes 等 runtime 自己的工具调度；
- 不在缺少能力注册表时强制设置 provider 的 `parallel_tool_calls`；
- 不自动把所有 MCP 只读猜测为并行安全。

## 最小充分验证

1. 调度器测试证明并行重叠、默认串行、独占栅栏、并发上限、完成顺序和取消后不再启动；
2. Native runtime 集成测试证明声明透传到调度器，默认串行行为保持兼容；
3. conversation state 测试证明 result 乱序到达时 invocation part 仍按 start 顺序；
4. 首批内置工具测试或类型证据证明只有明确只读工具 opt-in；
5. 受影响 package 的定向测试、TypeScript 检查和 targeted lint 通过。

## 落地与真实验收

本设计已于 2026-08-10 按上述单一 owner 结构落地：`NcpTool` 持有能力声明，`RuntimeToolCallExecutor` 持有 FIFO shared/exclusive 调度，conversation state 继续按 `toolCallId` 原位回填，Kernel 只负责选择首批明确只读的内置工具。

真实验收使用当前仓库构建的隔离 Native runtime，而不是 PATH 中的全局安装版：

- runtime：`native`
- provider/model：`minimax/MiniMax-M3`
- NCP session：`smoke-native-msm3l9d3-k0zv1f3z`
- 同一模型响应调用：`web_fetch(/alpha)`、`web_fetch(/beta)`
- 延迟服务观测：两个请求分别在 `1786297806196` 与 `1786297806291` 毫秒启动，相差 95ms；两个 1.5s 请求完整重叠
- NCP 结果：两组 tool-call 事件和两个 result 后，下一轮模型返回 `PARALLEL-SMOKE-OK`，terminal event 为 `run.finished`

验收结束后已停止隔离 runtime 与延迟服务。
