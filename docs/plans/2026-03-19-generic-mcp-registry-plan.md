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

- 先接 `native` runtime 的 MCP 消费能力

注意：

- 本次规划明确不同时推进其它 runtime adapter
- 但接口设计必须保证未来 `codex` 可直接接上

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
