# Platform SDK 第一纵向闭环实施计划

日期：2026-08-22

## 1. 可观察目标

在不改变现有 `nextclaw agent`、server、UI、Desktop 和既有 `@nextclaw/kernel` 根导出的前提下，交付一条可供真实外部消费者使用的最小纵向链：

```text
@nextclaw/harness
  -> @nextclaw/kernel
  -> new NextclawHarness / runNextclawTask
  -> Agent / Session / Run handles
  -> tools / context / models / runtimes / MCP contributions
  -> 现有 AgentRunClient + NCP ingress/event
  -> nextclaw exec
  -> text / json / jsonl + cancel / timeout
```

完成后，脚本和 CI 可以通过 `nextclaw exec` 执行一次 Agent 任务；Node.js 消费者可以通过 `@nextclaw/harness` 根公共入口启动、运行并释放 Harness；两种入口共享现有 kernel/NCP 主链路。

## 2. 风险与成功证据

风险等级为 L3：改动跨越公开 package、kernel 生命周期、service host、CLI I/O 和会话执行链，并新增用户可见命令。

最小充分证据：

1. 改动前后 `@nextclaw/kernel`、`@nextclaw/service`、`nextclaw` 的 TypeScript 检查通过。
2. 现有 `AgentRunClient` 与 `nextclaw agent` 定向测试保持通过。
3. 新 Harness contract tests 覆盖 start、run、event、cancel、dispose、启动失败回滚和重复释放。
4. 新 exec tests 覆盖 argv/stdin、文本、JSON、JSONL、超时、SIGINT、错误和 stdout/stderr 分流。
5. 构建后的外部消费者示例只导入 `@nextclaw/harness`，不使用源码 alias 或 deep import。
6. 对 CLI 做至少一次不调用真实模型的命令注册/输入输出冒烟；有可用本地 provider 时再追加真实 run，不把凭据可用性作为合同测试前提。
7. diff-only maintainability review 无未关闭 finding。

## 3. 兼容不变量

- 不删除、重命名或收紧任何既有根导出。
- 不修改 `nextclaw agent` 的参数、默认 session、输出或交互循环。
- 不改变 server、UI、Desktop、channel 和 cron 的调用路径。
- Harness 与 exec 复用现有 `AgentRunClient`、NCP ingress/event 和 kernel lifecycle，不建立第二套 agent loop。
- 新公开 API 的实现归 `@nextclaw/kernel` 根公共入口；外部安装与导入统一使用轻量 `@nextclaw/harness` facade，不建立 Kernel 子路径入口。
- `nextclaw exec` 未指定 session 时创建新的 `exec:<uuid>`，避免意外复用 `cli:default` 或用户主会话；只有显式 `--session` 才恢复既有 session。
- 机器输出模式的 stdout 只承载合同数据，普通日志和诊断写 stderr。
- 取消只通过现有 NCP abort ingress 进入统一状态机；CLI 不直接终止 runtime 内部状态。
- 所有新增均可通过删除 Harness 入口、命令注册和适配器回滚，不需要数据迁移。

## 4. 第一批公共合同

### 4.1 Harness

公开但标记为 experimental 的子入口：

```ts
import {
  Contribution,
  NextclawHarness,
  runNextclawTask,
  type IKernel,
  type NextclawTaskInput,
  type NextclawTaskResult,
} from "@nextclaw/harness";
```

`NextclawHarness` 第一版只承诺：

- `start()`：装载当前配置的 extensions 并启动 kernel，重复调用不重复启动。
- `runTask(input)`：执行一次任务并返回 session/run identity、最终文本与消息；通过 callback 观察公共 NCP event。
- `agents / sessions`：创建或恢复稳定 handle，并通过 `run.events()/result()/cancel()` 观察 live run。
- `contributions`：在 start 前注册扩展；能力直接由受限 `IKernel` 结构表达，不维护并行的静态 capability catalog。
- public Contribution 通过受限 `IKernel` 使用 Kernel 原实例 `eventBus / ingress`，以及 `tools / context / models / runtimes / mcp` 薄适配，不访问 manager graph。
- `dispose()`：幂等释放 owned kernel resources；启动中途失败也要回滚。

`runNextclawTask()` 是 one-shot helper：内部创建 Harness、start、run，最后始终 dispose。

`NextclawTaskInput` 第一版包含：

- `input: string`
- `agentId?: string`
- `sessionId?: string`
- `model?: string`
- `signal?: AbortSignal`
- `onEvent?: (event: NcpEndpointEvent) => void`
- `onAssistantDelta?: (delta: string) => void`

`NextclawTaskResult` 使用版本化 envelope，包含：

- `schemaVersion`
- `status: "completed"`
- `kind: "agent" | "command"`
- `agentId`
- `sessionId`
- `runId: string | null`
- `text`
- `completedMessage: NcpMessage | null`

空输入在进入 kernel 前失败。第一版公共错误只冻结 `invalid_input`、`cancelled`、`lifecycle` 和 `runtime_failure` 四类，不把内部异常类型泄漏给消费者。

### 4.2 `nextclaw exec`

```bash
nextclaw exec [prompt...] \
  [--agent <id>] \
  [--session <id>] \
  [--model <model>] \
  [--format text|json|jsonl] \
  [--timeout <ms>]
```

输入规则：

- 有 prompt 参数时使用参数；同时存在 piped stdin 时，把 stdin 作为同一次任务的追加上下文。
- 无 prompt 时读取 piped stdin。
- 两者都为空时返回 `invalid_input`，不得进入交互模式。

输出规则：

- `text`：stdout 只输出最终文本。
- `json`：stdout 只输出一个 `nextclaw.exec/v1` 最终 envelope。
- `jsonl`：每个 NCP event 输出一个 event envelope，最后输出 result 或 error envelope。
- 诊断与非合同日志写 stderr。

退出分类：

- `0`：completed。
- `2`：参数或输入错误。
- `130`：SIGINT、timeout 或其它 caller cancellation。
- `1`：lifecycle、配置、provider、runtime 或未知失败。

## 5. 实现顺序

### Step A：补齐现有 dispatch 结果面

- 在现有 NCP direct dispatch 中增加返回结构化结果的 additive 函数。
- 既有 `dispatchPromptOverNcp()` 保持签名与文本结果不变，只复用新函数。
- 把已有 `AgentRunReplyOptions.onEvent` 正式向上透传。

### Step B：增加 experimental Harness 入口

- 新增 Harness types、组合根 manager、one-shot helper 和 contract tests；组合根直接命名为 `NextclawHarness`，不使用 `Service` 后缀。
- 更新 `@nextclaw/kernel` exports/build entry，但不修改根入口导出集合。
- start/dispose 状态机由 Harness 独占，禁止调用方访问内部 manager graph。

### Step C：增加独立 Harness facade package

- 新增 `@nextclaw/harness`，只对白名单 API 和类型进行转发。
- package 独立拥有 exports、semver、README 和 public-surface contract test。
- 外部示例与开发者文档只使用 facade，kernel 子路径不作为推荐安装入口。

### Step D：service host 适配

- `NextclawServiceRuntime` 增加窄的 `runTask` 能力，负责产品 home/config/version 和 activity sink 注入。
- service 不实现 event/result/cancel 语义，只调用 Harness。

### Step E：CLI adapter

- 新增独立 `exec` command registration 与 controller。
- controller 负责 argv/stdin、format、timeout、SIGINT、stdout/stderr 和 exit code。
- 在机器模式中隔离普通 console 输出，保证 stdout 合同纯净。

### Step F：外部消费者与文档

- 增加一个 private workspace example，只从 `@nextclaw/harness` 导入。
- 更新 `docs/USAGE.md` 与 package resource 副本。
- 因新增用户可见命令添加 changeset；不发布、不提交。

## 6. 本批明确非目标

- 不实现完整 App Server 或 Client SDK 协议重构。
- 不清理 `@nextclaw/kernel` 当前根入口的历史 manager 导出。
- 不把核心执行逻辑迁入 `@nextclaw/harness` facade，也不复制 kernel 状态机。
- 不开放替换 agent loop、storage、sandbox、skill、channel 或 app；先使用已验证的 event bus、ingress 与五类基础组装能力。
- 不承诺同一 session 的并发 run 语义。
- 不在底层尚无统一 structured-output contract 时伪造 `outputSchema`；该能力列入后续优化。
- 不修改现有用户配置、session journal 或持久化格式。

## 7. 后续批次

第一批通过后，按真实示例暴露的缺口继续：

1. Structured output 与 approval：补齐 schema 结果、headless 审批 handler 和 fail-closed 政策。
2. Skill / storage / sandbox：在 owner 与持久化语义稳定后补充下一批 capability namespace。
3. App Server：从同一 agent/session/run/event contract 生成协议和 client types。
4. Public surface 减债：逐步把 manager/store/controller 从 kernel 根入口迁出或标记 internal。

每一批都必须继续遵守“新增公共主链 -> 内部 dogfooding -> 删除等价旧胶水 -> 合同验证”的顺序。
