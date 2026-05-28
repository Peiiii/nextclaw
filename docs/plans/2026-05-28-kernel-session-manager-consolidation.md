# Kernel Session Manager 收敛方案

## 背景

当前 kernel 里同时存在三套 session 相关 owner：

- `@nextclaw/core` 的 `SessionManager`：旧会话存储 owner，曾被 kernel 构造并传给 channel / extension / slash command 链路。
- `NcpSessionManager`：NCP journal 会话 owner，负责新链路的 session 创建、读取、metadata 更新、event append、summary/search 发布。
- `SessionRepository`：原本是为了避开旧 `SessionManager` 命名冲突的过渡命名，当前实际承担 agent-run 会话视图、session get-or-create、NCP event 落 journal 等职责。

设计目标不是保留三套 owner，而是让 `SessionRepository + NcpSessionManager` 收敛为 kernel 内唯一的新 `SessionManager`，并让旧 `@nextclaw/core SessionManager` 不再进入 kernel 主对象图。

## 目标

1. `packages/nextclaw-kernel/src/managers/session.manager.ts` 成为新的 kernel session owner。
2. 新 `SessionManager` 基于 NCP journal，承接当前 `NcpSessionManager` 和 `SessionRepository` 的有效职责。
3. kernel 主对象图只暴露新的 `sessionManager`，不再暴露 `sessions`、`ncpSessionManager`、`sessionRepository` 三套并列入口。
4. 仍有价值的旧调用方迁移到新的 `SessionManager`；无价值依赖直接删除。
5. slash command 的 session 读写逻辑从 `@nextclaw/core` 迁到 kernel，避免 core 反向依赖 kernel。
6. 删除旧 `@nextclaw/core SessionManager` class，只保留仍被共享使用的 session 类型、metadata key 与 legacy message/store 类型。
7. 删除旧 `@nextclaw/core CommandRegistry`，避免 core/kernel 同时存在两套 slash command owner。

## 新 owner 职责

新的 `SessionManager` 负责：

- NCP session 持久化 API：`createSession`、`getSessionRecord`、`getSession`、`listSessions`、`listSessionMessages`、`updateSession`、`setSessionMetadata`、`updateSessionMetadata`、`deleteSession`。
- agent-run 会话视图：`getAgentRunSession`、`createAgentRunSession`、`getOrCreateAgentRunSession`。
- runtime event 落盘：订阅 `eventKeys.ncpEvent`，过滤非持久事件后写入 journal。
- session summary/search 事件发布：延续当前 `NcpSessionManager` 行为。
- context window summary preview：先保留当前行为，后续单独评估是否抽成 projection owner。

新的 `SessionManager` 不负责：

- 活跃 run 的内存状态、abort controller、streaming snapshot。这仍归 `SessionRunManager`。
- session request / spawn 的业务编排。这仍归 `SessionRequestManager`。
- UI activity preview 投影。这仍先归 `SessionActivityPreviewContribution`，后续单独审计。

## 旧 owner 处理

### `SessionRepository`

处理方式：删除文件，职责并入新的 `SessionManager`。

理由：`Repository` 只是避开旧 manager 名字的过渡命名，长期保留会误导 owner 关系。

### `NcpSessionManager`

处理方式：删除文件，职责并入新的 `SessionManager`。

理由：NCP 已经是当前 session 主协议；继续保留 `NcpSessionManager` 会让它看起来像 `SessionManager` 旁边的一条分支。

### `@nextclaw/core SessionManager`

处理方式：从 kernel 主链路移除，并删除 core 里的旧 `SessionManager` class。`CreatedSession`、`CreateSessionInput`、`SessionLifecycle` 与 child-session metadata key 迁到 `@nextclaw/core` 的 session types 公共出口；legacy `SessionMessage` / `SessionEvent` / store 类型暂时保留给 session-search、context compaction adapter 等历史数据读取链路。

理由：仓库内已经没有生产代码实例化旧 core `SessionManager`；继续保留 class 只会制造“旧 owner 还可用”的错觉。类型和历史消息结构仍是共享合同，应该保留为 types/store，而不是保留旧 manager。

## Slash Command 迁移

当前 `@nextclaw/core CommandRegistry` 同时承担命令解析和 session 命令执行，其中 `/status`、`/reset`、`/model`、`/thinking` 直接依赖旧 `SessionManager`。

迁移策略：

1. 在 kernel 新增 `services/command-registry.service.ts`。
2. 迁移 `CommandRegistry` 到 kernel，让它依赖新的 kernel `SessionManager`。
3. `GatewayInboundProcessor` 和 `ExtensionRuntimeService` 改用 kernel `CommandRegistry`。
4. 删除 core 的 `CommandRegistry` feature 和导出。

理由：仓库内已经没有生产调用方继续使用 core `CommandRegistry`，只保留 kernel 这一套 command owner 才符合单一链路。

## 迁移步骤

1. 新建 kernel `SessionManager`，合并当前 `NcpSessionManager` 与 `SessionRepository`。
2. 更新 `SessionRunManager`、`AgentRunRequestManager`、`AgentRunContextCompactionManager`、context/provider/runtime/tool/session-request/learning-loop/session-activity-preview 等调用方。
3. 更新 `NextclawKernel` 构造图，只持有 `sessionManager`。
4. 移除 `ChannelManager` 的无用 `sessionManager` 依赖。
5. 迁移 kernel command registry，并让 gateway / extension runtime 依赖新 command registry。
6. 删除 `NcpSessionManager`、`SessionRepository` 文件及相关导出。
7. 删除旧 core `CommandRegistry` feature。
8. 删除旧 core `SessionManager` class，并把仍需要复用的 session 类型迁到 core session types。
9. 更新测试引用与断言。

## 验收

- kernel 源码中不再 import `@nextclaw/core` 的 `SessionManager`。
- kernel 源码中不再引用 `ncpSessionManager` / `sessionRepository`。
- core 源码中不再保留旧 `SessionManager` class 或旧 `CommandRegistry` feature。
- `NextclawKernel` 只暴露新的 `sessionManager`。
- slash command 对 session metadata 的读写落到 NCP journal。
- TypeScript 检查通过。
- session manager、session request、agent run request、extension command 相关定向测试通过。
