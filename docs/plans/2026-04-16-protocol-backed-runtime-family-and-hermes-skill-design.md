# Unified Agent Runtime Registry, NARP, And Hermes Skill Design

**Goal:** 为 NextClaw 定义一套更准确的统一 agent runtime 方案：系统先拥有统一的 `agent runtime registry / runtime entry` 模型，然后在这套大模型里承载多种 runtime type，例如 `native`、`codex`、`claude-code`、`narp-http`、`narp-stdio`。其中 `narp-http` 与 `narp-stdio` 组成同一个明确命名的 runtime protocol family：`NARP`，两者共享同一套 route/credential contract，只在 transport 不同；`Hermes` 是首个 `narp-stdio` runtime entry，`Hermes skill` 负责帮助新用户安装、接入、诊断、验证与修复。

**One-line conclusion:** 我们不是在设计“plugin 驱动的 Hermes 方案”，也不是只在设计“ACP runtime”。更准确的架构是：NextClaw 先有一个统一的 agent runtime 注册层，所有 runtime 都在同一个产品层被配置、注册、展示、选择；`plugin` 只是 runtime 的一个提供来源。`NARP` 是我们对外的协议家族名，`narp-http` 和 `narp-stdio` 是它的两个 concrete runtime type；`acp` 只作为 `narp-stdio` 第一版的底层 wire dialect，而不再是对外协议名。

**Vision alignment:** 这份方案服务于 NextClaw 的“统一入口、能力编排、统一体验、开箱即用”目标。用户最终感知到的是“我在 NextClaw 里多了一个正式会话类型”，而不是“我去接了一套插件私有配置”。

**Tech Stack:** TypeScript、runtime registry、session type registry、HTTP/SSE、stdio、JSON-RPC、ACP、child process lifecycle、marketplace skill。

---

## 1. 这份文档回答什么

这份文档要一次性回答六件事：

1. NextClaw 的 runtime 总体模型到底是什么。
2. 为什么 runtime 不能被设计成必须依附 plugin。
3. `narp-http` 与 `narp-stdio` 在整个系统里处于什么层级。
4. 配置应该写在哪里，怎样才算“接入完成”。
5. `runtime`、`connector`、`skill` 三层分别负责什么。
6. 最终验收目标、验收链路、验证方案是什么。

这是一份正式规格稿，不是 Hermes 的临时补丁说明。

## 2. 关键纠偏

这轮讨论里，已经有两个必须写死的纠偏：

### 2.1 Runtime 不能以 plugin 为中心建模

`plugin` 可以提供 runtime，但 runtime 本身不能被定义成“必须通过 plugin 才存在”。

更准确地说：

- runtime 是产品一等公民
- plugin 是 runtime provider/source 之一
- builtin 也可以提供 runtime
- skill 也可以写入 runtime entry
- 用户也可以手工配置 runtime entry

所以“plugin config”不应成为 runtime 方案的主语。

### 2.2 `narp-http` 与 `narp-stdio` 只是 runtime type，不是整个系统

`narp-http` 与 `narp-stdio` 不是和 `codex`、`claude-code` 平行的“另一整套产品”，而是统一 runtime 系统中的两种 type。

整个系统应该先承认：

- 有很多 agent runtime
- 它们都在同一个 runtime registry 中出现
- 它们各自可以有不同 type 和不同字段

例如：

- `native`
- `codex`
- `claude-code`
- `narp-http`
- `narp-stdio`

其中只有 `narp-http` 与 `narp-stdio` 组成一个子家族：

- `NARP`

## 3. 最终设计结论

### 3.1 顶层结构

最终应同时交付五个东西：

1. 一个统一的 `agent runtime registry`
2. 一个统一的 `runtime entry` 配置模型
3. 一个明确命名的 runtime protocol family
   - `NARP`
   - `type: "narp-http"`
   - `type: "narp-stdio"`
4. 一个首个 runtime entry：
   - `Hermes`
5. 一个面向新用户的交付层：
   - `Hermes skill`

### 3.2 正确的架构主语

这套架构的主语顺序应该是：

1. NextClaw 先有统一 runtime registry
2. registry 里有多个 runtime entry
3. 每个 runtime entry 有自己的 `type`
4. 不同 `type` 有不同 config 分支
5. `narp-http` 与 `narp-stdio` 共享一套 `RuntimeRoute`
6. `plugin` / `builtin` / `skill` / `manual config` 只是 entry 的来源

而不是：

1. 先有 plugin
2. 再从 plugin config 里长出 runtime

## 4. 设计原则

### 4.1 统一 registry 优先

所有 runtime 都应在同一个产品级 registry 中被：

- 配置
- 注册
- 描述
- probe
- 展示
- 选择

用户不应该因为 runtime 的来源不同，就面对不同的入口和不同的配置心智。

### 4.2 来源维度与类型维度严格分离

这是本方案最重要的结构原则。

#### 来源维度

runtime 可以来自：

- builtin
- plugin
- skill setup
- manual config

#### 类型维度

runtime 的类型可以是：

- `native`
- `codex`
- `claude-code`
- `narp-http`
- `narp-stdio`

这两个维度不能混在一起。

例如：

- `codex` 现在可以由 plugin 提供
- 但它首先是一个 runtime type / runtime entry
- 不是“plugin 本体”

### 4.3 `NARP` 拥有完整命名，`acp` 不再充当对外协议名

这里明确三层命名：

- 协议家族名：`NARP`
- concrete runtime type：`narp-http`、`narp-stdio`
- 底层 wire dialect：`acp`

也就是说：

- 我们对外说的是 `NARP`
- 我们配置和注册的是 `narp-http` / `narp-stdio`
- `acp` 只表示 `narp-stdio` 第一版底层承载方式

### 4.4 `narp-http` 与 `narp-stdio` 共享同一套 `RuntimeRoute`

在整个统一 runtime 系统中，`narp-http` 与 `narp-stdio` 作为同一个 family，必须共享完全一致的产品级 route contract：

```ts
type RuntimeRoute = {
  model: string;
  apiBase: string | null;
  apiKey: string | null;
  headers: Record<string, string>;
};
```

明确要求：

- 不要求下游知道 `providerName`
- 不再使用 `preferredModel`
- 模型字段统一叫 `model`
- `headers` 必须支持

### 4.5 配置实例就是 session type

只要某个 runtime entry 被成功注册，它就应在前端成为一个正式 session type。

也就是说：

- runtime entry 存在
- 对应 runtime provider 可用
- readiness 可探测

用户就应该能看到这个会话类型。

### 4.6 Skill 负责 onboarding，不负责充当 runtime

`Hermes skill` 只负责：

- 安装
- 接入
- 诊断
- 验证
- 修复

它不负责：

- 实现 runtime 本体
- 长期承担协议层
- 伪装成功

## 5. 推荐分层

### 5.1 Product Runtime Layer

这是 NextClaw 必须拥有的核心资产。

负责：

- runtime registry
- session type 暴露
- 模型选择
- 会话创建/恢复/删除
- runtime readiness / CTA / repair
- 统一错误文案

### 5.2 Runtime Entry Layer

这是统一配置与注册层。

一个 `runtime entry` 代表一个正式可选 runtime。

它至少包含：

- `id`
- `label`
- `type`
- `config`

必要时还可以包含诊断元数据，例如：

- `source`
- `capabilities`
- `setupState`

### 5.3 Runtime Type Layer

这一层决定某个 runtime entry 的配置分支与执行方式。

第一版至少包括：

- `native`
- `codex`
- `claude-code`
- `narp-http`
- `narp-stdio`

### 5.4 Connector Layer

connector 是“某个具体目标如何挂到某个 runtime type 上”的预置与约定。

首个 connector：

- `Hermes Connector`

它不是新的 runtime type，而是：

- 一个 `type: "narp-stdio"` 的预置 entry 形态
- 第一版底层 wire dialect 为 `acp`

### 5.5 Provider Source Layer

这一层只解决“谁提供这个 runtime type / runtime factory”。

可能来源：

- builtin runtime provider
- plugin runtime provider
- future remote/bundled provider

这一层不能反客为主，变成配置主语。

### 5.6 Skill Layer

面向普通用户交付安装与接入体验。

首个 skill：

- `Hermes Skill`

## 6. 统一 Runtime Entry 模型

### 6.1 顶层 entry 结构

统一结构建议为：

```ts
type AgentRuntimeEntry = {
  id: string;
  label: string;
  type: "native" | "codex" | "claude-code" | "narp-http" | "narp-stdio";
  config: Record<string, unknown>;
};
```

更具体地说，它应该是一个 discriminated union：

```ts
type AgentRuntimeEntry =
  | { id: string; label: string; type: "native"; config?: {} }
  | { id: string; label: string; type: "codex"; config: CodexRuntimeConfig }
  | { id: string; label: string; type: "claude-code"; config: ClaudeCodeRuntimeConfig }
  | { id: string; label: string; type: "narp-http"; config: NarpHttpRuntimeConfig }
  | { id: string; label: string; type: "narp-stdio"; config: NarpStdioRuntimeConfig };
```

这才是和现有 `codex / claude` 一致的整体心智。

### 6.2 统一产品级会话输入

前端创建会话时，统一输入至少包含：

```ts
type RuntimeSessionCreateInput = {
  sessionType: string;
  model: string;
  workspace?: string;
};
```

然后由 NextClaw 把选中的模型统一解析成：

```ts
type RuntimeRoute = {
  model: string;
  apiBase: string | null;
  apiKey: string | null;
  headers: Record<string, string>;
};
```

### 6.3 统一流式事件目标

无论 runtime type 是什么，最终都应收敛到统一 NCP 事件体验：

- reasoning start / delta / end
- text start / delta / end
- tool-call start
- tool-call args
- tool-call end
- tool-call result
- message completed
- message failed
- run finished
- run error

如果某个 runtime 做不到完整结构化事件：

- 允许显式降级
- 不允许伪装成完整能力

## 7. NARP

### 7.1 在全局里的位置

`NARP` 不是整个系统，而是统一 runtime 系统中的一个 family。

它包含两个 type：

- `narp-http`
- `narp-stdio`

### 7.2 这两个 type 共享什么

必须共享：

- 相同的会话语义
- 相同的 `RuntimeRoute`
- 相同的模型桥接语义
- 相同的 readiness / probe / smoke contract
- 相同的事件目标形态

### 7.3 它们只在哪些地方不同

只允许在 transport 相关字段不同：

- `narp-http`
  - `baseUrl`
  - `basePath`
  - `healthcheckUrl`
  - payload / SSE
- `narp-stdio`
  - `command`
  - `args`
  - `env`
  - `cwd`
  - `wireDialect`
  - child process lifecycle

## 8. STDIO Runtime 设计

### 8.1 接入边界

`type: "narp-stdio"` 的接入对象是：

- 通过 `stdio` 讲受支持协议的命令行 Agent

第一版只支持：

- `wireDialect: "acp"`

它不是：

- 任意普通 CLI
- 任意 stdout 文本脚本

### 8.2 运行模型

第一版明确采用：

- 每个 NextClaw 会话一个 stdio 子进程

原因：

- `RuntimeRoute` 是会话级上下文
- `model / apiBase / apiKey / headers` 都可能随会话变化
- 第一版先把 contract 做对

### 8.3 `RuntimeRoute` bridge

第一版 `type: "narp-stdio"` 的 bridge 明确采用：

- 会话级环境变量注入
- 可选启动参数注入

### 8.4 `acp` 到 NCP 的事件映射

这里再次强调：

- `NARP` 是对外协议家族
- `narp-stdio` 是 runtime type
- `acp` 只是第一版底层 wire dialect

第一版只做实现产品目标最小必要的映射：

- thought -> reasoning
- message -> text
- tool start -> tool-call-start
- tool args -> tool-call-args
- tool completed -> tool-call-end/result
- turn completed -> message.completed / run.finished
- turn failed -> message.failed / run.error

## 9. 统一配置模型

### 9.1 配置主语

runtime 的配置主语不应再是：

- `plugins.entries.*.config`

而应是：

- 系统统一 runtime registry 配置区

plugin 若存在，只负责：

- 提供 runtime factory
- 提供 schema / probe / descriptor
- 注册 type 或 provider

但 entry 本身应落在统一 runtime 配置区。

### 9.2 推荐配置形态

推荐采用一个共享配置区，例如：

```json
{
  "agents": {
    "runtimes": {
      "entries": {
        "native": {
          "label": "Native",
          "type": "native",
          "config": {}
        },
        "codex": {
          "label": "Codex",
          "type": "codex",
          "config": {}
        },
        "claude": {
          "label": "Claude",
          "type": "claude-code",
          "config": {}
        },
        "hermes": {
          "label": "Hermes",
          "type": "narp-stdio",
          "config": {
            "wireDialect": "acp",
            "processScope": "per-session",
            "command": "hermes",
            "args": ["acp"],
            "env": {},
            "cwd": "",
            "startupTimeoutMs": 8000,
            "probeTimeoutMs": 3000,
            "requestTimeoutMs": 120000
          }
        },
        "my-http-agent": {
          "label": "My HTTP Agent",
          "type": "narp-http",
          "config": {
            "baseUrl": "http://127.0.0.1:8787",
            "basePath": "/ncp/agent",
            "healthcheckUrl": "http://127.0.0.1:8787/health"
          }
        }
      }
    }
  }
}
```

这份示例最重要的含义是：

- `codex / claude / narp-http / narp-stdio` 全都在同一个地方
- 只是各自 `type` 和 `config` 分支不同
- `narp-http` 与 `narp-stdio` 共用同一份由 NextClaw 所有的 route ownership；字段桥接细节应由运行时内建处理，而不是要求用户手填映射

### 9.3 统一注册链路

固定链路如下：

1. NextClaw 读取统一 runtime registry 配置。
2. runtime provider layer 判断自己能否承载对应 `type`。
3. 每个有效 runtime entry 被注册成一个正式 session type。
4. 前端显示这些 session type。
5. 用户选择某个 session type。
6. 用户选择模型。
7. NextClaw 解析出 `RuntimeRoute`。
8. 目标 runtime 消费这份 `RuntimeRoute`。
9. 外部 runtime 返回流式事件。
10. NextClaw 映射成统一 NCP 事件。

只要这 10 步都成立，就算接入成功。

## 10. Hermes Runtime Entry

### 10.1 Hermes 的准确定位

Hermes 不是新的 runtime family，也不是 plugin 本体。

Hermes 更准确的定位是：

- 一个 runtime entry
- `type: "narp-stdio"`
- 第一版 `wireDialect: "acp"`
- 默认 label 为 `Hermes`

### 10.2 为什么优先走 `narp-stdio(acp)`

因为：

- 这是 Hermes 现成、正式、结构化的接入面
- 它更接近 Hermes 的原始 agent 事件
- 更有机会无损恢复 reasoning 和 tool invocation
- 不要求先改 Hermes 主源码

### 10.3 是否必须改 Hermes 源码

第一版基线明确是：

- 不以修改 Hermes 主源码为前提

只要 Hermes 现有接入面能消费我们桥接进去的 `RuntimeRoute`，就优先按非侵入方式完成。

## 11. Hermes Skill

### 11.1 一句话定位

`Hermes skill` 的定位是：

**帮助一个完全不懂 Hermes 的新用户，把 Hermes 安装、接入、验证并修复成一个正式可用的 NextClaw runtime entry。**

### 11.2 `setup` 必须做什么

1. 解释 Hermes 是什么，以及最终结果是什么。
2. 检查本机是否已安装 Hermes。
3. 若未安装，引导并执行安装。
4. 探测 `hermes acp` 是否可启动。
5. 确保对应 runtime provider 可用。
6. 在统一 runtime registry 中写入 `hermes` entry。
7. 运行 readiness check。
8. 运行最小 smoke。
9. 成功后告诉用户现在可以直接创建 `Hermes` 会话。

### 11.3 `doctor / repair / smoke`

至少要覆盖：

- 可执行文件检查
- ACP 握手检查
- `RuntimeRoute` 真实桥接检查
- 文本回复检查
- reasoning 透传检查
- tool invocation 开始/结束检查
- entry 重写与重新探测

## 12. 面向用户的最终体验

### 12.1 普通用户路径

一个完全没装过 Hermes 的用户，理想路径是：

1. 安装 `Hermes skill`
2. 点击 `Setup Hermes`
3. skill 完成安装、接入、验证
4. 聊天页出现 `Hermes` 会话类型
5. 用户像使用 `Codex / Claude / Native` 一样使用 `Hermes`

### 12.2 高级用户路径

高级用户可以直接在统一 runtime registry 中新增 entry。

他们不需要经过 skill，也不必经过 plugin UI。

但无论来源如何，最终都落到同一份 runtime entry 模型。

## 13. 最终验收目标

### 13.1 产品验收

必须做到：

1. 新用户无需预先理解 Hermes、NARP、stdio、JSON-RPC。
2. 新用户只通过 `Hermes skill` 就能完成安装、接入、验证。
3. 接入成功后，`Hermes` 成为正式 session type。
4. 使用方式与 `Codex / Claude / Native` 一致。
5. 用户能看到真实 reasoning 与 tool invocation 记录。

### 13.2 技术验收

必须同时满足：

1. 系统先有统一 runtime registry，再承载不同 runtime type。
2. runtime 不再被设计成必须耦合 plugin config。
3. `narp-http` 与 `narp-stdio` 在统一 runtime 系统中共享一套 `RuntimeRoute`。
4. `RuntimeRoute` 统一为 `model / apiBase / apiKey / headers`。
5. `narp-stdio(wireDialect=acp)` 能真实创建会话并返回结构化事件。
6. tool invocation 有开始、有参数、有结束，不会永久 running。
7. 不以修改 Hermes 主源码作为第一版前提。

### 13.3 功能验收场景

至少固定下面这组真实场景：

1. 启动本地开发态 NextClaw。
2. `Hermes skill` 完成 setup。
3. 聊天页出现 `Hermes` 会话类型。
4. 新建 `Hermes` 会话。
5. 选择 `minimax/MiniMax-M2.7`。
6. 发送普通消息并收到回复。
7. 发送明确要求调用工具的消息。
8. 前端出现 tool invocation 记录。
9. tool invocation 正常结束。
10. reasoning 如下游提供，则被正确透传。

## 14. 一次性实现时要交付什么

如果按这份设计进入实现，交付物应清单化为：

1. 统一 runtime registry 与 runtime entry 规格。
2. `native / codex / claude-code / narp-http / narp-stdio` 的统一建模。
3. `NARP` 的 `narp-http` 与 `narp-stdio` 实现。
4. `Hermes` 作为首个 `narp-stdio(acp)` runtime entry。
5. `Hermes skill` 的 setup / doctor / repair / smoke。
6. 真实本地开发态功能验证。
7. 回归测试：
   - registry/config
   - `RuntimeRoute` bridge
   - 事件映射
   - 真实 smoke

## 15. Success Criteria

满足以下条件，才算方案真正成立：

1. NextClaw 内部存在统一的 agent runtime registry。
2. 所有 runtime 在同一个产品层被配置、注册、展示和选择。
3. `plugin` 被降回 runtime provider/source，而不是配置主语。
4. `codex / claude-code / narp-http / narp-stdio / native` 可以在同一份 runtime entry 模型中表达。
5. `NARP` 作为明确协议名稳定存在，不再继续借用 `ACP`。
6. `narp-http` 与 `narp-stdio` 作为同一个协议家族，共用同一套 `RuntimeRoute`。
7. `Hermes` 是首个 `type: "narp-stdio"` runtime entry，而不是特判怪物。
8. 新用户通过 skill 可以直接获得统一体验。
