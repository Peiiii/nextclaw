# Codex Desktop 会话可见性自动补丁设计

## 背景

NextClaw 通过 Codex NARP runtime 创建的 Codex thread 已经能写入 Codex 自身的 sqlite 与 rollout 文件，但 Codex Desktop 侧边栏并不是直接展示所有 thread。它会先把 thread 按已知 workspace root、projectless thread 或显式 project assignment 分组；如果 thread 的 `cwd` 不属于 Codex Desktop 已知 workspace root，就会变成 UI 上不可见的 orphan thread。

这个问题不能放到 NextClaw kernel 或通用 NARP stdio client 里修。Codex Desktop 是外部产品，它的 sidebar state 是 Codex 私有状态；NextClaw 主干只应该表达 NCP/NARP/runtime/session 语义，不应该硬编码 Codex Desktop 的 JSON key。

## 目标

- NextClaw 使用 Codex NARP runtime 时，自动让对应 `workingDirectory` 成为 Codex Desktop 已知 workspace root。
- 补丁必须位于 Codex runtime extension 边界，保持 kernel、service、通用 stdio client 不感知 Codex Desktop。
- 补丁必须幂等、可关闭、best-effort，失败不能影响 Codex 会话运行。
- 不默认把 thread 强行加入 `projectless-thread-ids`，避免把项目会话错误归类为 projectless。
- Codex Desktop 已经运行时，优先走它自己的 deep link 活入口同步主进程内存态，避免外部直接改 JSON 被 Desktop 后续写回覆盖。

## 非目标

- 不修改 Codex Desktop 源码。
- 不新增通用 `ExternalDesktopIntegrationManager`。当前真实变化点只有 Codex Desktop 私有 state，提前泛化会变成空心抽象。
- 不在 kernel / NARP stdio host-side client 里加入 `codex` 分支。
- 不直接依赖 Codex Desktop renderer 内部 IPC；NextClaw 只能调用公开 `codex://` 协议或做磁盘兜底。

## Owner 与边界

正确 owner 是 `packages/extensions/nextclaw-narp-runtime-codex-sdk` 内部的 Codex Desktop visibility patch service。

它的职责只包括：

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

## 可配置策略

补丁默认开启，因为这是 Codex NARP runtime 的产品集成修复。用户或调试环境可以设置：

```bash
NEXTCLAW_CODEX_DESKTOP_VISIBILITY_PATCH=0
```

来关闭补丁。关闭后 Codex runtime 仍正常运行，只是不再修复 Codex Desktop sidebar 可见性。

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

## 验证标准

- 单测证明会优先调用 `codex://new?path=...` 注册 workspace root。
- 单测证明 deep link 不可用时会兜底写入 `electron-saved-workspace-roots`，且保留用户当前 active workspace。
- 单测证明重复调用不会产生重复 root。
- 单测证明禁用环境变量会跳过写入。
- 单测证明 wrapper 会把最终 `cwd` 交给 visibility patch。
- `tsc`、包测试、包 lint 通过。
- 真实本地 Codex global state 验证：`open codex://new?path=/Users/peiwang/.nextclaw/workspace` 后，state 文件包含该 root；后续 Codex Desktop 写回 active workspace 变化时，该 root 仍保留在 saved roots 中。
