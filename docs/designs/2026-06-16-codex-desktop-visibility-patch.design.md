# Codex Desktop 会话可见性自动补丁设计

## 背景

NextClaw 通过 Codex NARP runtime 创建的 Codex thread 已经能写入 Codex 自身的 sqlite 与 rollout 文件，但 Codex Desktop 侧边栏并不是直接展示所有 thread。它会先把 thread 按已知 workspace root、projectless thread 或显式 project assignment 分组；如果 thread 的 `cwd` 不属于 Codex Desktop 已知 workspace root，就会变成 UI 上不可见的 orphan thread。

后续真实会话又暴露了第二类可见性问题：NextClaw/NCP journal 与 Codex rollout 文件都已经包含多轮消息，但 Codex Desktop 的 `threads` sqlite 索引行仍停留在第一轮的 `updated_at/tokens_used/has_user_event` 状态。此时数据事实没有丢，但 Desktop 依赖的索引缓存是旧的，导致会话在 Desktop 中排序、预览或打开状态表现为不完整。

第三类真实问题来自会话 `ncp-mqgwsfik-b7bbdbc4`：NextClaw metadata 已绑定 `codex_thread_id=019ed173-c070-7ca3-812c-f8dad15fb373`，Codex rollout 文件也包含两轮真实消息，但排查时 Codex Desktop `threads` 表完全没有对应 row。同一 workspace root 下 sqlite 当时只索引 40 个 active thread，而 rollout 事实源已有 43 个 thread。此时不是 stale row，而是 Desktop 索引缓存缺失 row，sidebar 没有任何可展示入口。

这个问题不能放到 NextClaw kernel 或通用 NARP stdio client 里修。Codex Desktop 是外部产品，它的 sidebar state 是 Codex 私有状态；NextClaw 主干只应该表达 NCP/NARP/runtime/session 语义，不应该硬编码 Codex Desktop 的 JSON key。

## 目标

- NextClaw 使用 Codex NARP runtime 时，自动让对应 `workingDirectory` 成为 Codex Desktop 已知 workspace root。
- Codex app-server turn 完成后，自动把 Codex rollout 中已经存在的最新 thread 元数据同步或 materialize 到 Codex Desktop 的 `threads` 索引缓存。
- 补丁必须位于 Codex runtime extension 边界，保持 kernel、service、通用 stdio client 不感知 Codex Desktop。
- 补丁必须幂等、可关闭、best-effort，失败不能影响 Codex 会话运行。
- 不默认把 thread 强行加入 `projectless-thread-ids`，避免把项目会话错误归类为 projectless。
- Codex Desktop 已经运行时，优先走它自己的 deep link 活入口同步主进程内存态，避免外部直接改 JSON 被 Desktop 后续写回覆盖。
- thread index 同步必须是可插拔接口；如果未来 Codex app-server 暴露官方刷新 API，应能替换掉 sqlite patch 实现。

## 非目标

- 不修改 Codex Desktop 源码。
- 不修改 OpenAI Codex app-server runtime；NextClaw 只能在自己的 adapter 边界做外围同步。
- 不新增通用 `ExternalDesktopIntegrationManager`。当前真实变化点只有 Codex Desktop 私有 state，提前泛化会变成空心抽象。
- 不在 kernel / NARP stdio host-side client 里加入 `codex` 分支。
- 不直接依赖 Codex Desktop renderer 内部 IPC；NextClaw 只能调用公开 `codex://` 协议或做磁盘兜底。
- 不把 NextClaw journal 写成 Codex Desktop 事实源；thread index 同步只从 Codex 自己的 rollout 文件推导缓存字段。

## Owner 与边界

正确 owner 分成两个相邻但独立的 Codex 专属 extension service：

- `packages/extensions/nextclaw-narp-runtime-codex-sdk` 内部的 Codex Desktop visibility patch service，负责 workspace root 可见性。
- `packages/extensions/nextclaw-ncp-runtime-codex-sdk` 内部的 Codex Desktop thread index sync service，负责 app-server turn 完成后的 thread 索引缓存同步。

workspace visibility patch 的职责只包括：

- 解析 Codex home；
- 优先调用 Codex Desktop `codex://new?path=...` deep link；
- 读取与兜底写回 `.codex-global-state.json`；
- 将 NextClaw 传给 Codex 的 `workingDirectory` 幂等写入：
  - `electron-saved-workspace-roots`
- 保留未知字段；
- 失败时输出 warning 并让主运行链路继续。

它不负责：

- 决定 session 的 `project_root`；
- 创建或恢复 Codex thread；
- 修改 NARP protocol；
- 解释 Codex Desktop UI 分组之外的产品语义。

thread index sync 的职责只包括：

- 解析 Codex home 与 `state_5.sqlite` 路径；
- 优先读取 Codex Desktop `threads` 行里的 `rollout_path`；
- 当 row 缺失或 `rollout_path` 不可用时，按 thread id 在 Codex `sessions` 目录查找 rollout jsonl；
- 从 Codex rollout jsonl 读取 session meta、最新 timestamp、token count 和用户消息存在性；
- 在 schema guard 通过时，幂等更新已有 row 的 `updated_at`、`updated_at_ms`、`tokens_used`、`has_user_event`；
- 当 row 缺失时，从 rollout `session_meta` 与 `event_msg.user_message` materialize 一条最小完整 `threads` 索引 row；
- 失败时输出 warning/error 并让 NCP run 完成链路继续。

thread index sync 不负责：

- 创建、恢复或解释 Codex thread；
- 修改 Codex app-server 协议；
- 从 NextClaw session journal 补写 Codex transcript；
- 改写 Codex Desktop 用户当前 active workspace。

## 数据流

```text
NextClaw session project_root / fallback workspace
  -> NARP executionContext.cwd
  -> CodexNarpRuntimeWrapper.threadOptions.workingDirectory
  -> CodexDesktopVisibilityPatchService.ensureWorkspaceVisible
  -> codex://new?path=<workingDirectory>
  -> Codex Desktop main process updates globalState and broadcasts workspace updates
  -> fallback: CODEX_HOME/.codex-global-state.json
  -> Codex Desktop sidebar grouping can map thread.cwd to a known local project
```

thread index sync 数据流：

```text
Codex app-server turn/completed
  -> CodexAppServerNcpAgentRuntime emits NCP completion events
  -> CodexDesktopThreadIndexSync.syncThread(threadId)
  -> existing row: CODEX_HOME/sqlite/state_5.sqlite threads.rollout_path
  -> missing row: CODEX_HOME/sessions/**/<threadId>.jsonl
  -> Codex rollout jsonl summary
  -> update or insert threads index row
  -> Codex Desktop sidebar can sort and open the current transcript
```

## 可配置策略

补丁默认开启，因为这是 Codex NARP runtime 的产品集成修复。用户或调试环境可以设置：

```bash
NEXTCLAW_CODEX_DESKTOP_VISIBILITY_PATCH=0
```

来关闭补丁。关闭后 Codex runtime 仍正常运行，只是不再修复 Codex Desktop sidebar 可见性。

thread index sync 也默认开启，因为它只同步 Codex 自己已经写入 rollout 的索引缓存。用户或调试环境可以设置：

```bash
NEXTCLAW_CODEX_DESKTOP_THREAD_INDEX_SYNC=0
```

来关闭该同步。关闭后 NextClaw/Codex 主运行链路仍正常运行，只是不再修复 Codex Desktop 的 thread index stale 状态。

## 注册策略

- `workingDirectory` 为空或不是绝对路径时跳过。
- 如果 `electron-saved-workspace-roots` 已包含当前 root，则直接跳过，避免重复唤起 Codex Desktop。
- macOS 或测试注入了 opener 时，优先调用 `codex://new?path=<root>`。这是 Codex Desktop 源码中 `PB -> RB -> R$` 的正式路径，会更新 Desktop 主进程 globalState 并广播 `workspace-root-options-updated` / `active-workspace-roots-updated`。
- deep link 调用后轮询 state，确认 Desktop 已把 root 写入 saved roots 后才认为成功。`active-workspace-roots` 是 Codex Desktop 当前选择状态，不作为可见性成功条件，避免后续重复抢焦点。
- deep link 不可用或验证超时时，才落回磁盘补丁。

## 磁盘兜底策略

- `CODEX_HOME` 存在时使用 `CODEX_HOME/.codex-global-state.json`。
- 否则使用 `~/.codex/.codex-global-state.json`。
- state 文件不存在时创建最小 JSON object。
- state 文件已存在但 JSON 无法解析，跳过并记录 warning，不覆盖用户数据。
- 写入前保留未知字段。
- 兜底写入只维护 `electron-saved-workspace-roots`，不改 `project-order` 或 `active-workspace-roots`，避免把“让项目可见”扩大成“切换用户当前项目选择”。
- 写入使用临时文件 + rename，降低半写入风险。
- 如果已有 state 文件，首次改写前生成一次 `.nextclaw-backup` 备份。

## Thread Index Sync 策略

- 只在 `turn/completed` 后触发，不在 read/status/list 路径里暗中写状态。
- runtime 只依赖 `CodexDesktopThreadIndexSync` 接口；默认实现可以被测试替身或未来官方刷新实现替换。
- `state_5.sqlite` 不存在时跳过，不主动创建 Codex Desktop 数据库。
- `threads` 表缺少必需列时跳过并记录 warning，避免把未知 schema 当成稳定合同。
- 已有 row 的 rollout path 优先来自 Codex Desktop 自己的 `threads.rollout_path`，并且必须是存在的绝对路径。
- row 缺失或 path 不可用时，只从 Codex 自己的 `sessions` 目录按 thread id 查找 rollout 文件；不从 NextClaw journal 推导 transcript。
- `updated_at` 只向前更新，`tokens_used` 只按更大的累计 token count 更新，`has_user_event` 只在 rollout 确认存在用户消息后置为 `1`。
- 插入缺失 row 时，`created_at/updated_at/source/model_provider/cwd/cli_version` 来自 rollout `session_meta`；`title/first_user_message/preview` 优先使用 `event_msg.user_message`，避免把 NARP 注入的项目上下文当成用户标题。
- 插入缺失 row 时只 materialize Desktop 索引缓存，不创建 Codex transcript，不补写 NextClaw journal，也不修改 workspace active selection。
- sqlite 被锁、`node:sqlite` 不可用、rollout 解析失败或 schema 不匹配时，记录诊断但不影响 NCP run 完成。

## 验证标准

- 单测证明会优先调用 `codex://new?path=...` 注册 workspace root。
- 单测证明 deep link 不可用时会兜底写入 `electron-saved-workspace-roots`，且保留用户当前 active workspace。
- 单测证明重复调用不会产生重复 root。
- 单测证明禁用环境变量会跳过写入。
- 单测证明 wrapper 会把最终 `cwd` 交给 visibility patch。
- 单测证明 thread index sync 会从 rollout 文件更新 stale sqlite row。
- 单测证明 thread index sync 会在 sqlite row 缺失时从 Codex rollout materialize 最小完整 row。
- 单测证明 thread index sync 可以通过环境变量关闭。
- 单测证明 app-server runtime 在 `turn/completed` 后调用可插拔 sync 接口，而不是写死默认实现。
- `tsc`、包测试、包 lint 通过。
- 真实本地 Codex global state 验证：`open codex://new?path=/Users/peiwang/.nextclaw/workspace` 后，state 文件包含该 root；后续 Codex Desktop 写回 active workspace 变化时，该 root 仍保留在 saved roots 中。
