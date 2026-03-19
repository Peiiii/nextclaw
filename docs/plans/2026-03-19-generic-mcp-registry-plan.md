# Generic MCP Registry Plan

## 这份文档回答什么

这份文档专门回答：

Nextclaw 如何从“已经能接入外部 agent runtime”继续演进到“具备通用 MCP 集成能力”，并且让用户体验尽可能接近：

```bash
codex mcp add chrome-devtools -- npx chrome-devtools-mcp@latest
```

这份方案刻意做两个收束：

- 必须是通用 MCP 能力，不能做成 `codex` 私有特判。
- 方案层一次性覆盖 `stdio`、`http`、`sse` 三类 transport，但本阶段不同时推进额外 runtime adapter。

当前阶段的目标不是立刻让所有 runtime 都消费 MCP，而是先把“平台级 MCP registry + 配置模型 + CLI + 生命周期基础设施”设计成长期正确形态。

## 背景判断

当前仓库已经具备一部分与 MCP 相关的基础，但还没有形成真正面向用户的 MCP 产品能力。

已有基础包括：

- NCP runtime registry 已成立，`native` 与可选 `codex` runtime 已有接入结构。
- `Codex SDK` runtime 的事件映射层已经能识别 `mcp_tool_call` 语义。
- `ui.ncp.runtimes` 已经是通用 runtime 容器，而不是单一平台硬编码。

但当前仍缺少以下关键能力：

- 没有统一的 `mcp server registry`。
- 没有类似 `nextclaw mcp add ...` 的用户入口。
- 没有对 `stdio/http/sse` 三类 transport 的统一配置模型。
- 没有将 MCP server 生命周期、健康检查、可见性、作用域、安全边界系统化。

所以当前状态不是“完全没有 MCP”，而是“只有局部 runtime 痕迹，没有平台级 MCP 集成面”。

## 结合当前非 Legacy 主链路后的调整

在这份方案最初成稿之后，项目的非 legacy 主链路又继续做了一轮结构收敛。

结合当前代码，下面这些判断需要明确写进方案：

1. 非 legacy 主链路的真正执行核心，已经更明确地下沉到 `NCP toolkit / agent backend / agent runtime / tool registry` 这一层，而不是 UI controller 或前端页面层。
2. `DefaultNcpAgentBackend`、`AgentLiveSessionRegistry`、`RuntimeFactoryParams` 这些结构，已经把 session、runtime、metadata 的责任边界收得比较清楚。
3. native 主链路里的工具能力，当前是通过 `NextclawNcpToolRegistry` 汇总进 `DefaultNcpAgentRuntime`，因此 MCP 的第一个消费点不应被笼统描述为“某个 runtime”，而应更准确地描述为“native 的 tool assembly 边界”。
4. `/api/ncp/session-types`、`NcpSessionRoutesController`、`NcpChatPage` 这些层负责会话类型与界面消费，但它们不是 MCP 首期的正确接入点。

这意味着：

- 我们原方案的大方向是对的，不需要推翻。
- 但“首个 consumer 的接入位置”和“新代码的包边界”需要更贴近当前重构后的主链路。

## 调整后的核心判断

在当前结构下，MCP 首期不应该接进：

- UI session type controller
- 前端 session type state
- `DefaultNcpAgentBackend` 的 session/runtime 生命周期
- `AgentLiveSessionRegistry` 的持久化与 hydration 逻辑

这些层目前已经比较纯粹，继续把 MCP 塞进去只会把生命周期复杂度扩散出去。

更合理的首个消费位置应是：

- native 主链路的 tool assembly 边界
- 也就是 `NcpToolRegistry` / `NextclawNcpToolRegistry` 一侧

原因很简单：

1. `DefaultNcpAgentRuntime` 只认 `NcpToolRegistry`。
2. 当前 native 工具能力已经在 `NextclawNcpToolRegistry` 统一组装。
3. MCP server 暴露出来的本质也是“工具集合”，因此首期最自然的接缝就是“把 MCP tool catalog 适配为 `NcpTool`”。
4. 这样能保持 `DefaultNcpAgentBackend`、session store、UI session type 等层继续纯粹，不被 transport/lifecycle 污染。

## 核心判断

MCP 必须被定义为平台级能力，而不是某个 runtime 的附属配置。

也就是说，正确结构不是：

- `ui.ncp.runtimes.codex.mcpServers`
- `ui.ncp.runtimes.native.mcpServers`
- 未来别的 runtime 再各自发明一套配置

而应该是：

```text
Nextclaw Core
  -> MCP Registry
  -> MCP Server Definitions
  -> Transport Adapters (stdio/http/sse)
  -> Process / connection lifecycle
  -> Health / diagnostics / visibility

Runtime side
  -> runtime-specific MCP adapter (future)
  -> consume shared MCP registry
```

这样做的原因是：

1. MCP server 本身是平台资产，不属于任何单一 runtime。
2. 同一个 server 未来可能被多个 runtime 复用。
3. transport、鉴权、生命周期、跨平台行为、健康检查都应该只实现一次。
4. 未来接 `Codex`、`Claude Code`、自研 runtime 时，都应消费同一份 registry。

## 非目标

本方案阶段不做：

- 同时落地 `codex`、`claude-code` 等多个 runtime adapter
- 为每个 runtime 都立即打通工具调用
- UI 上一次性做完完整 MCP 管理面板
- Marketplace 的 MCP server 一键安装
- 自动信任任意第三方命令

这里要明确一个边界：

- 本次设计的是“平台级 MCP 基础设施”
- 不是“先给某个 runtime 糊一个私有通道”

## 目标用户体验

长期目标用户体验应接近：

```bash
nextclaw mcp add chrome-devtools -- npx chrome-devtools-mcp@latest
nextclaw mcp list
nextclaw mcp doctor chrome-devtools
```

并且形成下面这条自然路径：

1. 用户通过 CLI 或后续 UI 注册一个 MCP server。
2. Nextclaw 持久化这份 server 定义。
3. 平台根据 transport 类型建立连接或启动本地进程。
4. 可消费该能力的 runtime 以后通过统一 adapter 读取 registry。
5. 聊天或 agent 执行时，工具能力自然出现，而不是要求用户再理解底层配置细节。

## 推荐架构

### 1. 平台级 MCP Registry

新增独立的 MCP registry 概念，由 Core 负责持久化和管理。

职责包括：

- 保存所有已注册 MCP server 的定义
- 维护 server 的启用状态
- 描述 transport 类型与连接参数
- 维护作用域与可见性
- 提供 list / get / add / update / remove / enable / disable / doctor 接口
- 为未来 runtime adapter 暴露统一读取视图

MCP registry 不应放进某个 runtime 的私有配置下，而应位于全局配置顶层，例如：

```json
{
  "mcp": {
    "servers": {
      "chrome-devtools": {
        "enabled": true,
        "transport": {
          "type": "stdio",
          "command": "npx",
          "args": ["chrome-devtools-mcp@latest"],
          "cwd": null,
          "env": {}
        },
        "scope": {
          "runtimes": ["native"],
          "agents": [],
          "sessions": []
        },
        "policy": {
          "trust": "explicit",
          "start": "lazy"
        }
      }
    }
  }
}
```

### 2. Transport 抽象层

MCP transport 必须一开始就抽象成统一层，避免后续为 `stdio/http/sse` 走三套完全不同的管理逻辑。

建议统一模型：

```text
McpServerDefinition
  -> id
  -> enabled
  -> transport
  -> auth
  -> scope
  -> policy
  -> metadata
```

其中 `transport` 是一个 discriminated union：

- `stdio`
- `http`
- `sse`

#### `stdio`

典型场景：

- `npx chrome-devtools-mcp@latest`
- 本地 node/python/go 可执行程序
- 需要由 Nextclaw 负责启动进程

字段建议：

- `command`
- `args`
- `cwd`
- `env`
- `shell`（默认 false）
- `windowsCommandLine`（必要时为 Windows 单独保留）

#### `http`

典型场景：

- 远端或本地常驻 MCP 服务
- 通过 HTTP 请求建立 JSON-RPC/streaming 语义

字段建议：

- `baseUrl`
- `headers`
- `timeoutMs`
- `authRef`
- `verifyTls`

#### `sse`

典型场景：

- 服务端以 SSE 暴露 MCP event stream
- 客户端需要建立长连接并维护重连

字段建议：

- `url`
- `headers`
- `timeoutMs`
- `authRef`
- `reconnect`
  - `enabled`
  - `initialDelayMs`
  - `maxDelayMs`

这里要注意：

- 方案层必须一次设计完整 `http/sse`
- 实施时允许先把底座写好、把真正可用闭环优先落在 `stdio`

### 3. Lifecycle Manager

MCP server 不能只是配置对象，还必须有运行时生命周期管理层。

建议新增 `McpServerLifecycleManager`，职责包括：

- `stdio` 进程的启动、停止、重启、退出码观察
- `http/sse` 连接的建立、超时、断线重连、失败状态归档
- 健康状态汇总
- 首次连接失败的结构化错误
- 对外暴露只读状态视图

建议定义统一状态：

- `disabled`
- `idle`
- `connecting`
- `ready`
- `degraded`
- `failed`

以及统一诊断字段：

- `lastStartedAt`
- `lastReadyAt`
- `lastError`
- `lastExitCode`
- `restartCount`

### 4. Scope 与 Visibility

同一个 MCP server 不应默认对所有 runtime、agent、session 全开放。

建议从第一版就保留作用域模型：

- `runtimes`
- `agents`
- `sessions`

首期可先只真正消费 `runtimes`，但数据模型不要堵死后路。

默认推荐：

- 若用户未指定 scope，先写入 `runtimes: ["native"]`
- 不自动对所有未来 runtime 开放

这样更安全，也更符合“最小暴露面”原则。

### 5. Runtime Adapter Boundary

虽然本阶段不实现额外 adapter，但边界必须先定义好。

未来每个 runtime adapter 都应只做这件事：

- 读取共享的 MCP registry 视图
- 过滤出自己作用域内可见的 server
- 转成该 runtime 可理解的工具接入格式

不应做的事：

- 自己管理 server 持久化
- 自己重复实现 transport
- 自己维护一套独立的 enable/disable 状态

也就是说：

- registry 与 transport manager 是平台能力
- runtime adapter 只是消费层

结合当前非 legacy 主链路，这里还要补一条更精确的说明：

- 对 native 而言，首个 adapter 更准确地说不是“替换 runtime”，而是“把 MCP catalog 适配进 `NcpToolRegistry`”

也就是说，native 的第一阶段接法应该接近：

```text
McpRegistry / Lifecycle / Catalog
  -> McpNcpToolAdapter
  -> NextclawNcpToolRegistry (or composite registry)
  -> DefaultNcpAgentRuntime
```

而不是：

```text
McpRegistry
  -> directly alters agent backend / session registry / router
```

这条边界非常重要，因为它决定了 MCP 复杂度是否会污染 session/runtime 主链路。

## 代码组织与解耦边界

如果这件事要保持长期可维护，最重要的不是先写哪段代码，而是先锁死依赖方向。

推荐原则：

- MCP 只能有一个平台级实现，不允许每个 runtime 各写一套。
- 现有 `NCP runtime`、`UI`、`CLI` 都只能通过薄组合层接入 MCP，不能直接承载 MCP 的核心复杂度。
- `schema`、`registry`、`lifecycle`、`adapter` 必须分层，禁止写成一个“既懂配置又懂进程又懂 runtime”的大模块。

### 1. 推荐包边界

推荐新增一个独立平台包，例如：

```text
packages/nextclaw-mcp
```

它应作为 MCP 领域能力的唯一拥有者。

但结合当前重构后的代码结构，方案需要再补一个更准确的建议：

- 平台级 MCP domain 仍然应该独立
- 但 native 主链路的第一个消费 adapter 不应直接塞进 `packages/nextclaw`
- 更合理的放置方式，是单独做一个 NCP-facing adapter 层，避免 CLI 组合层反向拥有 tool assembly 逻辑

推荐结构调整为：

```text
packages/nextclaw-mcp
  -> 平台级 MCP domain

packages/ncp-packages/nextclaw-ncp-mcp
  -> NCP-facing adapter
  -> 把 MCP catalog 转成 NcpTool / NcpToolRegistry 可消费形式
```

如果后续确认这个 adapter 只服务 NCP-native，这样的分层会比把适配器塞进 CLI command 目录更清晰。

不建议把 MCP 核心逻辑放进这些位置：

- `packages/nextclaw-core`
- `packages/nextclaw`
- `packages/nextclaw-server`
- `packages/extensions/*`

原因分别是：

- `nextclaw-core` 应只承载配置 schema、基础类型与纯函数，不应掺入进程/网络生命周期。
- `nextclaw` 是 CLI 应用层，不应拥有 MCP 业务核心。
- `nextclaw-server` 是服务承载层，不应反向拥有平台级工具治理逻辑。
- `packages/extensions/*` 更适合具体 runtime/channel/plugin 扩展，不适合承载跨 runtime 的平台基础设施。

同时也不建议把 native 的 MCP tool adapter 长期放在：

- `packages/nextclaw/src/cli/commands/ncp/*`

这里当前更适合应用装配，不适合持续承载可复用的 NCP-facing adapter。

### 2. 各层职责分工

建议按下面四层收敛：

#### A. Core Schema Layer

位置：

- `packages/nextclaw-core`

职责：

- 定义 `mcp` 配置 schema
- 定义 `McpServerDefinition` 等纯类型
- 提供默认值、解析、序列化相关纯函数

禁止：

- 启动进程
- 发网络请求
- 管理连接状态
- 依赖 CLI、server、runtime

#### B. MCP Domain Layer

位置：

- `packages/nextclaw-mcp`

职责：

- registry 增删改查
- transport factory
- lifecycle manager
- doctor/diagnostics
- scope resolution
- 只读 catalog projection

这是 MCP 的主包。

#### C. App Composition Layer

位置：

- `packages/nextclaw`
- 后续如有需要，可在 `packages/nextclaw-server` 加组合入口

职责：

- 把 CLI 命令接到 `nextclaw-mcp`
- 在应用启动时按需初始化 lifecycle manager
- 组装 config path、logger、secret resolver 等外部依赖

这层只负责组合，不负责定义 MCP 领域模型。

#### D. Runtime Consumer Layer

位置：

- 当前先预留给 `native` consumer
- 未来 `codex`、其它 runtime 再各自实现薄 adapter

职责：

- 从 `nextclaw-mcp` 读取只读视图
- 将可见 server 转换为 runtime 自己需要的消费格式

禁止：

- 自己维护第二份 MCP registry
- 自己实现 transport 生命周期
- 自己保存 enable/disable 状态

结合当前代码，这层对 native 的具体落点应该写得更明确：

- native consumer 首期应实现为 `NcpTool` 适配层
- 它消费 `McpCatalogView`
- 它向 `NextclawNcpToolRegistry` 或其组合注册表注入 MCP tools
- 它不改写 `DefaultNcpAgentBackend`、`AgentLiveSessionRegistry`、`NcpSessionRoutesController`

### 3. 依赖方向必须固定

推荐依赖图：

```text
nextclaw-core
  -> no dependency on mcp runtime logic

nextclaw-mcp
  -> depends on nextclaw-core types/schema only

nextclaw-ncp-mcp
  -> depends on nextclaw-mcp
  -> depends on @nextclaw/ncp

nextclaw / nextclaw-server / future runtime consumers
  -> depend on nextclaw-mcp
```

明确禁止的反向依赖：

- `nextclaw-core -> nextclaw-mcp`
- `nextclaw-mcp -> nextclaw-server`
- `nextclaw-mcp -> specific runtime package`
- `nextclaw-mcp -> nextclaw-ncp-toolkit`（除非未来明确决定 MCP 只服务 NCP）

否则后面一定会出现循环依赖和职责混乱。

### 4. 推荐目录结构

`packages/nextclaw-mcp` 内部建议不要按技术栈杂糅，而是按领域切层：

```text
src/
  config/
    mcp-config-types.ts
    mcp-config-normalizer.ts
  registry/
    mcp-server-definition-store.ts
    mcp-registry-service.ts
    mcp-scope-resolver.ts
    mcp-catalog-view.ts
  transport/
    mcp-transport.ts
    mcp-transport-factory.ts
    stdio/
      stdio-mcp-transport.ts
    http/
      http-mcp-transport.ts
    sse/
      sse-mcp-transport.ts
  lifecycle/
    mcp-server-lifecycle-manager.ts
    mcp-server-state-store.ts
  doctor/
    mcp-doctor-service.ts
    mcp-diagnostic-types.ts
  application/
    mcp-application-service.ts
  index.ts
```

这里有几个刻意的取舍：

- `application/` 负责把多个 domain service 组合成 CLI/UI 更容易调用的服务，但不直接依附某个 app。
- `transport/stdio/http/sse` 分目录，防止一个 transport 文件越长越难拆。
- `registry/` 与 `lifecycle/` 分开，避免“读配置”和“管理运行时状态”搅在一起。

如果新增 `packages/ncp-packages/nextclaw-ncp-mcp`，建议保持极薄：

```text
src/
  mcp-ncp-tool.ts
  mcp-ncp-tool-registry-adapter.ts
  index.ts
```

这个包不应再拥有：

- MCP 配置存储
- transport 生命周期
- doctor
- config schema

它只做 NCP-facing adapter。

### 5. 最小公开接口

为了减少后续扩散，`nextclaw-mcp` 对外只推荐暴露少量稳定接口：

- `McpRegistryService`
- `McpApplicationService`
- `McpServerLifecycleManager`
- `McpDoctorService`
- `McpCatalogView`
- 纯类型定义

不建议把 transport 实现细节直接暴露给应用层。

### 6. 对现有仓库的最小接入点

如果按“尽量不污染现有模块”的原则落地，首期只需要触达少量清晰的组合点：

- `packages/nextclaw-core/src/config/schema.ts`
  - 新增顶层 `mcp` schema
- `packages/nextclaw/src/cli/index.ts`
  - 新增 `mcp` 命令组
- `packages/nextclaw/src/cli/...`
  - 新增 MCP CLI handler 文件
- `packages/ncp-packages/nextclaw-ncp-mcp/*`
  - 新增 native 首期 consumer adapter
- `packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.ts`
  - 只增加一处薄组合，把 MCP tool adapter 接入 native tool assembly
- `packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-tool-registry.ts`
  - 只在必要时提供组合入口，不承接 MCP domain 逻辑

不应首期就把 MCP 改动散落到：

- 各个 UI 页面
- 各个 runtime 包
- `nextclaw-server` 的多个 controller
- 各种已有 plugin 模块
- `DefaultNcpAgentBackend`
- `AgentLiveSessionRegistry`

### 7. 为什么不建议直接写进现有模块

看起来把 MCP 直接塞进现有 `runtime registry`、`server`、`CLI` 文件里会更快，但实际会产生三个坏结果：

1. 生命周期逻辑会横切到多个模块，后续难定位问题。
2. `stdio/http/sse` 三种 transport 很快会把已有文件推成 God Object。
3. 以后要支持第二个 consumer 时，会发现没有清晰复用边界，只能再抽一次。

所以正确策略不是“改动越少越好”，而是“改动尽量集中在新包和少量组合点”。

## 实施时的代码级拆分建议

在进入编码阶段前，建议先把实施任务按“不会彼此污染”的写集拆开。

### Slice 1: Schema 与纯类型

写集：

- `packages/nextclaw-core/src/config/schema.ts`
- `packages/nextclaw-mcp/src/config/*`

目标：

- 先把顶层 `mcp` 配置模型立住
- 不引入任何运行时代码

### Slice 2: Registry 与 Application Service

写集：

- `packages/nextclaw-mcp/src/registry/*`
- `packages/nextclaw-mcp/src/application/*`

目标：

- 打通 CRUD 与读取视图
- 先不做真实 transport 连接

### Slice 3: CLI

写集：

- `packages/nextclaw/src/cli/index.ts`
- `packages/nextclaw/src/cli/commands/mcp/*`

目标：

- 让 `nextclaw mcp add/list/remove/enable/disable` 可用
- 只依赖 application service

### Slice 4: Lifecycle 与 Doctor

写集：

- `packages/nextclaw-mcp/src/transport/*`
- `packages/nextclaw-mcp/src/lifecycle/*`
- `packages/nextclaw-mcp/src/doctor/*`

目标：

- 真正引入 `stdio/http/sse` transport 与状态管理

### Slice 5: 首个 Consumer

写集：

- `packages/ncp-packages/nextclaw-ncp-mcp/*`
- native tool assembly 的薄组合点

目标：

- 验证“平台级 MCP registry -> MCP catalog -> NcpTool adapter -> native tool registry”这条主链路是成立的

这样拆的意义是：

- 每一阶段都能形成清晰边界
- 不需要一开始就把 runtime 适配、UI、Marketplace 全部混进同一轮
- 更容易在中途发现边界问题并调整

## 配置模型建议

建议在 Core config schema 中新增顶层 `mcp`：

```json
{
  "mcp": {
    "servers": {
      "chrome-devtools": {
        "enabled": true,
        "transport": {
          "type": "stdio",
          "command": "npx",
          "args": ["chrome-devtools-mcp@latest"],
          "cwd": null,
          "env": {}
        },
        "scope": {
          "runtimes": ["native"]
        },
        "policy": {
          "trust": "explicit",
          "start": "lazy"
        },
        "meta": {
          "displayName": "Chrome DevTools",
          "description": "Debug and inspect Chrome through MCP"
        }
      }
    }
  }
}
```

关键原则：

- `mcp` 必须与 `ui.ncp.runtimes` 解耦
- `transport` 必须是明确 union，而不是松散自由对象
- `scope/policy/meta` 必须有固定位置，避免字段散落

## CLI 设计建议

首期建议直接引入 `nextclaw mcp` 命令组。

### 1. `nextclaw mcp add`

核心目标是对标：

```bash
codex mcp add chrome-devtools -- npx chrome-devtools-mcp@latest
```

建议语法：

```bash
nextclaw mcp add <name> -- <command> [args...]
```

默认语义：

- 默认创建 `stdio` server
- 默认 `enabled = true`
- 默认 `policy.start = lazy`
- 默认 `scope.runtimes = ["native"]`

扩展参数：

- `--transport <stdio|http|sse>`
- `--url <url>` 用于 `http/sse`
- `--header <key:value>` 可重复
- `--env <key=value>` 可重复
- `--cwd <dir>`
- `--runtime <kind>` 可重复
- `--disabled`
- `--eager`
- `--json`

### 2. `nextclaw mcp list`

输出：

- 名称
- transport
- enabled
- scope
- 状态
- 最近错误摘要

支持：

- `--json`
- `--enabled`
- `--runtime <kind>`

### 3. `nextclaw mcp remove`

删除注册项，但不自动删除用户本地安装的第三方程序。

如果是 `npx`、`uvx` 这类按需执行型 server，本质上没有本地安装目录可删除，因此 remove 只操作 registry。

### 4. `nextclaw mcp enable/disable`

只修改启用态，不删除定义。

### 5. `nextclaw mcp doctor`

这是首期非常关键的命令，因为 MCP 的主要复杂度在“为什么连不上/为什么启动失败”。

建议检查项：

- 配置是否合法
- `stdio` command 是否可执行
- `http/sse` URL 是否可达
- 鉴权头是否缺失
- 当前 transport 最近一次错误
- scope 是否与目标 runtime 匹配

## 安全与风险控制

MCP 与普通配置不同，它本质上引入了“外部可执行命令”和“外部可访问端点”。

因此默认安全模型必须保守。

### 1. 不自动信任任意命令

用户执行 `mcp add` 时可以直接注册任意命令，这意味着：

- 可以执行本地二进制
- 可以访问本地文件系统
- 可以访问网络

所以默认要显式标记：

- `policy.trust = explicit`

后续 UI 里也应明确显示这是高权限能力。

### 2. 不把 MCP 默认暴露给所有 runtime

默认 scope 只给 `native`，不自动给 `codex` 或未来 runtime。

### 3. 不把 secret 明文散落在多个字段

`http/sse` 的 token、header、API key 最终应尽量走已有 secrets 体系的引用方式，而不是重复在多个配置区放明文。

首期允许保留直接 header 字段，但长期应收敛到 secret ref。

### 4. `doctor` 必须优先于“神秘失败”

MCP 失败如果只表现为“工具没出现”，用户会非常困惑。

所以从第一版开始就要有结构化错误与诊断命令。

## 跨平台要求

该能力天然涉及跨平台差异，必须从设计开始就覆盖 macOS、Linux、Windows。

重点差异点：

- `stdio` 命令解析与 quoting
- `cwd` 路径语义
- shell 启动方式
- `.cmd`、`.exe`、`npx.cmd` 等 Windows 可执行入口
- 环境变量继承方式
- 进程退出与信号行为

因此建议：

- 首期默认以“不经 shell 的 argv 执行”作为主路径
- 仅在必要时暴露 `shell=true`
- 明确保留 Windows 特殊参数位，而不是把 POSIX 假设硬编码到底层

## 推荐实施顺序

### Phase 1: 平台级底座

交付内容：

- Core config schema 新增 `mcp`
- `McpServerDefinition` 与三类 transport union
- `McpRegistry` 读写接口
- 新建独立包 `packages/nextclaw-mcp`
- CLI：`add/list/remove/enable/disable`
- `doctor` 最小版

这一阶段的目标是先把“配置与治理结构”立住。

### Phase 2: Lifecycle 与 Diagnostics

交付内容：

- `McpServerLifecycleManager`
- `stdio` 进程启动与状态管理
- `http/sse` 连接状态模型
- 统一健康状态
- 更完整的 `doctor`

这一阶段的目标是把“配置对象”变成“可运行平台能力”。

### Phase 3: 首个消费方接入

交付内容：

- 先接 `native` 主链路的 MCP 工具消费能力

注意：

- 本次规划明确不同时推进其它 runtime adapter
- 但接口设计必须保证未来 `codex` 可直接接上

这一阶段的重点不是功能覆盖面，而是验证解耦边界：

- `native` consumer 不拥有 registry
- consumer 只读取 `McpCatalogView`
- transport/lifecycle 复杂度仍留在 `nextclaw-mcp`
- native 首期接缝位于 `NcpToolRegistry` / `NextclawNcpToolRegistry` 一侧，而不是 backend/session/router 层

### Phase 4: UI 与 Marketplace

交付内容：

- MCP 管理 UI
- 模板化 server 安装
- 后续 marketplace 分发能力

这部分必须晚于 CLI 与 lifecycle 稳定后再做。

## 为什么不建议反过来做

### 1. 不建议先做 `codex` 私有 MCP

这样短期看似更快，但长期一定会形成：

- `codex` 一套 registry
- `native` 一套 registry
- 未来更多 runtime 再各来一套

结果是：

- 配置分裂
- 诊断分裂
- transport 分裂
- 生命周期管理分裂

这是明显错误的长期结构。

### 2. 不建议先做 UI

MCP 真正复杂的地方不是界面，而是：

- transport
- 进程管理
- 跨平台行为
- 安全边界
- 诊断

先做 UI 只会把真正的复杂度藏起来，后面返工。

## 验收标准

方案落地后，首批验收标准应至少包含：

1. 能通过 CLI 注册一个 `stdio` MCP server。
2. 能通过 CLI 注册一个 `http` MCP server。
3. 能通过 CLI 注册一个 `sse` MCP server。
4. `nextclaw mcp list` 能正确展示 transport、状态与 scope。
5. `nextclaw mcp doctor` 能在配置错误、命令不存在、URL 不可达时给出结构化错误。
6. 平台底层不把 MCP 配置绑定到某个特定 runtime。
7. 默认 scope 不会把新注册的 server 自动暴露给所有 runtime。

## 最终推荐

推荐结论非常明确：

- 现在就把 MCP 定义为平台级通用能力
- 方案层一次性覆盖 `stdio/http/sse`
- 首期先落 `registry + CLI + lifecycle + diagnostics`
- 首个真实消费方只接 `native`
- 暂不并行推进其它 runtime adapter

这是当前最符合长期结构、又不会把首期范围炸开的路径。
