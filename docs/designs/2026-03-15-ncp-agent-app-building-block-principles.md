# NCP Agent 应用积木化原则

> 上位定位文档见：[NCP 定位与愿景](./2026-03-17-ncp-positioning-and-vision.md)

## 1. 目标定义

本方向只做一件事：

- 把构建 Agent 应用所需的通用能力抽象成可组合积木。
- 任何实现都要优先服务“跨场景复用”，而不是服务某个 Demo 或某个业务页面。

最终效果：开发者像搭积木一样，快速拼出不同 Agent 应用（Chat、Workflow、Copilot、多 Agent 协作等）。

## 2. 核心边界

### 2.1 我们要做的（Do）

- 协议层积木：统一事件、消息、错误、运行上下文类型。
- 传输层积木：HTTP/SSE/WebSocket 等 endpoint client/server 适配。
- 运行时积木：`send / stream / abort / replay` 的统一动作模型。
- 状态积木：会话与流式消息的状态管理（conversation snapshot + run state）。
- UI 绑定积木：针对 React/Vue 等框架提供最薄绑定层（Provider/Hook），只做框架接入，不做业务编排。
- 组合入口积木：提供最小装配 API，让开发者按需拼接 endpoint、runtime、state、ui-binding。

### 2.2 我们不做的（Don't）

- 不在通用包中写 Demo 业务流程。
- 不在 UI 绑定层内实现运行时编排。
- 不为历史路径长期保留双实现（除非有明确高必要性和退出条件）。
- 不提前抽象“未来可能用到”的复杂层级。

## 3. 推荐分层（从底到上）

1. `@nextclaw/ncp`
- 只放协议契约（types/interfaces/constants/errors）。
- 不放具象业务实现。

2. `@nextclaw/ncp-http-agent-client` / `@nextclaw/ncp-http-agent-server`
- 只放传输协议边界实现。
- 不放 React/UI 逻辑。

3. `@nextclaw/ncp-toolkit`
- 放可复用实现：runtime 编排、state manager、helper adapter。
- 允许有状态 class，但必须通用、可替换。

4. `@nextclaw/ncp-react`（以及未来 `ncp-vue`）
- 只放框架绑定：context/provider/hooks。
- 依赖 toolkit runtime，但不重复实现 runtime。

5. `apps/*`
- 只做组装：选择积木 + 业务 UI。
- 业务差异留在应用层，不反向污染通用包。

## 4. 通用积木最小能力清单

每个 Agent 应用都应可直接复用以下能力：

- 会话标识管理（sessionId lifecycle）
- 用户消息发送（send）
- 运行流获取（stream/replay）
- 运行中断（abort）
- 会话快照订阅（messages/streaming/error/activeRun）
- runId 追踪与恢复
- endpoint 生命周期控制（start/stop）

如果某项能力不能被 2 个以上场景复用，不进入通用包。

## 5. 验收标准（是否符合“积木化”）

- 可替换性：换传输层（HTTP -> WS）不影响上层业务代码结构。
- 可组合性：同一 runtime 可接不同 UI 绑定层。
- 可删除性：应用层改造后，旧业务模块可以直接删除，而非并存。
- 简洁性：新增一层抽象必须减少调用侧复杂度，否则不成立。
- 单一职责：每个包只承担一类职责，跨层逻辑必须下沉/上移到正确位置。

## 6. 当前决策约束

后续评审和改造统一按以下决策顺序：

1. 这是不是“构建 Agent 应用的共性能力”？
2. 如果是，应该落在哪一层包里？
3. 这个改动是否让调用方代码更少、更清晰？
4. 是否引入了重复实现或职责漂移？

只要第 1、2、3 任一不满足，就不进入通用积木层。
