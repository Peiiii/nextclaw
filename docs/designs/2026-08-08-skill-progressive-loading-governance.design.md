# Skill 渐进式加载治理设计

## 背景

NextClaw 使用 `AGENTS.md + skill description + SKILL.md + references/scripts` 组织 AI 规则，目标本应是按场景渐进加载。当前实现已经出现反向膨胀：`AGENTS.md` 重复维护 skill 索引和专项原则，高频任务同时命中多个 workflow owner，skill 正文继续要求加载其它 skill，并形成回链。

2026-08-08 审计基线：

- 项目内有 56 个 skill，`SKILL.md` 合计约 466 KB、29 万字符。
- 56 条 description 合计约 9610 字符；这些元数据会在技能目录中提前暴露。
- `AGENTS.md` 约 31 KB、16119 字符。
- 普通源码修改按硬路由会命中 delivery、clean implementation、beautiful code、validation、maintainability guard；连同 `AGENTS.md` 约有 2.76 万字符的高频规则输入。
- 静态名称引用图包含 127 条 skill 间引用和 4 个循环组件；从 delivery 或 solution design 出发最多可静态到达 25 个 skill。静态可达不等于实际全部读取，但说明依赖模型已从树退化为网。

## 核心判断

问题不在于 skill 数量本身，而在于四类结构错误：

1. **多个流程 owner**：delivery、solution、clean implementation、frontend optimization、campaign skill 都在重新编排调查、实现、验证和收尾。
2. **触发面重叠**：`写代码`、`重构`、`方案`、`owner`、`深入分析` 等泛词同时命中多项原则 skill。
3. **引用图有回路**：workflow 与专项 skill 互相要求读取，阶段路由变成级联加载。
4. **入口承载条件细节**：某个平台、发布类型、目录层级或异常分支的长合同直接放在 `SKILL.md`，导致一次命中读取全部子场景。

本轮不以“删除最多 skill”为目标，而以减少高频上下文、建立唯一 owner 和保留可达安全合同为目标。

## 推荐架构

规则系统分为四层：

```text
AGENTS 常驻内核
  -> 一个意图入口 SKILL.md
    -> 当前分支需要的一个 reference 或专项 skill
      -> 确定性 script / command
```

### AGENTS 常驻内核

只保留每轮都必须知道的产品方向、沟通、Git 安全、规则分层和少量硬约束。不再维护完整 skill 分类索引，不再重复实现 delivery、implementation、validation 和 file organization 的详细清单。

### SKILL.md 入口

只保留：

- 单一职责和明确触发条件；
- 每次命中都需要的最小决策树；
- 当前场景应该读取哪个 reference 或专项 skill；
- 完成条件和关键禁止项。

如果某段内容每次命中都必须使用，就留在入口，不为了形式拆分。只有子场景条件成立才需要的内容才进入 reference。

### References

承载平台、模式、协议、目录层级、故障恢复、发布渠道、长示例和详细检查表。每个链接必须写明加载条件，禁止入口要求一次读取整个 references 目录。

### Scripts

承载可以确定性验证的事实：frontmatter、唯一名称、引用存在性、循环依赖、入口大小、description 大小和治理基线。脚本先输出可复核报告，再对高置信结构错误设硬门槛。

## Owner 与路由

- 普通开发唯一默认 owner：`nextclaw-delivery-workflow`。
- 方案设计只在设计阶段由 `nextclaw-solution-design` 承担，不回链 delivery。
- 调查方法由 `code-investigation-workflow` 承担，但只产出证据，不枚举并加载所有可能专项 skill。
- 验证在实现稳定后由 `nextclaw-validation-workflow` 承担，不在任务开始时预读。
- 自动可维护性检查由 `post-edit-maintainability-guard` 承担；主观复核成为它的条件 reference，不再是独立 skill。
- 文件组织由 `file-organization-governance` 统一承接；命名、角色、feature root 和概况扫描成为条件 references。
- Marketplace skill 的评估、集成和发布由一个 lifecycle skill 承接。
- Desktop release 统一承接 unsigned handoff，不保留平行 playbook。

禁止 workflow 回链上游 owner。一个决策分支最多要求加载一个直接下游；后续阶段可以加载新的 owner，但不能在任务开始时预读未来阶段。

## 删除与合并映射

### 直接删除

- `project-os`：为其它新项目初始化旧治理模板，NextClaw 内无 owner 引用，并包含与风险分级验证冲突的旧合同。
- `proactive-work-continuation`：有效规则已经属于 AGENTS 的常驻协作边界，没有独立运行时产物或专项流程。

### 合并后删除独立入口

- `nextclaw-clean-implementation` -> delivery 的实现前检查。
- `post-edit-maintainability-review` -> guard 的 `references/subjective-review.md`。
- `contract-driven-delivery-campaign` -> delivery + goal mode + iteration work notes。
- `goal-progress-anchor` -> goal mode 的 `references/progress-anchor.md`。
- `unsigned-desktop-release-playbook` -> desktop release 的 `references/unsigned-handoff.md`。
- `file-naming-convention` -> file organization 的 `references/naming.md`。
- `role-first-file-organization` -> file organization 的 `references/file-roles.md`。
- `collapsible-feature-root-architecture` -> file organization 的 `references/feature-root.md`。
- `directory-structure-governance-overview` -> file organization 的 `references/overview.md`。
- `marketplace-skill-publisher` -> marketplace integration 的 `references/publishing.md`。

目标 skill 数量由 56 降到约 44；数量只是迁移结果，不是单独 KPI。

## 入口简化与条件拆分

优先改写高频入口：

- delivery、solution design、code investigation；
- writing beautiful code、classic principles、kernel owner architecture；
- frontend optimization、validation；
- agent instructions governance、learning from failures。

优先拆分分支明显且正文过长的专项 skill：

- desktop release：公共合同、beta/stable、跨平台/签名、unsigned handoff、故障恢复；
- npm release：包发布、runtime channel、beta 验收、分支回流；
- release notes：提交判断、版本笔记、结构化 JSON、配图/X；
- file organization：命名、角色、feature root、概况扫描；
- marketplace integration：评估集成、发布；
- goal mode：进度锚点。

窄而明确、没有平行 owner 的叶子 skill 保留；如果正文内容在每次触发时都必需，不机械拆分。

## AGENTS 收敛

- 删除重复的完整“规范 Skill 索引”，改为少量意图 owner 路由。
- 标准开发流程只保留“默认进入 delivery”这一事实，详细阶段由 delivery 拥有。
- 实现常驻原则只保留跨所有任务的硬边界；owner、抽象、文件、React 等细节回到相应 skill。
- 验证、留痕和命令只保留不可绕过的高层安全边界。
- 目标大小约 15 KB；不以强行压字为代价删除 Git 安全、用户改动保护和技术正确性底线。

## 自动检查

新增通用 skill 渐进加载检查，覆盖：

- 所有 `SKILL.md` frontmatter 和 name 唯一性；
- Markdown 相对引用存在；
- 已删除 skill 不再被 AGENTS、commands 或其它 skill 引用；
- skill-to-skill Markdown 依赖无循环；
- `AGENTS.md`、description 和入口正文大小预算；
- 输出总 skill 数、总入口体积、description 体积、超预算项和依赖边。

检查必须基于结构事实，不判断自然语言语义相似度，避免高误报。

## 实现顺序

1. 写入本设计并冻结迁移映射。
2. 收敛 AGENTS 和 delivery 默认路由。
3. 删除确定废弃项，合并高频重复 owner。
4. 合并文件组织、goal、desktop、marketplace 域。
5. 对分支明显的超长入口建立条件 references。
6. 更新 commands、迭代治理和所有旧名称引用。
7. 新增并运行 skill 结构检查，再运行治理 ratchet 和 Markdown/diff 检查。

## 验收标准

- 普通源码修改开始时只需要读取 delivery，不自动加载 clean、beautiful code、validation 或 guard。
- 所有 workflow/skill Markdown 依赖无循环。
- 被删除 skill 名称在有效规则面零残留；历史日志和本设计中的迁移记录除外。
- skill 数量约 44，description 总字符显著下降。
- `AGENTS.md` 约 15 KB，高频规则不再与专项 skill 重复。
- 分支型大 skill 的入口只保留决策树，详细子场景从明确 reference 按需加载。
- 设计、规则、命令和自动检查一致；Markdown 链接、frontmatter、governance ratchet 全部通过。

## 非目标

- 不删除窄而明确的产品、发布、集成、调试和工具叶子能力。
- 不修改产品源码、运行时、UI、协议或发布产物。
- 不为统计好看把每个 skill 都拆成多个必读文件。
- 不触碰工作区中其它会话正在进行的产品改动。

## 实施结果

2026-08-08 已按本设计完成迁移：

- skill 入口由 56 个收敛为 44 个；全部 `SKILL.md` 由约 466 KB 降至约 211 KB。
- 包括 references 在内的全部 skill Markdown 由 489907 字节降至 284775 字节（-41.9%）；原 705 行 feature-root 入口不是原样藏入 reference，而是重写为 108 行分支合同。
- description 总字符由 9610 降至 6035；`AGENTS.md` 由约 31 KB 降至 8814 字节。
- 静态名称依赖边为 45 条，循环组件由 4 个降为 0。
- 删除入口对应的有效合同已合并到现有 owner 或条件 references；历史日志与本设计保留迁移名称，不属于运行期规则面。
- `pnpm check:skill-progressive-loading` 已建立 16 KB `AGENTS.md`、12 KB 单入口、240 KB 总入口、260 字符单 description 和 7500 字符 description 总量预算，并检查 frontmatter、唯一名称、相对链接、退役引用与循环依赖。
- 该检查只由 `/check-meta` 和元规则治理触发，不加入普通源码任务的 maintainability guard。

## 第二阶段：流程、工艺与场景分层

第一阶段解决了默认全家桶和循环依赖，但进一步审计发现：44 个入口中仍有一批内容虽然触发面已收窄，本质上仍只是标准开发流程某个阶段的方法或规范，不需要继续占用独立 skill description。

项目 skill 统一分成四类：

1. **标准流程 owner**：普通开发只保留 `nextclaw-delivery-workflow` 一个总 owner。
2. **复杂阶段 owner**：调查、方案、验证、guard 分别由 `code-investigation-workflow`、`nextclaw-solution-design`、`nextclaw-validation-workflow`、`post-edit-maintainability-guard` 承担；它们只在进入对应阶段时加载。
3. **场景流程 owner**：发布、Linear、marketplace、长期治理、内容生产等有独立用户意图和完整闭环的流程保留独立 skill。
4. **工艺/场景规范**：通用架构原则、代码审美、Kernel owner、长链路 Debug 方法、具体运行验证方法等不再作为平行流程入口，而是归所属阶段的条件 reference。

判断标准：能独立回答“用户要完成哪个完整任务”的内容才是 skill；只回答“当前阶段该怎样判断或验证”的内容默认是 reference。

### 第二阶段合并映射

- `long-chain-debugging`、`layered-root-cause-analysis` -> `code-investigation-workflow/references/`。
- `classic-software-design-principles`、`kernel-branch-owner-architecture` -> `nextclaw-solution-design/references/`。
- `writing-beautiful-code` -> `nextclaw-delivery-workflow/references/implementation-craft.md`；`code-review` 继续拥有 findings-first 的审查合同，不反向依赖上游 workflow。
- `local-source-runtime-validation`、`testing-local-extension-development-source`、`smoke-testing-ncp-chat` -> `nextclaw-validation-workflow/references/`。
- `npm-beta-release`、`isolated-npm-release-worktree` -> `npm-release-contract-guard/references/`，NPM 发布只保留一个 owner。

目标项目 skill 数由 44 降至 34。合并后的 reference 保留原有确定性命令、关键合同和输出要求，但移除重复触发说明、上游流程复述和互相联动段落。

### 入口简洁度

- `SKILL.md` 只保留触发边界、最小决策树、永久合同和完成条件。
- 示例、平台矩阵、命令全集和异常恢复细节只在存在独立子场景时进入 reference。
- 单个 `SKILL.md` 硬预算由 12 KB 收紧为 8 KB；超过预算必须重写或证明所有内容每次触发都必需。
- 不为了通过预算把每次必读正文机械搬入必读 reference；总 skill Markdown 仍需持续下降或保持有依据的稳定增长。

### 第二阶段实施结果

实际入口由 44 个收敛为 33 个：原计划的 10 个阶段方法全部转为条件 reference；复核剩余目录时又确认 `node-pnpm-locator` 只是默认开发流程的 PATH 故障恢复分支，因此一并归入 `nextclaw-delivery-workflow`。

当前 33 个入口的具体分层：

| 类型 | 当前入口 |
|---|---|
| 唯一标准流程 | `nextclaw-delivery-workflow` |
| 复杂阶段 owner | `code-investigation-workflow`、`nextclaw-solution-design`、`nextclaw-validation-workflow`、`post-edit-maintainability-guard`、`code-review` |
| 复杂场景规范 | `predictable-behavior-first`、`mvp-view-logic-decoupling`、`react-rendering-lifecycle-safety`、`frontend-interaction-quality`、`frontend-style-encapsulation`、`user-facing-content-boundary` |
| 完整场景流程 | `autonomous-maintainability-campaign`、`delivering-delegated-linear-issues`、`desktop-release-contract-guard`、`file-organization-governance`、`frontend-code-optimization`、`goal-mode`、`integrating-http-agent-runtime`、`integrating-narp-stdio-runtime`、`iteration-work-notes`、`learning-from-failures`、`nextclaw-agent-instructions-governance`、`nextclaw-dead-code-governance`、`nextclaw-iteration-log-governance`、`nextclaw-marketplace-skill-integration`、`nextclaw-release-notes-automation`、`npm-release-contract-guard`、`product-blog-storytelling`、`project-knowledge-governance`、`refresh-product-visual-assets`、`replicating-reference-skins`、`x-twitter-bird` |

复杂场景规范保留 skill 的条件是：真实触达面可独立判断，且一旦命中，入口中的合同整体适用；只在某个子分支才需要的方法仍下沉 reference。通用工艺如架构原则、实现审美不占入口；NextClaw 场景细节如 Kernel owner、本地源码实例、NCP chat、beta/worktree 和 Node/pnpm PATH 恢复也归所属阶段/流程 reference。

最终指标：

- `SKILL.md` 总量 122098 字节，较第一阶段 210699 字节再下降 42.1%，较治理前约 466 KB 下降约 73.8%。
- description 总字符 3830，较第一阶段 6035 再下降 36.5%。
- 全部 skill Markdown 217539 字节，低于第一阶段 284775 字节；10 个迁移合同与 1 个环境恢复合同都经过删重，未把旧入口原样隐藏。
- 最大入口 7459 字节；全部入口低于 8 KB。
- 静态 skill 依赖图保持 0 个循环。

治理预算同步收紧为：`AGENTS.md` 12 KB、单入口 8 KB、入口总量 160 KB、入口数 36、单 description 260 字符、description 总量 6000 字符。reference 禁止声明 skill frontmatter，避免移动后的正文继续被发现为隐形入口；11 个退役名称进入活动规则面检查，防止旧入口复活。
