# 项目路线图（Roadmap）

目标：定义 3-12 个月方向，保证团队对“为什么做、先做什么、暂时不做什么”有统一认知。  
近期可执行任务请看 [TODO](./TODO.md)。

## 0. 使用规则

1. Roadmap 只写“结果与里程碑”，不写过细实现步骤。
2. 每个里程碑必须能映射到 GitHub Milestone 或 Issue 集合。
3. 每月至少复盘一次：保留、延后、下线三选一。
4. 超过 2 个周期未推进的事项必须写明阻塞原因。
5. 非目标（Not Doing）必须显式记录，避免反复讨论。

配套参考：
- [TODO 执行池](./TODO.md)
- [Issue 标签建议](./workflows/issue-labels.md)

## 1. 长期伴随方向：NextClaw 平台 SDK 化

### 1.1 定位

“平台 SDK 化”是服务产品主线的长期技术副线，不是另起一套与 NextClaw 平行的平台工程。

目标是让 NextClaw / NCP 的核心能力逐步形成稳定、可组合、可版本化的开发者能力面，使外部开发者最终能够基于同一套基础设施构建自己的 Agent 产品或平台；与此同时，NextClaw 自身持续使用这些公共边界，从真实产品迭代中校验 SDK，而不是维护一套只供演示的平行实现。

这里的“Platform SDK”是一个统一开发者能力面，不预设必须收敛为单个大包：

```text
NCP contracts / runtimes
  -> 可嵌入的 kernel 能力
  -> client / transport SDK
  -> extension / app SDK
  -> 文档、示例、测试工具与版本合同
```

现有基础：

- `@nextclaw/ncp`、NCP runtime 与 toolkit 已承担协议和运行时积木。
- `@nextclaw/kernel` 已是公开包，但当前大量导出仍需逐步区分“稳定嵌入接口”和“可变内部实现”。
- `@nextclaw/client-sdk` 已承担上层应用访问 NextClaw 的统一 client contract。
- `@nextclaw/extension-sdk` 已承担外部 extension server 接入能力。

现阶段真正缺少的不是再新建一个 SDK 名称，而是建立统一的分层、稳定性等级、开发者路径和端到端验收。

### 1.2 北极星验收

一个独立于本仓库的最小示例项目，只依赖公开发布的 NextClaw / NCP packages，不导入源码内部路径，即可完成：

1. 装配一个 headless Agent runtime。
2. 注册或接入 provider、runtime、tool / skill 等可扩展能力。
3. 创建并管理 agent、session 和一次完整 run。
4. 消费流式事件，执行取消、恢复和错误处理。
5. 持久化必要状态，并通过明确的生命周期释放资源。
6. 在升级依赖时依据语义化版本、迁移说明和 contract tests 判断兼容性。

NextClaw 产品自身对同一组稳定能力完成 dogfooding，且不保留功能等价的内部专用主链路，才算真正完成 SDK 化。

### 1.3 分阶段路线

| 阶段 | 结果 | 退出条件 | 优先级关系 |
| --- | --- | --- | --- |
| A. 能力地图与边界分级 | 盘点 NCP、kernel、client SDK、extension SDK 的公共能力、重复 contract、深层导入和内部泄漏，区分 stable / experimental / internal | 核心领域有唯一 owner；得到首批稳定嵌入能力清单和明确非目标 | 伴随相关主线改动完成，不进行全仓搬家 |
| B. 内部同路消费 | NextClaw 的 server、UI、desktop、companion 和 extensions 优先通过正式公共入口消费稳定能力 | 每个已 SDK 化领域只有一条标准主链路；平行类型、请求层和胶水实现持续减少 | 主线功能触达哪个领域，就先治理哪个领域 |
| C. Headless 嵌入闭环 | 提供面向外部 Agent 平台开发者的最小装配、生命周期、运行、事件和持久化边界，并提供与之同路的 `nextclaw exec` | 北极星示例可在独立仓库运行；脚本与 CI 可通过稳定的文本、JSON 或事件流合同执行任务；嵌入 API 不依赖 NextClaw UI、CLI 或内部 alias | 这是最关键的新增能力面，按真实外部用例逐步扩展 |
| D. 扩展与组合闭环 | provider、runtime、tool、skill、channel、app 等扩展点拥有一致的注册、能力声明、配置和诊断心智 | 至少一个非内置扩展只使用公开 SDK 完成开发、测试和运行 | 复用 NCP 与现有 extension/app 体系，不重建平行插件系统 |
| E. 开发者产品化 | 文档、starter、API reference、contract tests、版本策略、迁移指南和发布质量形成闭环 | 新开发者能够按文档完成最小平台；破坏性变化有检测、版本和迁移路径 | 在能力真实稳定后产品化，不提前冻结错误抽象 |

### 1.4 每次相关改动的伴随式检查

触达核心能力时只追加与当前改动同范围、能被真实消费的一小步：

1. **先判定 owner**：产品语义归 kernel，跨 runtime 协议归 NCP，远程访问归 client SDK，外部进程扩展归 extension SDK；不因调用方便复制 contract。
2. **再判定稳定性**：只有语义已稳定且存在复用者的能力才进入正式 public API；仍在探索的实现保持 internal 或 experimental。
3. **优先内部 dogfooding**：新增公共入口后，让当前 NextClaw 消费方走同一路径，再删除等价旧入口、深层导入和重复类型。
4. **顺带偿还邻近债务**：只清理被本次能力迁移直接淘汰的 wrapper、adapter、兼容层和历史链路，不借 SDK 化扩大无关重构范围。
5. **补齐最小合同证据**：公共类型、生命周期、错误语义、contract test 和必要文档随能力一起演进；用户可见且已发布的变化遵守 semver 与迁移合同。

并非每次改动都必须新增 SDK API。最好的伴随结果也可能是：确认能力不应公开、收紧内部边界、删除重复出口，或把公共 contract 放回正确 owner。

### 1.5 当前第一批动作

1. 以 agent、session、run、event stream 和 runtime registration 为第一条纵向能力链，完成 public surface inventory。
2. 从 `@nextclaw/kernel` 当前根导出中区分稳定嵌入接口与内部实现，先定义稳定性等级，不直接进行破坏性删改。
3. 建立一个仓库内但按“外部消费者”约束构建的 headless 示例，禁止源码深层导入和 workspace 私有 alias。
4. 以轻量 `@nextclaw/harness` 作为进程内嵌入的独立安装入口，核心实现继续归 `@nextclaw/kernel`；外部示例和文档只依赖 facade，以独立 semver 和导出合同隔离 kernel 演进。
5. 在 Harness 最小闭环上增加 `nextclaw exec`：支持非交互输入、文本 / JSON / NDJSON、取消与超时、headless 审批政策和稳定退出分类，CLI 只做适配，不复制执行语义。
6. 后续相关产品功能优先补强这条纵向链，稳定后再扩展到 provider、tool / skill、automation、channel 和 app。

相关既有设计：

- [NextClaw 后台职责边界设计](./designs/2026-08-22-backend-responsibility-boundaries.design.md)
- [NextClaw Platform SDK 公共能力面设计](./designs/2026-08-22-platform-sdk-public-surface.design.md)
- [NextClaw Client SDK 方案设计](./plans/2026-05-06-nextclaw-client-sdk-design.md)
- [NextClaw Extension SDK 方案设计](./plans/2026-05-08-nextclaw-extension-sdk-design.md)
- [NCP Phase 0 能力冻结](./plans/2026-03-17-ncp-phase0-capability-freeze.md)
- [NCP Session-Centric Agent Backend](./plans/2026-03-17-ncp-session-centric-agent-backend-design.md)

## 2. 既有季度草案（Q2 2026，待复盘）

| Theme | Outcome | Why Now | Milestone/Issue | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| 产品稳定性 | 降低用户可见错误与中断率 | 提升留存和口碑 | #TBD | @owner | Proposed |
| 多端体验一致性 | CLI / Web / Desktop 关键流程一致 | 降低学习成本 | #TBD | @owner | Proposed |
| 插件生态可用性 | 安装、升级、发布路径更顺滑 | 提升生态增长效率 | #TBD | @owner | Proposed |

## 3. 当前季度候选（Q3 2026，待复盘）

| Theme | Outcome | Entry Criteria | Milestone/Issue | Status |
| --- | --- | --- | --- | --- |
| 企业化能力 | 可观测性与权限能力升级 | Q2 稳定性达标 | #TBD | Candidate |
| 自动化交付 | 发布验证自动化覆盖提升 | 核心链路指标稳定 | #TBD | Candidate |

## 4. 非目标（Not Doing）

| Item | Reason | Revisit Date |
| --- | --- | --- |
| 事项标题 | 当前收益低于维护成本 | YYYY-MM-DD |

## 5. 更新节奏

- 每周：从 Roadmap 拆解到 [TODO](./TODO.md) `Next`。
- 每月：复盘里程碑状态并更新优先级。
- 每季度：重排主题与资源分配，清理失效项。
