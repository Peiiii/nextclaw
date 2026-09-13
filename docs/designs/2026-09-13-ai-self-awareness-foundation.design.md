# NextClaw AI 自感知专项设计

日期：2026-09-13
角色：设计
状态：已冻结；阶段 A-B 已实施并验证，阶段 C-E 待后续专项

## 1. 专项背景

Windows 便携版与普通桌面版同时存在时，用户询问当前 AI“数据存在哪里”，AI 可能回答通用默认目录 `~/.nextclaw`，而当前便携实例实际应使用便携目录下的 `data`：

- 便携产品数据根目录：`<portableRoot>/data`
- 运行时目录：`<portableRoot>/data/runtime-home`
- Desktop 数据目录：`<portableRoot>/data/desktop`
- Desktop 日志目录：`<portableRoot>/data/logs`
- Runtime 日志目录：`<portableRoot>/data/runtime-home/logs`

现有经典原生 Agent 链路已经通过 Desktop installation profile、managed command surface 和 `NEXTCLAW_HOME` 将命令绑定到当前便携实例。共存的普通桌面版不会自然导致原生 Agent 的 `nextclaw` 命令命中错误实例。

真正缺口是：AI 的自管理知识包含 `.nextclaw` 等默认规则，却没有一份明确、机器可读、可直接回答“当前实例”问题的运行态快照；现有 `nextclaw status --json` 虽能返回 `configPath`、`workspacePath` 等局部信息，也没有明确表达安装形态、便携数据根目录和运行时目录。AI 因而可能用默认知识替代现场查询。

路径误答只是一个症状。按产品愿景，NextClaw 的自感知还包括：知道自己是谁、当前系统状态、为谁工作、所处场景、做过什么、结果如何，以及哪里做错了。当前这些事实已经部分存在于 system context、session、project、tool catalog、memory、status、日志和执行事件中，但缺少统一的语义分层、查询纪律和端到端验收。局部字段存在，不等于 AI 能稳定、诚实地形成正确认识。

因此本专项以“便携版数据位置”作为首个阻断级回归，同时建立完整的 AI 自感知底座。设计只覆盖经典原生 Agent，不覆盖外部 Agent runtime。

## 2. 设计目标

1. 当前便携实例能准确说明自身安装形态和真实数据位置。
2. 普通桌面版与便携版共存时，回答只反映当前实例，不受另一安装影响。
3. AI 严格区分“默认值”和“当前已解析值”，无法查询时不制造确定结论。
4. 建立可复用的自感知机制，覆盖版本、端点、配置、工作区等同类动态事实。
5. 保持单一事实 owner，不引入第二套状态注册中心或重复 CLI。
6. 让 AI 能准确表达身份、场景、能力边界、当前状态、行动结果和不确定性。
7. 把“事实是否存在”升级为“事实能否被正确取得、解释、更新和验收”的完整合同。

## 3. 非目标

- 不改变便携目录布局和迁移规则。
- 不新增 `where-am-i`、`paths` 等与 `status` 重复的 CLI 命令。
- 不把全部运行状态注入每轮 system prompt。
- 不让 AI 根据路径字符串猜测安装形态。
- 不在 `status` 中堆入所有对象级业务状态；模型、Provider、Agent、Channel 等仍由各自的 `show`、`list` 或 `status` 命令负责。
- 不用人格化叙事替代真实系统能力，也不宣称 AI 拥有超出可验证数据的内在状态。
- 不在一期重做记忆、任务系统、可观察性和所有领域 CLI；专项以分阶段合同逐步接入现有 owner。

## 4. 当前能力盘点

经典原生 Agent 已有的自感知信号如下：

| 维度 | 当前信号 | 主要缺口 |
| --- | --- | --- |
| 身份 | 静态提示说明自己运行在 NextClaw 中；Agent profile 参与 run context | 没有稳定呈现当前 Agent 身份、版本边界和身份来源 |
| 运行环境 | system context 提供 OS、架构和 Node 版本 | 没有发行形态、安装形态和真实存储布局 |
| 当前会话 | `CurrentSessionContextProvider` 提供 channel、chat、session、model | 与 Agent、项目、宿主环境、触发来源之间缺少统一语义 |
| 项目场景 | `ProjectContextProvider` 提供工作区、项目根和仓库身份 | AI 不总能区分宿主工作区、会话绑定项目和当前目录 |
| 工具边界 | 每轮 tool schema 是策略过滤后的工具全集，Tooling context 提供部分 readiness | “存在、已配置、获授权、健康、适合当前任务”仍容易混为一谈 |
| 当前系统状态 | `nextclaw status --json`、领域 `show/list/status` | 状态分散，AI 缺少强制查询和默认值隔离纪律 |
| 用户与长期上下文 | bootstrap、workspace memory、preference 等 owner 已存在 | 来源、时效、用户纠正和置信边界未形成统一验收 |
| 行动与结果 | 当前对话、工具结果、session event、verification/log 等已有数据 | 缺少面向 AI 的“已做/未做/成功/失败/已验证”稳定摘要合同 |
| 错误归因 | doctor、结构化日志和部分诊断指南 | 容易把症状、推断和已证实根因混在一起 |

结论：当前不是完全没有自感知，而是“信号丰富、投影分散、查询纪律不完整、验收按功能各自为政”。专项应复用已有 provider 和领域 owner，补齐语义协议，而不是另建一套平行状态系统。

## 5. 自感知语义模型

### 5.1 五层自感知

| 层级 | AI 需要知道什么 | 更新方式 | 典型来源 |
| --- | --- | --- | --- |
| L0 身份与边界 | 我是谁、服从什么规则、不能做什么 | 启动或配置变化 | Agent profile、安全策略、版本 owner |
| L1 当前场景 | 当前会话、项目、渠道、宿主环境、模型、触发来源 | 每次 run | run context、session、project context |
| L2 当前系统 | 安装形态、目录、服务、配置、连接、能力状态 | 按需查询 | `status`、领域 `show/list/status` |
| L3 行动与结果 | 刚做了什么、是否完成、验证到了什么 | 每次动作后 | tool result、session event、verification record |
| L4 诊断与纠正 | 哪里出错、证据是什么、如何恢复、用户如何纠正 | 失败或反馈时 | doctor、logs、feedback、memory/preference owner |

L0/L1 中短小、稳定且每轮必需的事实可以进入上下文；L2-L4 默认按需读取。是否进入 prompt 由使用频率、时效性、敏感度和 token 成本共同决定，不能因为“属于自感知”就全部常驻。

### 5.2 自感知回答合同

AI 对自身事实的陈述必须满足：

1. **有来源**：能映射到一个明确 owner 或当前工具结果。
2. **有时效**：动态事实来自本轮或仍有效的快照；过期数据不冒充当前值。
3. **有范围**：区分当前 Agent、当前会话、当前进程、当前设备和整个 NextClaw 产品。
4. **有置信边界**：未知、不可达、未授权与失败分别表达，不归并成“没有”。
5. **可纠正**：用户纠正身份、偏好或场景后写回相应 owner，而不是只在一句回复里口头接受。
6. **可验证**：涉及动作和结果时区分“已执行”“返回成功”“效果已验证”三个层次。

## 6. 设计原则

### 6.1 默认知识不等于当前状态

信息按语义分为四类：

| 类型 | 权威入口 | 示例 |
| --- | --- | --- |
| 静态规则与默认值 | 文档、Skill | 未配置时默认使用 `.nextclaw` |
| 当前已解析状态 | `status`、领域 `show/list` | 当前 `runtimeHome`、当前端点、当前模型 |
| 历史事实 | 日志、事件记录 | 上次启动失败原因 |
| 期望状态 | 配置和变更命令 | 将工作区改到指定目录 |

回答“现在、当前、你正在使用”的问题时，必须查询当前状态入口；文档只能说明规则或默认值。

### 6.2 一个事实只有一个 owner

- Desktop installation profile 继续拥有 `portable` / `installed` 的判定和 Desktop 路径计算。
- Kernel 公共 contract 拥有当前进程使用的运行时目录、配置路径和工作区等产品语义，并通过单一 resolver 生成不可变的运行实例快照。
- Service/CLI 调用同一个公共 resolver，并把结果投影到 `nextclaw status --json`；即使服务未运行，也不自行重新推导安装形态或目录。
- AI self-management Skill 只规定何时查询及如何解释，不生成状态。

### 6.3 显式状态优于推断

便携形态必须由 Desktop profile 显式传入当前运行实例。缺少可信来源时返回 `null` 或 `unknown`，禁止根据 `.nextclaw`、`data`、父目录名等路径特征反推。

### 6.4 不建设万能自感知仓库

“统一自感知”统一的是语义、路由和验收，不是把所有事实复制进一个大对象。每类事实仍由领域 owner 保存；context provider、CLI 和工具只做适合模型消费的投影。这样避免快照过期、权限绕过、重复持久化和跨领域耦合。

### 6.5 一个事实只投影一次

单一 owner 还不够，同一事实在最终 model input 中也只能出现一次。不得在已有 `Assistant Identity`、`Runtime`、`Current Session`、`Project Context` 之外再叠加一份内容重合的自画像。整合时建立字段级投影归属：身份、宿主和当前会话进入唯一自画像区块；项目路径和仓库身份保留在 `Project Context`；工具与 readiness 保留在 `Tooling`。共享同一个 run-context snapshot 不等于允许多个 provider 重复渲染同一字段。

## 7. 一期方案：运行实例自描述

### 7.1 Kernel 增加运行实例快照

新增稳定公共 contract，暂名 `RuntimeInstanceSnapshot`。名称实现时可按现有公共类型体系调整，但不得使用历史 `NCP` 前缀。

建议语义结构：

```ts
type RuntimeInstanceSnapshot = {
  distribution: "desktop" | "cli" | "unknown";
  installationKind: "portable" | "installed" | null;
  storage: {
    portableDataRoot: string | null;
    runtimeHome: string;
    desktopDataDirectory: string | null;
    desktopLogsDirectory: string | null;
    runtimeLogsDirectory: string;
    configPath: string;
    workspacePath: string;
  };
};
```

字段定义：

- `portableDataRoot`：便携版 `<portableRoot>/data`，非便携实例为 `null`。
- `runtimeHome`：当前进程真正使用的 `NEXTCLAW_HOME`，不是默认值说明。
- `desktopDataDirectory`：Desktop 宿主数据目录；纯 CLI 场景为 `null`。
- `desktopLogsDirectory`：Desktop launcher/main 日志目录；纯 CLI 为 `null`。
- `runtimeLogsDirectory`：Kernel/Service 结构化日志目录，由 runtime logging path owner 提供。
- `configPath`、`workspacePath`：保留现有语义，改由同一快照提供。

Desktop 把 installation profile 已确认的紧凑、不可变启动上下文同时传给运行时和 managed command surface。Kernel 公共 resolver 将该上下文与公共路径 owner 合并为最终快照：长驻运行时在进程启动时解析一次；`nextclaw status` 命令进程在每次调用时使用相同 resolver 解析一次。这样服务停止时仍能回答本实例归属，同时避免环境变量、CLI 和提示词各自解释。

启动上下文只携带已确认的宿主事实，例如 distribution、installation kind 和 Desktop profile 路径；配置、workspace 等 Kernel 已拥有的事实不重复传输。缺少 Desktop 上下文的普通 CLI 仍能解析 `runtimeHome` 等通用字段，但 Desktop 专属字段返回 `null`。

### 7.2 扩展现有 `nextclaw status --json`

在现有状态结果中新增：

```json
{
  "instance": {
    "distribution": "desktop",
    "installationKind": "portable"
  },
  "storage": {
    "portableDataRoot": "D:\\NextClaw\\data",
    "runtimeHome": "D:\\NextClaw\\data\\runtime-home",
    "desktopDataDirectory": "D:\\NextClaw\\data\\desktop",
    "desktopLogsDirectory": "D:\\NextClaw\\data\\logs",
    "runtimeLogsDirectory": "D:\\NextClaw\\data\\runtime-home\\logs",
    "configPath": "D:\\NextClaw\\data\\runtime-home\\config.json",
    "workspacePath": "D:\\NextClaw\\data\\runtime-home\\workspace"
  }
}
```

兼容策略：

- 本次为增量 JSON 字段，不改变现有命令名称和退出码。
- 现有顶层 `configPath`、`workspacePath` 暂时保留为兼容投影；内部只读取同一个快照，不形成第二 owner。
- AI、文档和新消费者立即改用 `storage`。
- 是否移除旧字段须在后续主要版本中经过消费者审计，本次不删除。

不新增独立 CLI，是因为 `status` 已经承担“当前实例状态”语义；再加命令只会让 AI 和用户面对两个相互重叠的入口。

### 7.3 修订 AI 自管理查询纪律

在 `nextclaw-self-manage` Skill 中加入强约束：

1. 用户询问当前安装形态、数据目录、配置文件、工作区、日志、版本或端点时，先运行对应的结构化状态命令。
2. 当前实例基础信息优先运行 `nextclaw status --json`。
3. 只按结构化字段回答，不从 `configPath` 的父目录或文档示例反推其它字段。
4. 回答中明确区分“当前值”和“默认值”。除非用户追问，不需要附带默认值。
5. 命令失败或字段未知时，应说“当前无法验证”，随后才能以条件句说明默认规则；禁止把默认规则写成当前事实。

示例：

- 正确：`当前是便携版，便携数据根目录是 D:\NextClaw\data；运行时数据位于其中的 runtime-home。`
- 错误：`NextClaw 的数据一般在 ~/.nextclaw。`
- 状态不可用：`我现在无法读取该实例的状态；如果没有自定义且不是便携版，默认目录通常是 ~/.nextclaw。`

system prompt 只需继续告诉 AI 自管理入口和查询纪律，不注入具体绝对路径。这样可以避免提示词膨胀、路径泄露和运行中状态过期。

### 7.4 同步用户文档

实现时同步：

- `docs/USAGE.md`
- `packages/nextclaw/resources/USAGE.md`
- `nextclaw-self-manage` Skill
- 中英文 CLI 命令文档中 `status --json` 的新增字段说明

文档必须把 `.nextclaw` 标成“非便携且未覆盖时的默认值”，不能再用无条件措辞暗示它是所有安装形态的当前目录。

## 8. 自感知路由与投影

### 8.1 常驻最小自画像

在现有 context provider 体系内整理一个短小的 `Current Self` 语义块。它不是新增叠加层，而是替换并收敛现有 `Assistant Identity`、`Runtime` 与 `Current Session` 的重叠投影，只包含本轮必需且已有可靠 owner 的字段：

- 当前 Agent 的稳定 id 与展示名；
- 当前 session 与 channel；
- 当前宿主平台与架构；不引入可跨会话追踪的设备指纹或硬件唯一标识；
- 当前运行模型；
- 当前实例 distribution；
- 一句状态查询纪律：动态系统事实必须使用 `status` 或领域命令确认。

项目 binding、effective workspace、仓库身份仍只由 `Project Context` 展示；工具清单和 readiness 仍只由 `Tooling` 展示。具体存储路径、服务状态、能力清单、用户记忆和历史动作不常驻。

实现时删除被 `Current Self` 完整替代的静态 provider 注册或渲染，不保留兼容性重复文案。各 provider 继续共享现有 `ContextProviderRunContextService` snapshot，不新增另一套 run context。

### 8.2 按需状态路由

AI 根据问题语义选择 owner：

- 当前实例基础状态：`nextclaw status --json`
- 具体对象状态：对应领域的 `show/list/status --json`
- 工具是否能在本轮调用：本轮 policy-filtered tool catalog
- 工具是否已配置或健康：对应 readiness/status，而非仅看工具名
- 历史动作与失败：session event、verification、logs/doctor
- 用户偏好与长期目标：memory/preference/goal owner

不新增一个 `nextclaw self everything` 命令。若某领域无法机器读取，应补齐该领域现有 CLI 或 tool contract，而不是让自感知层直接读其私有存储。

### 8.3 行动结果意识

专项后续阶段应统一三态语言和结构化结果：

- `attempted`：动作已发起；
- `succeeded`：owner 返回成功；
- `verified`：用户可观察效果已通过独立读路径证明。

AI 在回答“已经好了吗”时必须使用最高已取得级别。tool result、verification record 和 session event 仍是各自事实源，自感知层只生成本轮摘要；上下文压缩后也必须保留未完成动作、失败、待验证项和用户纠正。

### 8.4 错误与不确定性

统一使用以下区分：

- `unknown`：没有可信事实；
- `unavailable`：权威入口当前不可访问；
- `unauthorized`：能力存在但当前未获授权；
- `not-configured`：能力存在但缺少配置；
- `unhealthy`：已配置但运行异常；
- `unsupported`：当前版本或宿主不支持。

这些状态不得被 AI 简化成同一个“没有”或“不能”。普通回答给用户简洁结论；需要排障时再显示来源和细节。

## 9. 便携版问题端到端链路

```text
nextclaw-portable.json
        │
        ▼
DesktopInstallationProfile ── 明确 portable 与便携目录
        │
        ▼
可信启动上下文 ── 同时进入运行时与 managed command surface
        │
        ▼
Kernel 公共 resolver ── 合并当前 runtimeHome/config/workspace
        │
        ▼
nextclaw status --json ── 停服时也可结构化投影
        │
        ▼
原生 Agent ExecTool ── 通过当前实例 command surface 执行
        │
        ▼
AI 回答当前值；文档只负责解释默认规则
```

## 10. 方案比较

| 方案 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- |
| 只改文档/提示词 | 成本低 | 自定义目录、便携迁移后仍会答错 | 不采用 |
| 每轮注入全部路径 | 无需工具调用 | 重复状态、增加 token、可能过期并扩大路径暴露 | 不采用 |
| 新增独立 paths 命令 | 表意直接 | 与 `status` 重复，产生入口分叉 | 不采用 |
| 统一快照 + 扩展 status + 查询纪律 | 单一 owner、可验证、可扩展 | 需要跨 Kernel/Desktop/CLI/Skill 改造 | 采用 |

## 11. 举一反三

该问题不是“路径问答”的孤例，而是所有运行态自感知的共同问题。后续按以下规则扩展：

- 实例级、高频且诊断必需的事实进入 `nextclaw status --json`：运行版本、安装形态、存储路径、服务端点、关键能力状态。
- 对象级事实保留在对应命令：当前 Agent、Provider、模型、Channel、Skill 等使用各自的 `show/list/status`。
- 历史原因只查日志或事件，不从当前状态猜测。
- 文档记录默认值、配置规则和操作说明，不作为当前值的数据源。
- 诊断需要“为什么解析成这个值”时，在 `doctor` 中提供来源和覆盖链；普通 `status` 保持稳定、紧凑，不为每个字段附加 provenance。
- 新增自感知字段前先确认 owner；不能确认时返回未知，不创建全局“万能状态仓库”。

可直接套用的判断式：

```text
用户问的是规则？       → 查文档/Skill
用户问的是当前状态？   → 查 status 或领域 show/list
用户问的是过去发生了什么？ → 查日志/事件
用户要求改变状态？     → 调用配置或变更命令，再重新查询验证
```

## 12. 专项阶段与验收合同

### 12.1 阶段拆分

| 阶段 | 交付 | 完成标志 |
| --- | --- | --- |
| A. 运行实例自描述 | Runtime instance snapshot、`status.storage`、查询纪律 | 便携版原问题闭环，普通安装和自定义目录不回归 |
| B. 身份与场景 | 用 `Current Self` 替换身份/runtime/session 重叠投影，项目语义继续由 `Project Context` 独占 | AI 能准确回答“你是谁、在哪个会话/项目/宿主环境工作”，且每个字段只展示一次 |
| C. 能力与权限 | availability/configuration/authorization/health 四维状态 | AI 不再把“有工具”误答成“当前可成功使用” |
| D. 行动与结果 | attempted/succeeded/verified 摘要和压缩保真 | AI 不再把已尝试或工具返回当作效果已验证 |
| E. 诊断与纠正 | 证据分级、错误归因、用户纠正写回 | AI 能说明已知、推断、未知并避免重复犯已纠正问题 |

每个阶段独立通过验收后再扩大范围。阶段 A 是本问题的优先实现批次；B-E 是同一专项下的后续里程碑，不应与 A 一次性混成超大改动。

### 12.2 阶段 A 验收合同

合同标识：`runtime-self-awareness-status-v1`

### RSA-001 便携版真实路径

给定便携版从 `D:\NextClaw` 启动，原生 Agent 收到“你的数据存在哪里”，则必须调用结构化状态入口，并回答：

- `portableDataRoot = D:\NextClaw\data`
- `runtimeHome = D:\NextClaw\data\runtime-home`
- 不把 `.nextclaw` 表述为当前目录

### RSA-002 共存隔离

给定同一 Windows 用户还安装普通桌面版且用户目录存在 `.nextclaw`，便携实例的 `status --json` 和 AI 回答仍只包含便携实例路径。

### RSA-003 已安装版与自定义目录

已安装桌面版或 CLI 使用自定义 `NEXTCLAW_HOME` 时，返回实际解析值；`installationKind` 不得根据路径猜测为 portable。

### RSA-004 不确定性

当状态命令失败或字段为未知时，AI 不得断言当前目录。若提供默认规则，必须使用条件式表述。

### RSA-005 向后兼容

现有 `status --json` 消费者继续通过；新增字段为增量字段，原顶层路径字段值与 `storage` 投影一致。

### RSA-006 文档一致性

两份 USAGE、自管理 Skill 和中英文 CLI 文档对默认路径、便携布局和查询入口的描述一致。

### RSA-007 停服可见性

便携版后台服务停止时，从其 managed command surface 执行 `nextclaw status --json` 仍返回正确的 `instance` 与 `storage`；服务健康字段可以为 stopped/unavailable，但实例身份不得丢失或退回普通安装默认值。

### 12.3 专项横向验收

除阶段 A 的具体合同外，每个后续阶段都必须覆盖四类测试问题：

1. 正常状态：权威数据存在时能准确回答。
2. 冲突状态：文档默认值、旧记忆或另一实例与当前 owner 冲突时，以当前 owner 为准。
3. 不可用状态：来源不可达时保留不确定性，不编造答案。
4. 变化状态：切换 Agent、项目、模型、权限或运行实例后，新 run 能反映变化，旧快照不会泄漏。
5. 去重状态：最终 model input 中每个自感知字段只有一个展示 owner，新增信息不造成旧区块与新区块重复。

必须建设一组“自然语言问题 → 预期工具调用/来源 → 允许的结论边界”的受控回归语料，至少包含：

- 你是谁、当前用的什么模型？
- 你现在在哪个项目和会话里？
- 你的数据、配置和日志在哪里？
- 你现在能不能联网、发消息或管理 NextClaw？
- 你刚才做成功了吗，验证了吗？
- 你为什么失败，哪些是证据，哪些只是推断？
- 我刚才纠正你的内容，你以后依据什么记住？

模型措辞可以变化，但来源选择、工具调用、不确定性和结论边界必须可确定性断言。

## 13. 验证设计

### 单元测试

- Desktop profile 在 portable / installed 下产生正确且显式的安装上下文。
- Kernel 快照在 portable、installed、CLI、自定义 `NEXTCLAW_HOME` 下输出正确字段。
- 缺少 Desktop 上下文时返回 `null` / `unknown`，不做路径猜测。
- `status` 新旧字段来自同一快照且保持一致。

### 集成测试

- 在原生 Agent 的 command surface 环境中执行 `nextclaw status --json`，验证命令与便携实例绑定。
- 构造普通 `.nextclaw` 与便携目录共存，验证输出不串实例。
- 移动整个便携目录后重新启动，验证所有路径跟随新位置解析。

### Agent 行为回归

使用受控模型/工具调用测试提问“你的数据存在哪里”：

- 断言 AI 先调用 `nextclaw status --json`。
- 断言回答引用 `storage.portableDataRoot` 和 `storage.runtimeHome`。
- 断言不得以文档默认值替代当前值。
- 模拟状态失败，断言回答保留不确定性。

### Prompt 投影回归

- 生成经典原生 Agent 的完整 model input，断言身份、OS/架构、session、channel、model、workspace 各只出现一次。
- 断言 `Current Self` 不重复 `Project Context` 的 project/workspace/repository 字段，也不重复 `Tooling` 的工具和 readiness。
- 对比改造前后静态上下文字符数；新增自感知能力后总量不得因重复投影增长，删除旧区块形成明确替代关系。

模型文本不适合作为唯一证据；Windows 打包冒烟还必须直接断言结构化状态字段位于便携根目录下。

### 必要工程验证

实现涉及 TypeScript、公共类型和运行链路，必须运行匹配范围 `tsc`、定向测试、Windows portable smoke，以及完成后的 diff-only maintainability review。

## 14. 风险与约束

- 路径属于本机信息，只在用户主动询问或诊断输出中读取；不默认塞入每轮 prompt 或遥测。
- Windows 路径比较必须使用平台语义规范化，不用简单字符串前缀判断目录归属。
- `status` 字段一旦公开即成为兼容合同，命名应描述语义而非当前实现目录名。
- Desktop 启动上下文和 Kernel 快照必须在启动期冻结，避免同一进程内不同消费者看到不同归属。
- 对尚无可靠 owner 的字段宁可返回 `null`，不得为了字段完整而猜测；Desktop 与 Runtime 日志必须分别命名，不能用一个含糊的 `logsDirectory` 合并两套真实目录。
- 当前自画像可能包含会话 id、路径和设备信息，只能进入当前会话的模型上下文，不进入跨用户日志、公开反馈或遥测。
- 自感知状态必须经过与实际工具相同的策略过滤；AI 不得通过自感知接口看到本轮无权使用的能力或敏感配置值。
- 用户画像与偏好属于“为谁工作”的长期上下文，但不能与运行实例状态混存；纠正写回应遵守现有 memory/preference owner 和隐私边界。
- prompt 去重按语义字段而非字面字符串判断；标题不同、措辞不同但表达同一事实仍属于重复。

## 15. 实施边界与顺序

专项跨 Desktop、Kernel、Service CLI、context provider、资源文档和 Agent Skill，实施前需要按阶段形成独立执行计划。阶段 A 推荐顺序：

1. 冻结公共快照类型和字段语义。
2. 接入 Desktop installation profile 与 Kernel 路径 owner。
3. 扩展 `status --json`，保留兼容投影。
4. 补齐单元、集成和 Windows portable smoke。
5. 更新 AI 查询纪律、USAGE 与 CLI 文档。
6. 增加自然语言行为回归并完成全链路验收。

阶段 A 完成后，基于专项回归语料中的实际失败率决定 B-E 的先后顺序；默认先做 B“身份与场景”，再做 C“能力与权限”，最后接入 D/E。禁止只凭概念完整性同时改造所有 owner。

本设计不授权提交、推送、发布或部署。

## 16. 复用的既有合同

本专项不重定义以下已有设计，只在其上补充 AI 可消费的状态投影和验收：

- `docs/designs/2026-05-21-desktop-portable-edition-design.md`：便携版 marker、目录布局与 profile owner。
- `docs/designs/2026-05-23-desktop-installed-cli-contract-design.md`：Desktop managed command surface。
- `docs/designs/2026-08-20-runtime-observability-and-ai-diagnostics.design.md`：当前状态、历史日志、Kernel 语义 owner 与 CLI 投影边界。
- `docs/designs/2026-08-21-windows-desktop-self-diagnostics.design.md`：自然语言诊断入口、紧凑状态信号与详细 doctor 分工。
