# Core / Kernel 职责分配设计

## 背景

这份文档用于梳理 `@nextclaw/core` 与 `@nextclaw/kernel` 的职责边界，避免后续重构只按目录名移动文件，而没有回答真正的 owner 问题。

当前包关系已经给出基本方向：

- `@nextclaw/core` 描述为 runtime core，覆盖 agent、channels、providers、config 等底层运行能力。
- `@nextclaw/kernel` 描述为 product kernel，覆盖 agents、tasks、sessions、context、tools、skills、providers、automation、channels 等产品运行时骨架。
- 依赖方向是 kernel 依赖 core；core 不应依赖 kernel。
- 结构协议上 core 是 `app-l2`，kernel 是 `app-l1`。因此 kernel 是产品对象图和生命周期 owner，core 是可复用 runtime primitives / contracts owner。

## 总体判断

NextClaw 的运行时应该分成三层：

1. `core`：可复用运行时合同、低层能力、数据格式、适配器、service/store 和工具原语。
2. `kernel`：产品运行时对象图、manager 生命周期、agent run 编排、事件总线、配置热加载和贡献注册。
3. `service`：CLI / daemon / HTTP gateway / host shell，负责进程、命令、API 和本机服务表面。

核心规则：

- core 可以提供稳定能力，但不能拥有产品级对象图；`Manager` 角色默认不属于 core。
- kernel 可以直接依赖 core 的稳定 owner，不需要为了“解耦”再套一层无意义 facade。
- service 可以使用 core 的路径、配置、日志、环境等低层 helper；但涉及 agent/session/provider/extension 等产品语义时，应通过 kernel owner。

## Core 应负责什么

Core 的职责是提供“不会因为产品运行方式变化而频繁变动”的底层合同与原语：

- 配置格式、schema、默认值、迁移、load/save、secret 解析和 reload plan 计算。
- LLM provider 协议、provider registry、具体底层 provider adapter 和 chat completion normalization。
- channel base、extension channel adapter、静默回复过滤、消息投递基础机制。
- session 文件存储、JSONL 投影、legacy 迁移、list index、session search worker/service 基础能力。
- agent 工具原语和低层工具类，例如 message、cron、filesystem、shell、web、memory、gateway 等 tool 实现。
- skills / memory / runtime context 等可被 kernel 组合使用的低层能力。
- 路径、日志、运行环境、brand/config constants 等 shared runtime helpers。

判断标准：

- 如果一个模块只知道文件、schema、adapter、协议或纯 runtime primitive，它可以在 core。
- 如果一个模块需要知道 NextClaw 当前产品对象图、事件总线、run/session 生命周期、extension runtime 或 live reload 编排，它不应在 core。

## Kernel 应负责什么

Kernel 的职责是把 core 的能力组成 NextClaw 产品运行时。`Manager` 是 kernel 产品对象图的主角色，除非存在明确的历史兼容或外部协议原因，不应出现在 core：

- `NextclawKernel` 作为 composition root，创建并持有长期 manager graph。
- ChannelManager 负责 channel 实例生命周期、运行态 reload、outbound dispatch 和 control message 投递。
- ConfigManager 负责把 core config 解析结果应用到 channels、providers、MCP、extension、agent runtime 等运行中 owner。
- SessionManager 负责 NCP session API、事件 journal、session metadata、context window preview、product session summary。
- AgentRunRequestManager 负责 agentRun send / abort / sessionMessageRequest，衔接 SessionRun、runtime、context provider、tool provider 和 EventBus。
- AgentRuntimeManager 负责 runtime provider registry、runtime cache、native / NARP runtime 生命周期。
- ToolProviderManager / ContextProviderManager 负责每次 run 的工具和上下文组合；core tool 只能作为原语被注册，不拥有注册策略。
- ExtensionManager / ExtensionRuntimeService 负责 extension discovery、manifest、runtime process、ingress bridge 和 contribution snapshot。
- MCP、Panel App、Service App、Access、LLM usage、learning loop 等产品级 manager 都归 kernel。

判断标准：

- 如果一个模块要回答“当前运行中的 NextClaw 应该怎么连接这些能力”，它属于 kernel。
- 如果一个模块要订阅事件、持有 cleanup/disposable、管理运行时缓存、注册 contribution 或调度 manager，它属于 kernel。

## Service 应负责什么

Service 是宿主层，不应成为第四套业务 owner：

- 负责 CLI command、HTTP controller、daemon lifecycle、runtime update、service restart、本机自启动、gateway surface。
- 可以直接读 core 的 `getConfigPath`、`loadConfig`、`getDataDir`、logging/env helper，用于离线命令、诊断、进程启动前准备。
- 对运行中系统的产品操作，应优先通过 `NextclawKernel` 或具体 kernel manager，而不是绕过 kernel 直接改 core store 或重复实现业务状态。

风险边界：

- config 文件读写型命令可以用 core，但如果写完需要影响 live runtime，必须触发或委托 kernel reload。
- marketplace / skill / channel / mcp / agent 命令若涉及产品状态，不能只停在 service + core helper。

## 关键链路分工

### Config

- core：`ConfigSchema`、config loader、config path、save/load、secret resolution、reload plan。
- kernel：`ConfigManager` 持有当前运行配置，把 reload plan 应用到 channels、providers、MCP、extension、agent runtime。
- service：命令和 UI 表面可以修改配置文件，但运行态生效必须走 kernel reload。

### Session

- core：`SessionStore` 负责文件持久化、消息/事件投影、list index 和历史读取。
- kernel：`SessionManager` 负责 NCP session 语义、event journal、metadata patch、summary upsert/delete、context window preview。
- service：只暴露命令/API，不应自行成为 session 生命周期 owner。

### Agent Run

- core：提供 agent profile 解析、tool primitive、context primitive 等基础材料。
- kernel：`AgentRunRequestManager` 负责 send/abort 请求、SessionRun、runtime、context、tools、NCP event 发布和错误收口。
- service：负责接收 CLI/API 请求，并交给 kernel。

### Tools / Context

- core：提供可复用工具实现和 skills/memory 等低层能力。
- kernel：负责 tool provider / context provider 的注册、去重、选择和每次 run 的组合。
- 判断：工具实现可以在 core，但“哪些工具进入当前 agent run”必须在 kernel。

### Channels / Extensions

- core：channel base、extension channel adapter、静默回复过滤、消息 deliver 基础机制。
- kernel：`ChannelManager` 管理 channel 实例、extension channel contribution 装载、start/stop/reload 和 outbound dispatch。
- kernel：`ExtensionManager` 和 extension runtime 负责 discovery、manifest、进程生命周期、extension ingress、channel contribution。
- 判断：channel transport mechanics 可以在 core；extension ecosystem 和产品生命周期必须在 kernel。

### LLM Providers

- core：provider interface、provider adapter、provider spec、ProviderRegistry。
- kernel：`LlmProviderManager` 负责配置驱动的 provider pool、默认 provider、model routing、connection test 和运行时选择。

## 当前需要关注的边界风险

1. `AgentManager` 目前是命名上的产品 owner，但方法尚未实现。它不满足 complete owner 原则；要么补齐真实 agent registry / persistence，要么在真正需要前降级或删除该假 owner。
2. Core 的 agent feature 暴露了大量 tool 实现。当前可接受的前提是：core 只提供工具原语，kernel 仍负责注册策略。若某些 tool 强依赖产品对象图，应迁到 kernel provider 侧。
3. `ConfigManager` 是 live reload coupling point。它应该继续作为配置生效 owner，但不能继续膨胀成通用 service locator。
4. Service 中直接导入 core 很多，低层 host/helper 场景可以接受；但凡是会影响运行中产品语义的命令，都要审计是否绕过 kernel owner。
5. Core 含有 NextClaw 产品默认值和 brand/config。短期可以接受，因为它是 NextClaw runtime core，不是通用 NCP core；长期若要复用到更通用 runtime，需要再拆 contracts 与 product defaults。
6. Core 不应再新增 `managers/` 目录、`*.manager.ts` 文件或 `*Manager` class/type。若只是低层 worker、adapter 或运行时工具，使用 service/store/controller/types 等真实角色；若是产品对象图 owner，迁入 kernel。

## 后续审计准则

审计 core / kernel 分工时，不按“文件现在在哪”判断，而按下面的问题判断：

1. 这个模块拥有的是格式/协议/适配器，还是运行中产品生命周期？
2. 它是否需要 EventBus、Ingress、MessageBus、manager graph、runtime cache、contribution register 或 cleanup？
3. 它是否决定“当前 NextClaw 产品应该启用什么”，还是只提供“某个能力如何工作”？
4. service 调用它时，是离线 host/helper 行为，还是绕过了 kernel 的 live owner？
5. 是否存在两个 owner 同时能修改同一事实，例如 config 生效、session metadata、tool 注册、runtime provider、extension channel？

结论规则：

- 格式、协议、adapter、纯工具原语和低层 service/store 归 core。
- manager、对象图、生命周期、运行时编排、产品语义归 kernel。
- 进程、命令、API、host shell 归 service。
- 任何跨层例外必须能说明为什么不是 service locator、不是假 facade、不是重复 owner。
