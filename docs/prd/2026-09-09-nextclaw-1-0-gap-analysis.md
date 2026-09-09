# NextClaw 1.0 现状与差距清单

版本：本次规划交付版，源码现状基线。调查：2026-09-09；补查与交付：2026-09-10。

目标依据：[1.0 产品定义](./2026-09-09-nextclaw-1-0.prd.md)。阶段排序及具体开发包 D01–D16 的唯一落点：[Roadmap：1.0 分阶段开发功能表](../ROADMAP.md#10-分阶段开发功能表)。

## 证据边界

代码基线为本规划隔离分支的 `f4c0248623fd5258f89d192f9ec5706af033b725`；本次愿景与规划 Markdown 是未提交改动。未合并其他工作区 WIP，未检查生产实例、线上用户配置或远程最新版本。

本次沿定义、注册、存储、触发与消费位置做静态链路阅读，没有运行产品验收或持续试用。下文“已有”均表示源码中的实现基础，不表示功能已达到 1.0 的稳定性和效果要求。“未证明”不能解读为“全仓绝无此能力”。

2026-09-10 补查：本地 `master` 与调查基线相同；`origin/master` 为 `f50a3c022fb774c75fd7ee33cd37550b88e80760`。两者差异未涉及本清单引用的记忆、调度、学习、项目工作和收件箱 owner。规划调查时使用本地已保存的远端引用，随后在合入交付阶段执行 fetch，确认远端主干仍为该版本；这不替代产品运行验证，其他活跃 worktree 也不作为已交付能力计入。

## F1–F9 逐项现状判定

**九项是 1.0 能力验收范围，不是九项全新开发需求。现有证据不足以将其中任何一个完整功能包标为“完全没有”。**

| 功能 | 源码确认已有的行为 | 尚未验证 / 候选补强 | 当前处理 |
| --- | --- | --- | --- |
| F1 用户画像与状态记忆 | USER 模板要求持续更新用户理解；文件工具可修改资料，MemoryStore 持久保存并注入记忆（E1/E2） | 自动提取准确度、临时状态到期和用户逐条管理体验未实测 | 已有资料与记忆基础；验证后再决定条目管理增量 |
| F2 目标与计划管理 | 项目工作项已有持久状态、活动、产物、Agent CRUD 工具与 UI（E3/E6）；普通计划也可用文件保存 | 跨项目个人目标、阶段计划与跟进联动未证明；不能仅因缺少专门目标类型就认定无法完成 | 已有任务/计划载体；先试用现有工作项和文件，再决定结构增量 |
| F3 跨会话记忆召回 | memory_search/get、workspace 记忆注入、session_search 与历史读取工具已有注册和消费路径（E2/E6） | 跨 workspace、相关性、旧事实替换和来源解释效果未实测 | 已有召回链路；优先验证，不能列为从零新增 |
| F4 持续关注清单 | automation-setup/cron 已支持自然语言建立持续跟进、绑定已有会话；job 可列出、启停和移除；订阅有暂停/恢复与状态（E4/E6） | 从整体用户背景自主识别关注需要、统一展示目标关系未证明 | 已有持续跟进；需要验证组合使用，清单统一与自主识别属于候选增强 |
| F5 后台分析规划与事件响应 | cron 已定时运行 Agent；内置技能要求检查文件/工作板并报告有意义变化；事件入口有筛选、去重、预算和投递（E4/E6） | 无新外部变化时自主分析已有信息、形成规划与讨论问题的效果未实测；相关性、静默与预算体验也待验证 | 已有后台运行基础；先验证分析/规划工作流，不因重新定义主动性就新造调度器 |
| F6 主动沟通与行动跟进 | 工具执行、会话跟进和项目更新已有基础；deliver_to_inbox 持久交付材料，UI 支持阅读与继续会话（E4/E6） | 主动发起并接续讨论、纯告知的独立完成、单次延后/长期停止的语义，以及执行结果回写未证明 | 已有内容交付/继续会话/执行链路；通过 K2-A/B 确认实际差异，不能只按工具执行率判定 |
| F7 自动复盘 | 已有运行后学习提示；可选 learning loop 自动创建复盘子会话，默认关闭（E5） | 真实启用情况、用户反馈分类和复盘有效性未实测 | 已有自动复盘机制；默认未启用不等于没有功能 |
| F8 经验应用与技能改进 | 复盘任务要求创建/修改技能；后续上下文通过 SkillsLoader 提供技能目录，要求适用时读取（E5） | 技能是否成功写入/使用、是否改善结果，以及非技能经验应用未实测 | 已有技能沉淀与复用路径；先做开关启用和效果验证，不另建学习系统 |
| F9 改进记录与撤销 | 复盘请求元数据、复盘会话和工具记录可追溯，文件可被再次编辑（E5） | 本次已查 owner 中未找到专门管理持久改进、后续效果和安全撤销的完整合同；仍需以用例核验现有记录/文件方式能否满足 | 专门产品闭环尚未证明；是候选补强，不能将缺少专门页面直接判成完全没有能力 |

判定依据分开保存：源码存在、默认配置、实际运行、效果达标是四件不同的事。已有配置/技能组合若能通过验收，开发增量可以为零；不能因为尚未测试就默认新建功能。

## 差距与处理建议

| ID | 对应目标 | 已查到的基础 | 仍需完成或证明 | 建议处置 |
| --- | --- | --- | --- | --- |
| G1 | 搭档角色 | 初始化写入 SOUL/USER 等文件；运行时身份、bootstrap、用户文件参与上下文装配 | 产品默认身份仍是 assistant；需落实长期搭档使命与持续参与授权语义；旧用户已有文件不会因新模板自动更新 | 修改同一运行/初始化链路，并设计保留用户定制的迁移；不只改文档或模板 |
| G2 | 懂用户 | USER 模板允许逐步更新；MemoryStore 持久化 Markdown；memory_search/get 与上下文注入已有实现 | 跨会话正确调用、确认与推断区分、纠正/时效/停止使用、用户可见管理未通过端到端验收；作用域随 workspace/project 变化 | 先用现有文件与工具验证 A1–A3，暴露具体缺口后补产品语义，不预先重建记忆引擎 |
| G3 | 目标与持续关注 | 已有项目工作项、状态、关注标记、活动和产物链接 | 已查工作项以 projectId 为边界；用户跨项目目标、当前状态与持续关注之间的更新关系尚未证明 | 保留项目工作 owner，设计用户层面的理解与关注关系；不把所有用户事项强塞进项目 |
| G4 | 主动帮忙 | Cron 持久化调度并调用 Agent；observation 可订阅事件、筛选去重、持久化投递并触发目标会话 | 从用户整体上下文自主分析、规划和发起讨论，以及关注识别、告知和行动选择，尚未形成验收证据；不能只测事件通知 | 复用现有唤醒与会话链路，先验证思考、沟通和行动各分支；按真实差异补强 |
| G5 | 自我改进 | 已注册 learning loop；RunFinished 后达到工具调用阈值可启动复盘子会话；技能写入后可被后续技能目录发现 | 默认关闭；复盘主要产出技能；触发不等于改进成功，代码记录的是复盘请求。理解修正、参与偏好、效果验证与撤销尚未形成完整证据 | 复用学习入口与技能资产，补反馈分类、持久改动记录、应用验证和后续效果验证；不能只打开开关宣称完成 |
| G6 | 完整可用范围 | Native 运行可接收装配上下文；observation 校验目标 runtime；已有工具、执行、会话和管理入口 | observation 当前明确只支持 Native；上下文注入可被配置关闭；多入口一致性、持续运行、失败恢复和升级质量需实测 | 首发明确支持矩阵，优先验证 Native 闭环，再扩大覆盖；用户仍能看见能力差异 |

## 差距对应的功能包

功能定义唯一来源为 [PRD 第 3 节](./2026-09-09-nextclaw-1-0.prd.md)，具体分阶段交付范围已拆入 Roadmap 的 D01–D16，本节负责说明复用位置及实际增量的不确定性。每个开发包进入实施时核验对应现状；已有配置或能力组合满足标准时，取消重复编码并保留验收证据。不能用“尚未运行验证”代替本次应交付的开发范围和排序。

| 差距 | 对应功能 | 候选增量（待运行差异确认） |
| --- | --- | --- |
| G1 | F1–F9 的运行基础 | 对齐实际运行使命、初始化资料和持续授权输入，补已有用户迁移；保留用户定制与现有安全约束 |
| G2 | F1 用户画像、F3 跨会话召回 | 在已有记忆读写/注入上补条目来源、确认与时效、纠正/停止使用、查看入口；验证后台与新会话选择相关资料 |
| G3 | F2 目标计划、F4 关注清单 | 补个人目标/阶段计划/行动的可管理关系与关注生命周期；复用现有项目工作记录，处理目标调整对后续跟进的影响 |
| G4 | F4 关注清单、F5 分析规划、F6 主动沟通与行动 | 在现有定时/事件入口上验证自主分析、规划与话题发起；按缺口补沟通接续、未决状态、时机与预算、告知或执行分支及必要回写 |
| G5 | F7 自动复盘、F8 经验应用、F9 改进记录 | 在现有学习入口上补结果/反馈触发与分类、经验应用位置、后续效果证据、记录和撤销；避免将所有反馈都写成技能 |
| G6 | 全部功能的交付基础，重点 F5/F6 | 明确 Native 首发能力、持续运行与离线状态；验证执行/通知/恢复/升级，按范围补可靠性缺口 |

## E1：使命与用户背景从哪里进入运行

- [ServiceWorkspaceManager](../../packages/nextclaw-service/src/managers/service-workspace.manager.ts) 将 SOUL、USER、MEMORY 等模板复制到 workspace；已有文件在非 force 模式下跳过。
- [SOUL 模板](../../packages/nextclaw/templates/SOUL.md) 当前称自身为 lightweight AI assistant；[USER 模板](../../packages/nextclaw/templates/USER.md) 要求持续了解用户，已有 Context 段落。
- [AgentBootstrapContextProvider](../../packages/nextclaw-kernel/src/contributions/context-provider/providers/agent-bootstrap-context.provider.ts) 读取 project/host bootstrap 文件；读取预算、压缩状态及 cron/subagent 的 minimalFiles 会影响实际输入。
- [Native 静态上下文](../../packages/nextclaw-kernel/src/contributions/context-provider/providers/native-static-context.provider.ts) 注入 personal assistant 身份；其中限制超出用户请求的长期规划，需要在明确用户持续授权的前提下审视措辞，保留人类控制与安全约束。

结论：只更新仓库 VISION 不会自动改变运行中的产品身份，也不会更新所有既有用户文件。规划应覆盖运行入口与升级后的用户资料，而不覆盖用户自定义内容。

## E2：记忆保存、检索和使用

- [MemoryStore](../../packages/nextclaw-core/src/features/agent/features/memory/memory.store.ts) 读取 workspace MEMORY、memory/MEMORY 与当日记录，提供长期写入和日记录追加。
- [CoreToolProvider](../../packages/nextclaw-kernel/src/contributions/tool-provider/providers/core-tool.provider.ts) 暴露文件写入/编辑及 memory_search/get；[Memory tools](../../packages/nextclaw-core/src/features/agent/tools/memory.tools.ts) 当前按本地文本子串搜索并读取片段。
- [WorkspaceMemoryContextProvider](../../packages/nextclaw-kernel/src/contributions/context-provider/providers/workspace-memory-context.provider.ts) 从 hostWorkspace 读取记忆并按配置截断；[ContextProviderRunContextService](../../packages/nextclaw-kernel/src/contributions/context-provider/services/context-provider-run-context.service.ts) 解析 workspace/project 作用域。
- [ContextProviderContribution](../../packages/nextclaw-kernel/src/contributions/context-provider/index.ts) 注册 provider；[AgentContextWindowManager](../../packages/nextclaw-kernel/src/managers/agent-context-window.manager.ts) 装配 contextBlocks/tools；[AgentRunRuntimeContribution](../../packages/nextclaw-kernel/src/contributions/agent-run-runtime/index.ts) 将上下文送入 Native 运行，受 injectNextclawContext 配置影响。

结论：有持久化和回忆链路，不宜把“没有懂用户的完整验收”写成“没有记忆”。文件写入能力也不能直接证明自动更新和用户纠错体验已成立。

## E3：项目工作基础

- [ProjectWork 类型](../../packages/nextclaw-kernel/src/features/projects/types/project-work.types.ts) 定义 projectId、工作状态、blocked/awaiting-user、活动与产物。
- [ProjectWorkManager](../../packages/nextclaw-kernel/src/features/projects/managers/project-work.manager.ts) 使用 store/query 管理持久状态、活动和变更事件；[Kernel 装配](../../packages/nextclaw-kernel/src/app/kernel-manager.factory.ts) 将其与 ProjectManager 连接。

结论限定于该 owner：可复用项目执行跟踪，不能仅凭这个模型宣称已有用户全局目标与计划管理；也不意味着非项目目标一定要新增同等复杂的数据系统。

## E4：定时与事件驱动

- [AutomationManager](../../packages/nextclaw-kernel/src/managers/automation.manager.ts) 复用 [CronService](../../packages/nextclaw-core/src/features/cron/services/cron.service.ts)，后者保存 job、调度状态并执行 onJob。
- [ServiceGatewayManager](../../packages/nextclaw-service/src/managers/service-gateway.manager.ts) 绑定 [createCronJobHandler](../../packages/nextclaw-service/src/utils/gateway-cron-job-handler.utils.ts)，经 AgentRunClient 发送至已有或 cron 会话，等待回复并检测 message 工具失败。
- [ObservationManager](../../packages/nextclaw-kernel/src/features/observation/managers/observation.manager.ts) 管理订阅及暂停/恢复；[ObservationDeliveryService](../../packages/nextclaw-kernel/src/features/observation/services/observation-delivery.service.ts) 将入站事件经策略判断、状态存储和幂等 ingress 投递到目标会话。
- [Observation 类型](../../packages/nextclaw-kernel/src/features/observation/types/observation.types.ts) 已有 predicate、去重、pending/窗口预算、过期与状态；target 为 sessionId/agentId。Manager 明确拒绝非 Native 目标。

结论：已有时间/事件唤醒基础。机械筛选与限流不等于用户层面的相关性判断；现有恢复代码也需要 A8 实测，不能凭代码存在判为通过。

## E5：学习触发、产物和再次使用

- [配置 schema](../../packages/nextclaw-core/src/features/config/configs/config-schema.config.ts) 的 learningLoop 默认 enabled=false、toolCallThreshold=15；实例是否启用未检查。
- [Kernel 装配](../../packages/nextclaw-kernel/src/app/kernel-manager.factory.ts) 注册 [LearningLoopContribution](../../packages/nextclaw-kernel/src/contributions/learning-loop/index.ts)。后者监听 RunFinished，排除子会话/禁用会话，按工具调用计数创建不通知的复盘子会话，并保存请求时间与计数。
- [学习提示](../../packages/nextclaw-kernel/src/contributions/learning-loop/utils/learning-loop-prompt.utils.ts) 要求读取历史，在不改技能、修改已有技能、新建技能中选择，使用文件工具落盘。
- [SkillsContextProvider](../../packages/nextclaw-kernel/src/contributions/context-provider/providers/skills-context.provider.ts) 用 SkillsLoader 构建 workspace/project/global 技能目录并注入运行上下文，同时包含任务后复盘提示。

结论：已存在自主复盘和技能复用的代码路径，但计数更新仅证明请求发出；技能是否正确生成、是否在下一次适用情境被采用、是否真的改善结果，需要分别验证。不能称为“完全没有自我改进”，也不能称为“已经完成自我改进闭环”。

## E6：持续跟进、操作与交付的现有用户入口

- [automation-setup](../../packages/nextclaw-core/src/features/agent/shared/skills/automation-setup/SKILL.md) 已将提醒、定期检查、持续跟进转为 cron，可绑定已有会话；[cron 技能](../../packages/nextclaw-core/src/features/agent/shared/skills/cron/SKILL.md) 包含检查文件/工作板、只报告变化的指令示例。它们是 NextClaw 产品内置技能，不是本仓库开发代理的执行规则。
- [Cron UI actions](../../packages/nextclaw-ui/src/features/cron/hooks/use-cron-job-actions.ts) 已提供启停、删除和手动运行，调用现有查询/变更 hooks；不能把这些控制列为完全新增。
- [ProjectWork tools](../../packages/nextclaw-kernel/src/tools/project-work.tools.ts) 提供持久工作项查询与修改；[项目 UI hook](../../packages/nextclaw-ui/src/features/projects/hooks/use-project-work.ts) 通过 client SDK 消费相同项目工作能力。
- [SessionToolProvider](../../packages/nextclaw-kernel/src/contributions/tool-provider/providers/session-tool.provider.ts) 注册 session_search 和历史工具，为跨会话回忆提供已有入口。
- [InboxDeliveryToolProvider](../../packages/nextclaw-kernel/src/contributions/tool-provider/providers/inbox-delivery-tool.provider.ts) 提供 [deliver_to_inbox](../../packages/nextclaw-kernel/src/tools/inbox-delivery.tools.ts)，由 [InboxDeliveryManager](../../packages/nextclaw-kernel/src/managers/inbox-delivery.manager.ts) 持久保存交付并发布事件。
- [Inbox UI manager](../../packages/nextclaw-ui/src/features/inbox/managers/inbox.manager.ts) 消费 client SDK，支持已读/归档等操作及 prepareChatReference；[Inbox 页面](../../packages/nextclaw-ui/src/features/inbox/pages/inbox-page.tsx) 将交付引用带到新会话，已有“交付后继续处理”的路径。

这些新增取证补足先前对用户入口覆盖不足的调查；仍是源码阅读，不是本轮已跑过这些功能。

## 下一步取证边界

按 Roadmap 顺序从 D01–D05 开始；每个开发包使用对应测试资料和可控事件核验其 actual/expected，确认零改动、配置/技能组合或具体代码补强，然后交付该包。无需等全部 A1–A8 现状调查结束才开始第一批建设；最终仍由完整验收判断能力是否成立。

本清单不报告缺口百分比或工期；不将静态判断冒充用户试用结论。实施时重新确认目标代码版本，增量核查已发生变化的 owner。
