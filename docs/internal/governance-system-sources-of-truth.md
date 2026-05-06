# 项目规范系统的构成与真相源

日期：2026-05-06

## 这份文档解决什么问题

本项目里“规范”不是只指一份文档，也不是只指 `AGENTS.md`。

如果只改文字规则，不改对应脚本、命令入口、baseline 或测试，那么规范系统仍然是不完整的，后续执行时就会继续按旧规则工作。

因此，这份文档的目标是明确：

1. 本项目的“规范系统”到底包含哪些部分
2. 各部分分别解决什么问题
3. 当我们说“调整规范”时，哪些面必须一起检查

## 一句话定义

本项目的规范系统，是一套由**常驻规则、场景规则、命令入口、人类参考文档、可执行治理脚本、基线数据与脚本测试**共同组成的治理体系。

换句话说：

- 文档定义语义
- skill 定义触发与执行流程
- 命令定义协作入口
- 脚本定义可执行约束
- baseline / test 定义可回归验证

少了其中任意一层，这套规范都可能只剩“写下来”，而不能稳定执行。

## 规范系统包含哪些部分

### 1. `AGENTS.md`

角色：

- 常驻内核
- 每轮都必须知道的高优先级规则

适合承载：

- 沟通硬规则
- Git 安全
- 验证常驻原则
- 规则与 skill 的分层机制

不适合承载：

- 大段场景流程
- 只在特定任务需要的检查清单
- 长篇示例和反例

### 2. `.agents/skills/*/SKILL.md`

角色：

- 场景规则 owner
- 可触发的执行流程 owner

适合承载：

- `/config-meta`、`/validate`、目录治理、命名治理等场景化规则
- 某类任务开始前要读什么、结束后要验证什么
- 规则具体如何执行

关键点：

- skill 不只是说明文档，它承担的是“让 AI 在正确时机自动读取并执行”的责任

### 3. `commands/commands.md`

角色：

- 项目级元指令入口协议

适合承载：

- `/config-meta`
- `/check-meta`
- `/validate`
- `/maintainability-review`

关键点：

- 它定义的是“用户如何触发治理动作”
- 它不替代 skill 内部流程

### 4. `docs/*`

角色：

- 人类参考文档
- 长期背景、设计、解释和真相源地图

适合承载：

- 设计文档
- 规范说明文档
- 内部治理说明
- RFC / ADR / retrospective

关键点：

- 普通 docs 默认不是自动执行规则
- 只有当 `AGENTS.md` 或 skill 明确要求读取时，某份 docs 才会成为执行期 authoritative reference

### 5. `scripts/governance/*`

角色：

- 可执行治理约束 owner
- 把一部分规范从“文字要求”变成“可跑的检查”

典型内容：

- `lint-new-code-governance.mjs`
- `check-governance-backlog-ratchet.mjs`
- 文件命名、目录命名、角色边界、平铺目录、module structure 等检查
- 对应 shared helper、report、baseline、rule test

关键点：

- 这些脚本不是附属品，而是规范系统的一部分
- 如果规范变化已经影响“应该如何被检查”，就不能只改文档，必须同步改脚本

### 6. baseline / snapshot / 测试

角色：

- 规范脚本的回归保护层

典型内容：

- `scripts/governance/governance-backlog-baseline.json`
- `scripts/governance/*.test.mjs`
- 规则脚本依赖的 shared contract / fixture

关键点：

- 当规范变化影响可执行结果时，只改脚本本体仍然不够
- 对应的 baseline、测试、fixture 也要一起审视

## 真相源如何分层

可以把规范系统理解为下面这几层：

```text
产品方向与高层原则
  -> AGENTS.md
  -> skill workflows
  -> commands/commands.md
  -> docs/internal or docs/designs references
  -> scripts/governance executable checks
  -> baseline/tests regression guard
```

各层职责不同：

- 上层负责定义“为什么”
- 中层负责定义“什么时候触发、怎么做”
- 下层负责定义“怎么被持续检查”

## 当我们说“调整规范”时，默认要检查哪些面

以后只要出现下面这些请求：

- “优化规范”
- “修正规范”
- “把这个规则明确一下”
- “这个治理要不要调整”
- “这个目录组织/命名规范应该怎么改”

默认都要检查以下问题：

1. 这条规则属于 `AGENTS.md`、skill、命令、普通 docs 中的哪一层 owner
2. 有没有对应的可执行脚本已经在落实这条规则
3. 如果有，对应脚本是否需要同步修改
4. 如果脚本行为会变，对应测试或 baseline 是否也要同步更新
5. 是否存在一个命令入口或验证入口需要同步更新说明

也就是说：

**“改规范”默认不是只改文档，而是先判断整个规范系统里哪些层受影响。**

## 什么时候必须同步改脚本

只要满足以下任一情况，就不能只改文档：

1. 规范本身已经被 `scripts/governance/*` 实际检查
2. 用户希望未来自动阻断、自动提醒或自动报告该问题
3. 规则变化会导致 `lint:new-code:governance`、`check:governance-backlog-ratchet`、maintainability guard、module structure 检查的结果变化
4. 当前文字规则与脚本行为已经不一致

例如：

- 修改文件角色边界规则
- 修改目录白名单或禁止目录
- 修改命名规范
- 修改目录预算、红区、ratchet 基线语义

这些都不应停留在文档层。

## 什么时候可以只改文档或 skill

以下场景通常可以不改脚本，但必须明确说明原因：

- 只是补充解释、术语澄清、例子优化
- 新增的是人工判断流程，还没有进入自动化检查范围
- 只是调整某个命令或 skill 的协作口径，不影响脚本检查语义
- 只是新增一份参考设计文档，不改变现有治理行为

关键不是“有没有动文档”，而是：

**这次变更有没有改变规范系统的实际执行语义。**

## `/config-meta` 的默认理解

以后执行 `/config-meta` 或任何等价的“改元规范”请求时，默认要把“规范系统”理解为至少包含：

- `AGENTS.md`
- `.agents/skills/*/SKILL.md`
- `commands/commands.md`
- 相关 `docs/*`
- `scripts/governance/*`
- 相关 baseline / test / fixture

如果最终只改了其中一部分，必须说明为什么其他部分不适用。

## 对 AI 的执行要求

对于 AI 来说，这份文档的最重要约束只有一句：

**凡是调整项目规范，不得默认理解为“只改文档”；必须检查是否还应同步修改 skill、命令、脚本、baseline 与测试。**

## 当前推荐做法

为了避免以后再漏改，推荐采用下面这个最小检查顺序：

1. 先判断规则 owner 在哪一层
2. 再搜索是否已有对应治理脚本
3. 再判断是否存在 baseline / test / fixture 需要同步
4. 最后再决定只改文档，还是同时改脚本与入口说明

这样做的目的不是增加流程，而是避免“文字上已经改了，系统实际还在按旧规则跑”的漂移。
