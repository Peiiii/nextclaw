# Nextbot Repo Maintainability Governance Plan

**Goal:** 把 `nextbot` 的可维护性治理从“看到超长文件再拆”升级为“仓库全覆盖 + 新债务默认拦截 + 核心红区持续收敛 + 按链路拆分演进”的长期机制，避免同类问题反复出现。

**Why Now:** 截至 2026-03-19，仓库 maintainability report 已经能稳定暴露一批热点，但热点分布说明问题不是单个文件失控，而是治理系统仍有盲区、主链路边界不清、同类复杂度在多个模块重复长大。如果继续按“发现一个修一个”的方式推进，项目会持续出现新的 god file。

**Related Plan:** 规则和静态检查层的细节请见 [ESLint And Maintainability Governance Plan](./2026-03-19-eslint-maintainability-governance-plan.md)。本文件位于其上层，定义仓库级治理目标、操作机制、阶段计划与收敛路径。

---

## 1. 现状判断

当前仓库已经具备这些基础：

- 根级 ESLint flat config 已启用文件/函数长度约束、语句数、嵌套深度与编排重区的 cognitive complexity。
- `post-edit-maintainability-guard` 已能对变更文件执行 diff-only 文件级、函数级与命名职责一致性检查。
- `docs/logs` 与 `AGENTS.md` 已具备记录与治理规则承载能力。

但目前仍有四类根因没有被系统性解决：

### 1.1 治理覆盖不完整

不是所有 workspace 都纳入统一的可维护性闸门。例如部分工作区缺少 `lint` 脚本或未被 maintainability report 扫描，导致治理存在盲区。盲区一旦存在，历史债务会在这些区域持续累积，而主仓库又感知不到。

### 1.2 主链路仍有 monolith 倾向

当前热点并非随机分布，而是集中在几类核心编排模块：

- runtime 主循环
- provider 协议适配与流式解析
- CLI service / diagnostics / runtime 启停
- UI server controller / config 写入
- channel runtime 大型 adapter
- UI 大表单 / 大容器

这说明根因不是“少数人写长了”，而是这些链路缺少稳定边界，导致新能力总是往既有大文件里堆。

### 1.3 规则主要限制体积，尚未完全限制职责漂移

现有规则已经能抓到长度和复杂度，但还不能充分阻止这些行为：

- 一个文件同时承担协议适配、业务决策、状态变更、序列化和错误转换
- 同一类复杂处理在多渠道/多模块重复复制
- UI 组件长期持有业务编排
- controller / service / provider 继续接纳“顺手加一点”逻辑

### 1.4 存量债务与增量债务还没有分层经营

如果治理目标只写成“把 warning 修完”，团队会陷入两个极端：

- 要么被历史债务压死，不敢动代码
- 要么因为历史债务太多，放弃对新增债务的治理

正确方向应当是：

- 对新增债务保持强阻断
- 对存量债务建立红区清单与持续收敛机制
- 对热点按链路分批拆解，而不是大扫除

---

## 2. 治理目标

本方案不追求“一次性清零所有维护性问题”，而追求三层长期结果：

### 2.1 仓库全覆盖

所有 workspace 都必须进入同一套 maintainability 治理闭环，至少满足：

- 有 `lint`
- 有统一 ESLint 基线
- 能出现在 maintainability report 中
- 新增子项目不能绕开这套机制

### 2.2 新债务默认拦截

开发者的默认路径应当是“想加逻辑时，先找到正确边界和正确模块”，而不是“先塞进去，再看 lint 提不提示”。凡新增或恶化的可维护性债务，应当由工具默认暴露并尽量阻断。

### 2.3 核心红区持续收敛

对核心主链路的热点文件，必须建立显式红区列表。红区的目标不是立刻完美，而是：

- 不再继续膨胀
- 每次触达都顺手消化一部分职责
- 最终按链路拆解为稳定分层

---

## 3. 治理原则

### 3.1 先修机制，再修个例

每次发现维护性问题时，优先问：

- 这是单点事故，还是机制漏洞？
- 以后怎么让同类问题默认更难出现？
- 能不能把判断从人工 review 转成自动闸门？

除非明确是偶发边角问题，否则不接受“只修一处，不补机制”。

### 3.2 先按链路治理，不按文件碎修

文件只是症状，链路才是根因。治理应优先按以下链路组织：

- `core runtime`
- `provider integration`
- `cli service/runtime`
- `server ui backend`
- `channel runtime`
- `ui config/forms`

每次治理优先拆清这条链路里的层级边界，而不是仅把一个函数拆成三个 helper 之后继续把职责留在同一个 god file 中。

### 3.3 只允许增量收敛，不允许反向漂移

治理不要求一夜还清所有历史债务，但要求：

- 红区文件禁止继续增长职责面
- 热点函数禁止继续恶化
- 新文件必须立即符合命名和职责边界
- 新 workspace 必须当天接入治理

### 3.4 可维护性必须可验证

任何治理规则都应优先选择可自动验证的形式，而不是留在口头约定中。结论必须尽量来自：

- ESLint
- maintainability guard
- workspace inventory script
- CI report

而不是“reviewer 看起来不太舒服”。

---

## 4. 治理模型

治理系统分为四层，各自负责不同问题。

### 4.1 Layer A: Coverage Layer

目标：保证所有代码都被看见。

负责内容：

- workspace inventory
- 缺失 `lint` 的工作区清单
- ESLint 基线覆盖校验
- maintainability report 的全仓覆盖

失败信号：

- 新增 workspace 没进 report
- 某个目录长期没有 lint 入口
- 大文件存在但报告里完全不可见

### 4.2 Layer B: Gate Layer

目标：阻止新增和恶化的债务。

负责内容：

- ESLint 的长度/复杂度规则
- `post-edit-maintainability-guard`
- 命名职责一致性检查
- 新增 `eslint-disable` 的拦截

失败信号：

- 新文件一上来就是大文件
- 触达热点时继续把热点做大
- 新增命名职责错配
- 为过规则新增 disable comment

### 4.3 Layer C: Hotspot Layer

目标：管理存量红区。

负责内容：

- 红区文件清单
- 每个红区文件的主职责说明
- 下一步拆分缝
- 允许/禁止继续承接的新职责类型

失败信号：

- 红区文件继续接纳 unrelated logic
- 同一热点反复被触达但没有净减少复杂度
- 文件边界无法一句话说清

### 4.4 Layer D: Architecture Layer

目标：建立长期不会反复制造同类问题的模块边界。

负责内容：

- 不同链路的分层模板
- 重复模式抽取
- UI / manager / service / controller / adapter 的边界约束
- 模块命名和路径职责一致性

失败信号：

- 多个模块重复出现同一类复杂流程
- controller 继续承接业务编排
- UI 容器继续承接 auth flow / normalization / side effect orchestration

---

## 5. 红区治理机制

### 5.1 红区定义

满足任一条件即可进入红区：

- 文件严重超出长度预算
- 单文件出现多条函数级违规
- 位于主运行链路且出现高复杂度函数
- 同一模块连续多次成为 maintainability 热点
- 团队已明确认定“继续堆逻辑风险很高”

### 5.2 当前建议红区

以下模块应作为首批红区管理对象：

- `packages/nextclaw-core/src/agent/loop.ts`
- `packages/nextclaw-core/src/providers/openai_provider.ts`
- `packages/nextclaw/src/cli/commands/service.ts`
- `packages/nextclaw-server/src/ui/router/chat.controller.ts`
- `packages/nextclaw-server/src/ui/config.ts`
- `packages/nextclaw-ui/src/components/config/ProviderForm.tsx`
- `packages/extensions/nextclaw-channel-runtime/src/channels/discord.ts`
- `packages/extensions/nextclaw-channel-runtime/src/channels/telegram.ts`

### 5.3 红区操作规则

红区文件默认执行这些规则：

- 不接受“顺手再加一点”式扩展
- 新能力优先落到新模块，而不是继续塞进红区
- 触达红区时，至少要回答“这次新增逻辑为什么不能落到旁边的新文件”
- 若无法拆分，必须在迭代记录中写明下一步拆分缝

### 5.4 红区验收口径

红区的阶段性成功不是“立即清零 warning”，而是：

- 文件长度不再继续增长
- 复杂函数数量下降
- 复杂函数的职责被切成稳定阶段
- 新增逻辑开始落到旁边的新模块

---

## 6. 按链路的推荐拆分模板

### 6.1 Core Runtime

适用：`loop.ts`、`session manager`、tool orchestration

推荐分层：

- session lookup / metadata mutation
- prompt assembly / context preparation
- tool loop orchestration
- response finalization
- event emission / persistence

禁止现象：

- 一个方法同时做 session 读写、prompt build、tool dispatch、final reply emit

### 6.2 Provider Integration

适用：`openai_provider.ts`、其它 provider adapter

推荐分层：

- request body assembly
- stream chunk parsing
- reasoning extraction
- tool call aggregation
- fallback / retry policy
- response normalization

禁止现象：

- 一个 provider 方法同时承担 wire protocol 适配、stream parse、error fallback、tool call decode

### 6.3 CLI Service / Runtime

适用：`service.ts`、`diagnostics.ts`

推荐分层：

- service lifecycle
- UI host lifecycle
- plugin runtime bridge
- readiness / health probing
- diagnostics collection
- user-facing rendering

禁止现象：

- 启动入口同时处理进程管理、日志、端口探测、插件桥接、UI host 初始化、CLI 文案输出

### 6.4 Server UI Backend

适用：`chat.controller.ts`、`config.ts`

推荐分层：

- route/controller 只做协议适配
- request normalization
- action executor / patch applier
- response view builder
- SSE / stream adapter

禁止现象：

- controller 里直接做大段业务决策和数据 patch
- config 文件持续增长成“所有页面配置的总入口大对象”

### 6.5 Channel Runtime

适用：Discord / Telegram / QQ 等

推荐分层：

- inbound message normalization
- mention / policy gating
- attachment resolve
- delivery chunking / stream flush
- platform-specific send/edit abstraction

禁止现象：

- 每个渠道文件都重复实现一遍大段 streaming send / flush / incoming normalize 逻辑

### 6.6 UI Config / Forms

适用：`ProviderForm.tsx`、`RuntimeConfig.tsx`

推荐分层：

- page/container shell
- form state / validation hook
- auth flow hook
- field schema / UI sections
- submit normalization / mutation adapter

禁止现象：

- 单个 TSX 组件长期持有所有 state、side effect、normalization、mutation、auth polling

---

## 7. 工具与流程闭环

### 7.1 日常开发闭环

每次涉及代码改动时，应形成以下闭环：

1. ESLint 先暴露长度和复杂度信号
2. `post-edit-maintainability-guard` 在收尾阶段阻断新增债务
3. 若触达红区文件，必须说明是否顺手减债
4. 迭代记录写入验证结果与拆分缝

### 7.2 周期性审计闭环

至少每周一次执行：

- 全仓 maintainability report
- 红区文件状态复盘
- 覆盖盲区检查

输出应包括：

- 新增红区候选
- 已收敛红区
- 仍在恶化的热点
- 未覆盖 workspace 清单

### 7.3 CI 双轨机制

建议分成两条：

- `diff-only gate`
  - 负责阻断新增债务
  - 对 PR / 本次改动敏感
- `full-repo audit`
  - 负责全仓体检
  - 默认不阻断每次开发，但必须持续可见

这样既不会被历史债务拖死，又不会失去全局视野。

---

## 8. 阶段计划

### Phase 0: Coverage Closure

目标：所有 workspace 都进入治理视野。

完成标准：

- 所有 workspace 有 `lint` 或被明确标注为不适用
- maintainability report 能覆盖所有应治理代码目录
- 对缺失项形成 inventory

### Phase 1: Gate Hardening

目标：新增债务默认更难进入主干。

完成标准：

- `post-edit-maintainability-guard` 稳定纳入日常闭环
- 命名职责错配、函数级新增债务、disable comment 已可自动暴露
- 新子项目接入规则被验证可执行

### Phase 2: Hotspot Freeze

目标：红区文件停止继续长大。

完成标准：

- 首批红区文件清单固定
- 红区文件的“允许新增职责 / 禁止新增职责”说明成文
- 触达红区文件的迭代都要记录是否减债

### Phase 3: Chain Refactor

目标：按链路拆出稳定边界。

完成标准：

- 至少完成一条主链路的分层示范
- 其余链路可复用同类拆分模板
- 新功能开始优先落到新边界而非旧大文件

### Phase 4: Governance As Default

目标：治理不再依赖临时推动，而成为默认开发习惯。

完成标准：

- 新热点增速明显下降
- 红区文件数量稳定下降
- 新文件命名与职责错配显著减少
- 团队在 review 中讨论更多的是边界和抽象，而不是“为什么这个函数又这么长”

---

## 9. 指标与验收

建议追踪以下指标：

- 纳入 maintainability report 的 workspace 覆盖率
- 红区文件数量
- 红区文件总行数是否继续增长
- 每周新增的函数级违规数量
- 每月净减少的热点函数数量
- 新增命名职责错配数量

成功信号不是 warning 总数立刻归零，而是：

- 未覆盖区域逐步归零
- 热点不再继续恶化
- 新债务明显减少
- 红区开始出现稳定拆分成果

---

## 10. 非目标

本方案当前不追求：

- 一次性清零全部历史 warning
- 用更多例外或放宽阈值来“快速变绿”
- 在第一阶段就为所有复杂模式写自定义 ESLint 规则
- 强制对每个大文件立即做大规模重构

这些做法会制造高噪音或高风险，不利于长期收敛。

---

## 11. 下一步建议

建议按以下顺序落地：

1. 先补 `Coverage Layer`
   - 盘点所有缺失 `lint` 或未纳入 report 的 workspace
2. 建立首批红区清单
   - 将当前核心热点文件正式列入红区
3. 为每条主链路写一页拆分策略
   - 先从 `core runtime` 和 `cli service/runtime` 开始
4. 把周期性审计固定下来
   - 形成每周或每迭代一次的 maintainability 复盘

如果要进入执行阶段，建议下一份文档不是再写抽象原则，而是把本方案拆成 `Now / Next / Later` 的执行 backlog，并为首批红区文件分别定义可落地的第一刀拆分缝。
