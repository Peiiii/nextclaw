# 手动压缩会话上下文方案

## 目标与验收

为已有会话增加一个用户主动触发的“压缩上下文”命令。命令必须压缩当前会话真正使用的运行时上下文，而不是只改前端展示或伪造一条提示消息。

可观察验收条件：

- 已选择真实会话时，输入 `/` 可以找到“压缩上下文”命令；
- Native runtime 复用现有上下文压缩 checkpoint、摘要和时间线消息链路；
- Codex app-server runtime 调用官方 `thread/compact/start`；
- 会话正在运行、历史不足或 runtime 不支持时返回明确错误，不静默成功、不自动发送替代 prompt；
- 同一会话的命令通过唯一的 session action API 执行，前端不判断 runtime 类型。

## 现状证据

- 斜杠菜单由 `SessionConversationInput` 组装，目前只有创建侧边会话的产品命令。
- Native runtime 已在每次模型调用前经过 `AgentRunContextCompactionManager`，但只在预算触发时压缩。
- NARP runtime 由 `NcpAgentRuntimeWrapper` 适配，provider runtime 才拥有其真实会话上下文。
- Codex app-server client 已持有并恢复 `threadId`，本机 Codex app-server schema 提供 `thread/compact/start`，参数为 `threadId`。

## Owner 与单一路径

```text
slash command
  -> client SDK sessions.compactContext
  -> POST /api/ncp/sessions/:sessionId/context/compact
  -> SessionContextCompactionManager
  -> AgentRuntime.compactContext
     -> Native: existing compaction preflight in manual mode
     -> NARP: NcpAgentRuntime.compactContext
        -> Codex app-server: thread/compact/start
```

`SessionContextCompactionManager` 是会话级命令 owner：它确认会话存在且 idle，取得当前 runtime 实例，拒绝不支持的 runtime，并统一发布 Native 产生的 NCP 事件。runtime provider 只实现自己拥有的上下文压缩能力。

## 合同设计

- `AgentRuntime.compactContext` 与 `NcpAgentRuntime.compactContext` 都是可选 capability；缺失即显式 `CONTEXT_COMPACTION_UNSUPPORTED`。
- Native manual mode 只改变“是否必须生成压缩计划”，仍复用原有摘要、checkpoint、metadata patch 和 timeline message；不复制第二套压缩算法。
- Codex runtime 先恢复已有 thread，再调用 `thread/compact/start`；请求完成才向上返回成功。
- action 只允许显式用户触发，不用于页面加载、轮询、焦点变化或自动重试。
- 命令执行中不允许同会话并发 run；服务端以 `SESSION_BUSY` 拒绝竞争。

## 错误与可预测性

- 会话不存在：`SESSION_NOT_FOUND` / 404。
- 会话正在运行：`SESSION_BUSY` / 409。
- runtime 没有 capability：`CONTEXT_COMPACTION_UNSUPPORTED` / 409。
- Native 没有可覆盖的旧消息：`NOTHING_TO_COMPACT` / 409。
- provider 或 Codex 请求失败：保留原始错误并返回失败；不 fallback 为发送 prompt，不谎报成功。

## 目录与维护性

- kernel 新增一个聚焦的 session command manager；不把会话命令塞进 HTTP controller 或 UI manager。
- UI 把产品斜杠命令组装从接近预算上限的 component 提取到已有 conversation hooks 目录。
- API、SDK 与 runtime capability 均沿现有 package 公共入口扩展，不新增 deep import 或平行 client。

## 验证

- kernel：manual mode、会话不存在、busy、unsupported、Native 事件应用与发布；
- runtime：Codex 请求顺序和 `thread/compact/start` 参数；
- server：组装后的真实路由成功 envelope 与错误映射；
- client SDK：method、URL 和返回 shape；
- UI：命令可见、调用选中会话、成功/失败反馈和重复点击保护；
- 触达 TypeScript package 的 tsc、定向测试、governance 与 maintainability 检查。

## 非目标

- 不新增自动压缩策略；
- 不为 Claude Code、Hermes 或任意 runtime 伪造 prompt fallback；
- 不修改消息历史或清空会话；
- 不执行 push、远程合并、release、deploy 或 migration。
