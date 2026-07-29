# Codex 默认完整权限设计

## 背景

NextClaw 当前通过 `narp-stdio` 接入 Codex。Codex NARP wrapper 创建运行时配置时没有显式设置 sandbox 和 approval policy，导致实际行为受用户本机 Codex 配置影响；在空配置环境中，Codex 0.144.1 会采用 `readOnly + on-request`。

NextClaw 尚未建设运行时审批请求从 Codex app-server、NARP、NCP 到聊天 UI 再返回 decision 的完整链路。此时 `on-request` 不是可交互的安全能力，而是可能令写操作等待或失败的不可用状态。

历史迭代 [`v0.14.190`](../logs/v0.14.190-codex-access-mode-full-access-default/README.md) 已明确 Codex 默认 `full-access`，并将其映射为 `danger-full-access + never`；[`v0.14.191`](../logs/v0.14.191-codex-packaged-full-access-closure/README.md) 进一步完成过真实写文件验收。旧 plugin runtime 链路删除并迁移到 NARP wrapper 后，该默认策略没有随 owner 一起迁移。

## 核心判断

在审批链尚未接通的阶段，Codex 作为执行型 runtime 应与 NextClaw 的本地执行能力保持一致，默认使用：

- `sandboxMode: "danger-full-access"`
- `approvalPolicy: "never"`

这两个字段必须由 Codex NARP wrapper 显式拥有，不能依赖 `~/.codex/config.toml`、Codex 版本默认值或其它环境状态。

## 推荐方案

在 `CodexNarpRuntimeWrapper` 构造 `threadOptions` 时直接写入完整权限默认值。现有 `CodexAppServerNcpAgentRuntime` 已负责把同一份 `threadOptions` 映射到：

- `thread/start` / `thread/resume` 的 `sandbox` 与 `approvalPolicy`
- `turn/start` 的 `sandboxPolicy` 与 `approvalPolicy`

因此不新增 access-mode resolver、配置 schema、adapter 或 fallback，也不修改通用 NARP stdio client。

Codex app-server 的两个 sandbox 字段并非同一协议形状：

- thread 请求使用 `"danger-full-access"` 形式的字符串 `sandbox`
- turn 请求使用 `{ "type": "dangerFullAccess" }` 形式的结构化 `sandboxPolicy`

协议映射必须在 app-server runtime owner 内完成，不能把 thread 的字符串直接透传给 turn。

## Owner 与数据流

```text
CodexNarpRuntimeWrapper
  -> ThreadOptions(danger-full-access, never)
  -> CodexAppServerNcpAgentRuntime
  -> thread/start | thread/resume
  -> turn/start
  -> Codex app-server
```

- 产品默认策略 owner：Codex NARP wrapper。
- Codex 协议映射 owner：Codex app-server runtime。
- 通用 NARP host 不感知 Codex 身份，不承载 Codex 特判。

## 兼容与迁移

- 新建和恢复的 Codex 会话都使用显式完整权限，不再继承本机 Codex 的同名默认配置。
- 不恢复已删除的 plugin `accessMode` 配置层；当前需求只有一个产品默认，不需要重新引入多档配置。
- 后续只有在审批 request/decision 完整打通 NCP 与 UI 后，才增加用户可选权限档位。接通审批不应静默收紧现有默认值。

## 验收标准

1. wrapper 配置测试证明无外部权限配置时固定产生 `danger-full-access + never`。
2. app-server runtime 测试证明 thread 与 turn 请求分别收到正确协议形状的完整权限策略。
3. 使用空 Codex 配置启动真实 app-server，显式传入该策略后，返回的有效 sandbox 为完整权限且 approval policy 为 never。
4. 使用隔离 NextClaw 实例走真实 NCP → NARP → Codex 链路，成功写入配置工作区之外的临时文件，全程不产生审批请求。
5. 相关 package 的测试、TypeScript 编译、lint、构建和治理检查通过。

## 非目标

- 本轮不实现审批 UI。
- 本轮不扩展 NCP approval 事件。
- 本轮不修复通用 NARP `requestPermission`。
- 本轮不新增权限设置入口或多档 access mode。
