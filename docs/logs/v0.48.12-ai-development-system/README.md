# AI 开发体系完整落地汇总

## 迭代完成说明

本批将[架构设计](../../designs/2026-09-08-ai-development-system.design.md)和[意图宏设计](../../designs/2026-09-08-intent-macro.design.md)接入实际规则入口；执行与验收 ID 见[计划](../../plans/2026-09-08-ai-development-system.plan.md)。

- 单一 lifecycle Meta Skill 管 standard/trivial/bugfix、风险与升级，原七阶段 owner 提供方法。
- 设计前置验收标准与必要矩阵；review 支持 design/implementation 两种 mode；validation 明确 AI 验收，保留 delivery 的用户验收 WIP。
- 知识治理加入事实来源、作用域、有效性、冲突与更新，复用现有权威源而非新建数据库。
- commands 成为宏的唯一语义目录：短发布表达、审查、收尾、记想法指向原 owner；创建/修订继续用 `/new-command`，调用不加载维护合同。
- 复盘区分事实更新与方法/流程改进；优先原位修正、合并、收窄、替换、删除，无增量不落盘。
- 旧架构标记历史身份，体系演进入口直接指向现行设计，避免双重召回。

结构根因是已有机制分散、职责未统一，而非完全缺少分类或退场规则。修改前核对实际 lifecycle、review、knowledge、retrospective 和并发 diff，复用原 owner；没有新增 Skill、执行框架、治理脚本或放宽 baseline。

### 2026-09-10：Skill 发现分层与共享 Wiki

后续真实会话暴露了新的宿主级约束：Codex 会在初始上下文注入所有可发现 skill 的名称、description 和路径；仓库的 37 个平铺入口已接近发现列表上限，并在当前会话实际遗漏了 3 个入口。旧检查只预算 description，总体通过但没有保护真实 discovery 成本。

本次按[发现分层设计](../../designs/2026-09-10-skill-discovery-hierarchy.design.md)把体系推广为通用工作拓扑：顶层只保留稳定 workflow root、阶段节点和少量真正独立的任务入口，不把开发视为唯一可能的工作域；未来运营、内容或研究形成共同状态与完成门后可建立自己的流程节点，但不为目录整齐预造空壳流程。

- `.agents/skills` 从 37 个入口收敛为 15 个：开发 lifecycle、七阶段 owner 和七个独立工作流。
- 22 个跨入口复用的完整 Skill 下沉到 `.agents/wiki/skills` 的六个领域分组；它们保留 `SKILL.md`、frontmatter、references 和 scripts，由当前 Skill 条件引用，但不再进入顶层发现列表。
- `.agents/wiki/knowledge` 承载共享事实、背景和来源索引，不拥有流程或授权；首个条目记录 Codex skill 发现机制和仓库观测方式。
- 检查器新增 discovery 代理预算、下级 Skill 分组/frontmatter/非发现性、不回流与全 Wiki 链接检查，并把稳定拓扑常量从审计执行中拆出。
- 不保留旧路径软链接、平行副本或重复 owner；现有阶段、commands、脚本和测试均改指唯一新路径。

## 测试/验证/验收方式

自动验证：

| 检查 | 结果与证明范围 |
| --- | --- |
| `pnpm check:skill-progressive-loading` | PASS：入口/description 预算、链接、七阶段 owner、循环与验收字段 |
| `node --test scripts/governance/checks/skill-progressive-loading.test.mjs` | 8/8 PASS：既有检查器的正常/异常拓扑、断链、重复、退役与验收漂移用例 |
| `pnpm lint:new-code:governance` | PASS：改动文件的命名、目录和适用边界；无产品源码 |
| `pnpm check:governance-backlog-ratchet` | PASS：未增加受治理历史债务，baseline 未修改 |
| diff、文档链接与范围审计 | PASS：23 个当前改动 Markdown 的 67 个本地链接/锚点无错误；delivery 原 diff 逐字保留，未覆盖其它任务 |

方案审查在实现前完成，关闭了统计协议变体、独立新 owner 和默认重型验证三个潜在问题。实现 Review 修复了验收 marker 的精确格式、入口体积超限和 L3 纯规则误触发运行测试；均按原预算修复，未放宽检查。

以下是主代理对实际入口的静态场景推演，不是独立模型盲测或已执行的产品任务：

| ID | 输入场景 | 实际合同路径与结论 |
| --- | --- | --- |
| S01 | 改一处无行为影响的普通文案 | lifecycle：trivial → 判定/修改/定向验证/轻审；不建独立设计 |
| S02 | 新增有状态交互能力 | standard → 验收设计/矩阵 → design Review → 实现/AI 验收 → 用户交付 |
| S03 | 一行代码改变持久化格式 | 风险按语义识别，不能 trivial；正式设计与相关验证 |
| S04 | trivial 调查发现跨 owner 变化 | 显式升级 standard，保留有效证据，不降低范围 |
| S05 | 用户只要求解释或设计 | 入口止于指定产物，不自动开发或发布 |
| S06 | 根因明确的局部纯逻辑 bug | 理解选择单元层复现；符合低风险门才内联设计 |
| S07 | 偶发流式/实例状态故障 | 真实链路或现场证据；根因不明继续调查，不声称复现成功 |
| S08 | 测试通过但有用户结果未验证 | AI 验收 unverified，整体门不通过，不能以测试数收尾 |
| S09 | 方案审查发现目标遗漏 | review(mode=design) 返回 Design，不能直接实现 |
| S10 | 已交付而用户未回复 | 保持待验收语义；未回复不等于验收通过 |
| S11 | `/发布 全部` 与 `/发布 npm+runtime` | 分别映射全平台和常规产品；只有前者含 Desktop |
| S12 | “解释 `/发布 全部`” | 只解释，宏出现不构成执行授权 |
| S13 | 本次限制与“以后都如此” | 前者仅绑定本任务，后者按授权修订唯一宏定义 |
| S14 | 未知宏、跨项目同名 | 不杜撰；明确作用域，必要时消歧 |
| S15 | 设计文档声称将采用某架构 | 知识合同识别为决策，不证明实际实现 |
| S16 | 版本变化使旧知识失效 | 更新原事实或标待复核，核对来源，不追加平行真相 |
| S17 | 一次漏执行已有充分方法 | 修调用/当前任务，不默认新增常驻提醒 |
| S18 | 无新信息的普通任务完成 | 轻量复盘结束，不生成日志或 Skill |
| S19 | 多次交付遗漏暴露完成门缺口 | 归 Meta Skill 原 owner，记录反例与复核/退出条件 |
| S20 | 模型升级后旧补丁无净收益 | 按原资产生命周期复核、收窄或删除，退出默认加载 |

证明边界：规则的连通性、静态语义和治理预算已检查；未运行另一个模型/新会话的行为回归，也未用真实发布制造副作用。纯规则修改不适用产品 tsc/build/运行冒烟。工具检查不能证明任意模型永不误解；后续真实任务反馈按已落地复盘机制处理。

2026-09-10 分层迁移的自动验证：

| 检查 | 结果与证明范围 |
| --- | --- |
| `pnpm check:skill-progressive-loading` | PASS：15 个顶层入口、22 个分组 Wiki Skill、2,726 discovery 字符、1,392 description 字符；分组/frontmatter/非发现性、流程拓扑、链接和验收合同通过 |
| progressive-loading + 文档命名单元测试 | 19/19 PASS：含分组 Wiki Skill、可发现根禁止分组、knowledge 禁止 `SKILL.md`、发现预算溢出和既有异常拓扑反例 |
| task telemetry 脚本测试 | 12/12 PASS：目录下沉后的 report/dashboard 路径与行为保持 |
| marketplace validator 测试 | 4/4 PASS：目录下沉后的发布校验脚本保持 |
| `pnpm lint:new-code:governance` | PASS：改动路径、命名、模块和包边界检查通过 |
| `pnpm check:governance-backlog-ratchet` | PASS：未放宽 baseline，未增加治理债务 |
| release action 测试 | 12/15 PASS；3 项为迁移前已存在的 workflow target 与发布 Skill 断言漂移，本次只更新被移动 Skill 的读取路径，不改变发布语义 |

此变更只涉及 AI 规则、Skill 资产、知识与治理脚本，不适用产品 `tsc`、build 或运行冒烟。发现列表缩减只会在新会话中完整生效，已启动会话不会自动替换初始上下文。

## 发布/部署方式

2026-09-09：用户追加“合入主干”授权，本批规则、文档及依赖的用户验收合同随主干提交交付；无关 contributor PR 验收计划排除。Git 提交和远端引用作为合入事实源，不触发产品发布或部署。

本地规则文件已更新，后续加载使用新定义；已有会话已载入的旧上下文不会自动被宿主替换。2026-09-10 用户明确授权将 Skill 发现分层批次提交、合入并推送 `master`；Git 提交和远端引用作为交付事实源，不触发产品发布或部署。原 delivery 与用户验收 reference 保留；validation 原输出约束与 lifecycle 用户验收边界保留。

## 用户/产品视角的验收步骤

1. 打开架构和 commands，确认三条流程与简短宏的范围清楚。
2. 在后续任务中输入“解释 `/发布 全部` 与 `/发布 npm+runtime`”，应只解释且能区分 Desktop 范围，不执行发布。
3. 对一个明确小改和一个有状态功能分别发起任务，应看到不同流程投入；standard 在实现前给出验收设计与方案 Review。
4. 普通无新信息的任务收尾不新增规则；真正事实变化更新原条目而非追加重复日志。
5. 在新会话查看仓库 skill，应该只出现 15 个顶层入口，不直接出现前端、发布、runtime 等下级 Wiki Skill。
6. 打开 `.agents/wiki/knowledge/codex/codex-skill-discovery.md`，应能区分官方事实、仓库近似指标和复核日期。
7. 发起明确的 NPM 发布或前端状态设计任务，应由 delivery/design 阶段条件读取对应分组 Wiki Skill，且不存在旧 skill 路径兼容副本。

以上是可操作验收建议；本批没有声称用户已经实际验收通过。体系维护是内部规则变化，不添加产品文档站功能说明或 changeset。

## 可维护性总结汇总

沿用 38 个 Skill，新增两份按条件读取的 reference；删除重复模板和说明，收敛宏目录中的长执行流程到原 owner。AGENTS 从 11997 降到 11951 字节，Skill 入口总量从 161955 降到 161926 字节，description 从 4368 降到 4140 字符；预算阈值保持原值。新增 reference 与设计/计划/证据属于按需资产，不将入口缩短冒充全仓总量下降。

目录预检与治理检查通过；代码 maintainability guard 不适用，因为未改源码/脚本/运行配置。主代理完成规则主链路和反例审查。新增本批唯一迭代记录用于独立的大型规则重构交付；不按微调创建多份日志。

2026-09-10 后续分层把上述“沿用 38 个 Skill”的阶段性结论替换为发现面最小化：顶层实值为 15 个，description 1,392 字符，discovery 代理 2,726 字符。22 个 Skill 不是删除或降格为普通文档，而是按六个领域分组迁入按需 Wiki；知识库与下级 Skill 有不同权威边界。检查器主文件经主观可维护性复核后把稳定预算/分类表拆出，避免 500 行零余量，同时没有继续细拆执行逻辑。

## NPM 包发布记录

不涉及 NPM 包发布。
