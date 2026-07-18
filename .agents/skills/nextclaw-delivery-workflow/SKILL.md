---
name: nextclaw-delivery-workflow
description: 用作 NextClaw 标准开发流程/交付流程的总 owner；当用户要求规范开发流程、实现、修复、重构、方案到实现、验证、提交、收尾、完成工作，或需要阶段化节奏与主动汇报时使用。
---

# NextClaw 标准开发与交付流程

## 目标

提供一个统一的开发节奏入口，避免代理记住了很多零散规则，却仍然漏掉跨阶段义务。

`AGENTS.md` 负责固定的主流程骨架。  
本 skill 负责这些主步骤背后的条件细节、skill 路由、阶段门、收尾强制检查与最终主动汇报。

本 skill 统一承接：

- 目标对齐
- 现状调查与方案设计阶段门
- 实现前删减与收敛判断
- 实现阶段约束
- 验证闭环
- 可维护性披露
- 复盘后的机制改进
- 迭代留痕决策
- 最终汇报合同

它不替代专项 skill，而是编排它们。

## 必须联动的专项 skill

按需使用并遵守：

- `nextclaw-clean-implementation`
- `nextclaw-solution-design`
- `predictable-behavior-first`
- `nextclaw-validation-workflow`
- `post-edit-maintainability-guard`
- `post-edit-maintainability-review`
- `nextclaw-release-notes-automation`
- `nextclaw-iteration-log-governance`
- `learning-from-failures`
- 当复盘结论涉及治理系统时，用 `nextclaw-agent-instructions-governance`

## 主流程与条件展开

`AGENTS.md` 已固定 6 个主步骤。  
本 skill 负责这些主步骤背后的条件展开，避免主流程骨架与条件细节分离后漂移。

### 1. 目标与成功标准

动手前必须明确：

- 这是新增用户能力，还是非功能改动
- 这次到底要改变什么用户可见或可观察结果
- 什么现象算修好
- 哪些旧代码、旧分支、旧中间层可能先删

如果不是新增用户能力，默认目标是：

- 排除纯格式化噪音后的 `非测试语义代码净增 <= 0`
- 优先通过删除旧实现、重构收敛或相关链路减债达成，不要求删减只发生在当前改动点
- 禁止通过 hack、强行压行、牺牲可读性或把复杂度外移来伪造过线

条件联动：

- 复杂 debug：`long-chain-debugging`
- 多轮推进、易漂移任务：`iteration-work-notes`
- 明确需要目标锚点：`goal-progress-anchor`
- 用户明确要求目标模式：`goal-mode`

### 1.5 现状调查与方案设计阶段门

当任务涉及新能力、架构边界、交互结构、目录组织、跨模块 owner、持久化合同、运行链路或用户明确要求“先方案/设计文档”时，进入实现前必须联动 `nextclaw-solution-design`。

小型局部 bugfix 或纯机械改动可以跳过设计文档，但仍要能说清当前事实、owner 和验证标准。

方案设计只负责设计阶段，不接管完整开发流程；完成设计后必须回到本 skill 继续实现、验证、收尾或明确停止在设计交付。

### 1.6 Bug 复现决策门

Bugfix 默认先冻结修前失败证据，再修改，并在修后用同一观察指标复验。复现是为了减少误判，不是必须机械执行的仪式；开始前要比较“预期信息收益与回归风险”以及“时间、环境、外部调用、破坏性、偶发性成本”。

- 根因不确定、跨层链路、用户可见回归、高风险改动，或复现便宜且安全时，必须先真实复现。
- 完整端到端复现成本过高时，先切链，选择失败事件回放、边界级 A/B、最小失败测试或已有真实失败 artifact 作为修前基线。
- 只有静态证据已经直接证明根因，且主动复现成本明显高于新增信息时，才允许跳过修前主动复现；必须记录跳过理由、替代证据和修后成功条件。
- 修前与修后必须尽量保持入口、输入、配置、模型/依赖版本之外的变量一致；不能通过更换观察指标把“无法复现”误报成“已修复”。

复杂链路的复现分级、切链和观察点使用 `long-chain-debugging`。

### 2. 实现前删减与 owner 判断

进入编辑前，必须先过 `nextclaw-clean-implementation`。

至少要能说清：

- 这次准备先删什么、合并什么
- 真正的 owner 是谁
- 为什么这是单一路径，而不是补丁叠补丁
- 最小可信验证是什么

### 2.1 实现前前置探测门

进入实质编辑前，先把容易后置失败的事实探测清楚。目标是提前发现约束，而不是等实现后被 `tsc`、governance、真实 smoke 或 provider 错误倒逼返工。

必须按改动类型做最小前置探测：

- 触达目录、文件名、owner 边界：先读最近的 `module-structure.config.json`、相关 `tsconfig` alias、已有同类文件落点和命名后缀。
- 新增角色 class 前，先写出“角色 -> 目录 -> 文件名”三元组；例如 provider class 必须落到 `providers/*.provider.ts`，contribution root 的 `index.ts` 只保 contribution 装配入口。
- 触达协议、provider、runtime、bridge：先确认上游真实请求形状、模型名归一化、流式参数、SDK/CLI raw event 是否会聚合或改写事件。
- 触达运行链路：先确认当前真实入口、launcher/bin、dist 是否来自源码构建，避免用旧全局二进制验证。
- 触达真实 provider：先读取本地配置中不含 secret 的 provider 形状，例如 `apiBase`、`wireApi`、模型 id 前缀约定；不得打印 key/token。
- 触达治理敏感路径：先跑或阅读最小治理规则，预判会被命名、目录、入参 mutation、class method、context destructuring 哪类规则拦截。

前置探测结果必须直接影响实现方案。如果发现需要先搬文件、加 alias、剥 provider 前缀、重建 dist、或分层验证 raw event，就在实现前纳入计划，而不是等后置失败后补丁式修。

如果任务涉及 fallback、compatibility、环境救援或 just-in-case 逻辑，必须再联动：

- `predictable-behavior-first`

如果命名、目录落点、文件角色不清，按场景联动：

- `file-naming-convention`
- `role-first-file-organization`
- `collapsible-feature-root-architecture`
- `file-organization-governance`

### 3. 实现阶段

实现时持续遵守：

- 优先删除和简化，而不是加分支
- 业务逻辑放进清晰 owner
- 避免平行 helper、wrapper、proxy
- 不能把“我最后解释一下”当成结构不清的替代品

如果触达 NextClaw 自管理命令语义，还必须同步：

- `docs/USAGE.md`
- `packages/nextclaw/resources/USAGE.md`
- `nextclaw-self-manage`

并说明是否运行了 `sync-usage-resource`。

### 4. 验证闭环

改完后使用 `nextclaw-validation-workflow`。

至少覆盖相关子集：

- 定向测试
- 触达 TypeScript / 运行链路边界时必须跑的 `tsc`
- 触达源码、脚本、测试或运行链路配置时必须跑的 ESLint；全量 package lint 被既有错误阻塞时，必须改跑所有触达文件的 targeted ESLint，并披露全量失败的无关错误
- 用户可见行为的冒烟或贴近链路验收
- maintainability guard
- governance ratchet

生成产物固定处理：

- 普通开发、修复、重构、验证或本地 build 结束后，默认执行 `pnpm clean:generated`，把 `packages/nextclaw/ui-dist` 等生成产物恢复到 git 状态；这些文件不进入业务提交。
- 只有发布、打包或专门刷新可提交产物时，才允许提交生成产物；提交前必须说明它们为什么是本次交付合同的一部分。
- NPM/desktop 发布应优先在隔离 worktree 中生成和使用产物。发布完成后也要清理发布 worktree 的生成产物，再判断是否还有需要回流的 release metadata。
- 最终提交前必须确认生成产物状态，不得把 hash 资产漂移和源码改动混在一次业务提交里。

如果最真实的验证路径被阻塞，必须说明：

- 阻塞点是什么
- 当前用了哪个最小可信替代证明

对源码、脚本、测试、运行链路配置改动，还必须继续进入：

- `post-edit-maintainability-guard`
- `post-edit-maintainability-review`

### 5. 可维护性披露

这一步对源码、脚本、测试、运行链路配置改动是强制项。

必须主动收集并汇报：

- 总代码增减报告
- 非测试代码增减报告
- 是否满足非功能改动的行数门槛
- 本次正向减债动作是什么：
  - 删除
  - 简化
  - 复用
  - 职责收敛
  - 必要解耦抽象
- 为什么这不是靠 hack、强行压行或把复杂度转移到统计面外过线

不能等用户追问“代码是不是变多了”才补说。

如果这是非功能改动且排除纯格式化噪音后的 `非测试语义代码净增 > 0`，任务不能收尾。

### 6. 复盘与机制改进

对于 bugfix、异常修复、重构、发布闭环，或者任何暴露流程摩擦的任务，最终回复前必须做一个短复盘：

- 这次暴露出的流程缺口是什么
- 这个改进应该落在 `AGENTS.md`、已有 skill、新 skill、命令、自动化还是普通文档
- 现在能不能安全地顺手落实

如果复盘来自重复犯错、用户明确要求从教训中学习，或现有规则没有阻止同类失败，必须联动：

- `learning-from-failures`

联动后不能只写一条规则就收尾；必须确认学习闭环是否成立：

- 常驻层：是否需要进入 `AGENTS.md`
- 触发层：skill `description` 是否会在下次相似场景自动加载
- 执行层：skill body 是否有明确检查动作
- 验证层：是否需要治理脚本、测试、review checklist，或说明为什么暂不适用

如果是小而明确的机制改进，应该在同一任务里直接落实，而不是只提建议。

如果复盘结论涉及治理系统，必须联动：

- `nextclaw-agent-instructions-governance`

提交、收尾或本次改动可能需要进入 NPM/GitHub 用户发布说明时，必须联动：

- `nextclaw-release-notes-automation`

只有用户需要感知的产品变更才添加 `.changeset`；内部治理、测试、docs/logs 或纯工程文档不添加发布说明片段。

### 7. 迭代留痕决策

收尾阶段必须使用 `nextclaw-iteration-log-governance` 判断是否需要 `docs/logs`。

不要因为工作开始了就自动建 log。  
但只要代码、测试、脚本、运行链路配置或治理系统发生了实质变化，就要认真判断是更新最近相关迭代，还是新建一个版本更高的迭代目录。

### 7.5 本地 master 优先的主干交付

当最终目标是更新 `origin/master` 时，默认按以下顺序闭合：

1. `git fetch origin`，核对本地 `master` 与 `origin/master` 的真实 ahead / behind 和双方独有提交。
2. 将已验证改动先提交或合并到本地 `master`；隔离工作树只负责隔离开发，不直接替代本地主干成为远程主干的推送源。
3. 从本地 `master` 推送 `origin/master`，并在推送后核对两者 commit hash 与 ahead / behind 已符合预期。

本地 `master` 存在未提交改动、已经分叉或暂时无法安全集成时，默认把它视为主干交付阻塞点，不能用“从隔离工作树直接推远程”绕过。只有用户明确同意、PR / CI 是约定的主干集成 owner，或紧急发布等特殊情况才允许例外；例外必须披露原因，并在同一交付中完成或明确安排本地 `master` 回流同步。

### 8. 最终汇报合同

最终回复里，凡是适用的项都要主动覆盖：

- 结果
- 执行过的命令与结果
- 适用时的确切 `tsc` 命令
- 冒烟 / 验收场景
- 可维护性披露里的总代码与非测试代码增减
- 跳过了什么验证，以及为什么 `不适用`
- 复盘结果
- 是否顺手落地了治理 / workflow 改进
- 是否新增或更新了迭代记录

只要其中某个适用项被漏报，就不算真正完成收尾。

## 什么时候由本 skill 做主 owner

以下场景默认由本 skill 作为总流程 owner：

- 用户要求实现、修复、重构
- 用户要求规范开发流程、阶段化开发、方案到实现闭环
- 用户要求“完成”“提交”“收尾”“验证”“发布”“修复 bug”
- 任务横跨编码、验证、说明多个阶段
- 任务暴露出“容易忘步骤”或“规则分散难以闭环”的问题

## 反模式

以下都视为流程失败：

- 做完了实现，但可维护性披露要等用户追问才说
- 验证做了，但没告诉用户哪些项跳过了
- bugfix 收尾时，没有说清真实的观察指标和成功条件
- 发现治理缺口了，但没有做落点判断
- 内部已经知道行数门槛结果，却没有在最终回复主动披露
- 用了很多专项 skill，但没有一个总流程 owner 兜住收尾
- 把 `nextclaw-solution-design` 当成完整开发流程 owner，导致设计后没有实现、验证或收尾判断
