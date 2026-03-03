# Agent Engine ACP SDK 架构方案

## 迭代完成说明（改了什么）

- 已开启新迭代目录：`docs/logs/v0.9.0-agent-engine-acp-sdk/`（去除日期层级）。
- 已创建版本日志文件：`docs/logs/v0.9.0-agent-engine-acp-sdk/agent-engine-acp-sdk-architecture.md`。
- 已将本轮讨论沉淀为单文件架构文档（本文件），覆盖：
  - 当前架构可替换性评估
  - ACP 与 AgentEngine 的职责边界
  - Codex SDK / Claude Agent SDK / ACP 三条接入路线
  - 推荐目标架构、切换策略、实施里程碑与风险控制
- 已完成 Phase 1 最小落地（行为不变）：
  - 新增 `AgentEngine` 接口类型：`packages/nextclaw-core/src/engine/types.ts`
  - 新增 `NativeAgentEngine` 包装：`packages/nextclaw-core/src/engine/native.ts`
  - Runtime Pool 从 `AgentLoop` 直接依赖改为 `AgentEngine` 依赖：
    `packages/nextclaw/src/cli/commands/agent-runtime-pool.ts`
  - core 导出新增 `engine` 模块：`packages/nextclaw-core/src/index.ts`

## 背景与目标

### 背景

当前 Nextbot（NextClaw）已经具备多渠道、会话隔离、工具调用、配置热重载等能力，但 Agent 运行核心仍以 `AgentLoop` 为中心，尚未抽象为可插拔“引擎层”。

### 目标

在不破坏现有功能的前提下，实现“可替换、可扩展、可动态切换”的 Agent 引擎能力，支持：

- 保留现有原生引擎（Native）
- 接入 ACP 服务（如 `codex-acp`、`claude-agent-acp`）
- 直接接入 `Codex SDK`
- 直接接入 `Claude Agent SDK`

## 当前情况评估（基于代码）

### 已抽象（可复用）

- Provider 层已经抽象：`LLMProvider` 与 `ProviderManager`。
- 配置与热更新链路已存在：支持 runtime rebuild、provider reload、plugin reload。
- 路由与会话体系已工程化：`bindings`、`session.dmScope`、`agentToAgent.maxPingPongTurns`。

### 未抽象（当前瓶颈）

- Runtime Pool 仍然直接实例化 `AgentLoop`，引擎类型被写死。
- `AgentLoop` 同时承担：上下文构建、模型调用、tool loop、会话落盘、流式聚合。
- 插件兼容层中 command/http/service 注册能力尚未完整支持（仍有 unsupported 提示）。

### 结论

- 现在是“Provider 可替换”，不是“Agent Engine 可替换”。
- 若要支持 Codex/Claude 的 SDK 与 ACP 并存，必须新增引擎抽象层。

## ACP vs AgentEngine（职责边界）

### ACP 是什么

- ACP（Agent Client Protocol）是外部互联协议，解决“客户端/平台如何和 Agent 服务通信”。
- 适合做生态接入标准，不适合直接替代内部运行时抽象。

### AgentEngine 是什么

- AgentEngine 是 Nextbot 内部接口，解决“业务层如何调用不同引擎实现”。
- 可稳定承载内部一致性（会话、事件、错误码、审计、切换策略）。

### 推荐关系

- **AgentEngine 作为内核抽象**。
- **ACP 作为 AgentEngine 的一种实现（AcpEngine）**。
- 同时允许 `CodexSdkEngine` / `ClaudeSdkEngine` 并列存在。

## 目标架构（推荐）

### 引擎实现矩阵

- `NativeEngine`：包装现有 `AgentLoop`，保证零回归迁移。
- `AcpEngine`：对接外部 ACP 服务（`codex-acp` / `claude-agent-acp`）。
- `CodexSdkEngine`：直连 `@openai/codex-sdk`（Node 侧优先）。
- `ClaudeSdkEngine`：直连 Claude Agent SDK（可 Node or Python sidecar）。

### 统一内部事件协议（建议）

- `delta`
- `tool_call`
- `tool_result`
- `final`
- `error`

说明：各引擎输出都先映射为统一事件，再进入现有 UI/会话/日志链路。

### 动态切换策略（建议默认）

- `on_new_turn`：仅新回合生效，在途回合不抢占。
- `drain_then_switch`：等待流结束再切。
- `force`：仅人工故障处置使用。

## 分阶段实施计划

### Phase 1：抽象落地（不改行为）

- 新增 `AgentEngine` 接口。
- 将现有 `AgentLoop` 包装为 `NativeEngine`。
- Runtime Pool 改为依赖 `AgentEngine` 实例（当前实现为 `NativeAgentEngine`）。

验收标准：现有功能零行为回归。

### Phase 2：ACP 引擎

- 实现 `AcpEngine`，支持会话映射、事件转换、取消、恢复。
- 首先接入 `codex-acp`，再接 `claude-agent-acp`。

验收标准：同一任务可由 ACP 后端稳定执行并回传统一事件。

### Phase 3：直连 SDK 引擎

- 实现 `CodexSdkEngine`。
- 实现 `ClaudeSdkEngine`（如需 Python SDK，则采用 sidecar 桥接）。

验收标准：SDK 路线可独立运行并与 ACP 路线共存。

### Phase 4：策略与运营能力

- 能力协商（capabilities）
- 降级机制（不支持特性时的统一 fallback）
- 统一错误码与观测指标

验收标准：多引擎切换可观测、可排障、可回滚。

## 风险与应对

- 协议能力不一致（ACP 服务差异）
  - 应对：能力协商 + 降级，不做伪兼容。
- 会话映射复杂（`sessionKey` 与外部 session id）
  - 应对：引入持久化映射表与恢复机制。
- 动态切换导致上下文断裂
  - 应对：默认 `on_new_turn`，严禁在途强切。
- 多实现并存导致维护成本上升
  - 应对：强制统一内部事件模型与 conformance tests。

## 测试 / 验证 / 验收方式

本次已完成 Phase 1 代码改造，验证如下：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm build
PATH=/opt/homebrew/bin:$PATH pnpm lint
PATH=/opt/homebrew/bin:$PATH pnpm tsc
PATH=/opt/homebrew/bin:$PATH node packages/nextclaw/dist/cli/index.js --help
```

验收点：

- `build` 通过（全工作区包构建成功）。
- `lint` 通过（仅存在仓库既有 max-lines 警告，无新增 error）。
- `tsc` 通过（全工作区类型检查通过）。
- CLI 冒烟通过（`nextclaw --help` 正常输出命令列表）。

## 发布 / 部署方式

- 本次为“架构 + Phase 1 实现”迭代，不涉及 npm 包发布、服务部署、数据库变更。
- 发布闭环动作判定：
  - migration：不适用
  - deploy：不适用
  - 线上冒烟：不适用

当进入实现迭代后，按项目发布流程执行：

- 先完成 `build/lint/tsc` 与对应冒烟
- 再按 `docs/workflows/npm-release-process.md` 执行 version/publish（若涉及发包）

## 用户 / 产品视角验收步骤

1. 打开本文件，确认可以一眼看到“当前情况、目标架构、阶段计划、风险”。
2. 确认路线清晰：`Native + ACP + SDK` 三类引擎并存，而不是二选一。
3. 确认切换策略明确：默认新回合切换，不打断在途任务。
4. 确认后续研发可直接按 Phase 1~4 排期执行。
5. 验证当前行为未变（CLI 可正常输出帮助信息，运行链路不报错）。

## 附：后续实施入口建议（文件级）

- `packages/nextclaw-core/src/engine/`（新增引擎接口与实现）
- `packages/nextclaw/src/cli/commands/agent-runtime-pool.ts`（改为 EngineFactory）
- `packages/nextclaw-core/src/config/schema.ts`（新增 engine 配置）
- `packages/nextclaw-core/src/config/reload.ts`（新增 engine 变更策略）
- `packages/nextclaw-core/src/agent/loop.ts`（包装为 NativeEngine）
