# v0.16.61 工作笔记

## 当前目标

- 为复杂任务与复杂 debug 增加一个可持续维护的 `work/` 工作目录机制。
- 让“过程笔记”成为项目内的显式载体，而不是继续只留在聊天上下文里。
- 为“避免写出垃圾代码”补一个实现前就会触发的项目私有 skill。

## 当前事实

- 本轮属于 `v0.16.61-long-chain-debugging-and-skill-first-automation` 的同批次续改，不新建新的迭代目录。
- 当前仓库已经有：
  - `long-chain-debugging` skill
  - `script / skill / script + skill` 载体评估规则
- 以及：
  - `iteration-work-notes` skill
  - `work/working-notes.md` 工作目录机制
- 用户本轮新增诉求是：不要只靠 Rulebook 零散条目，而要补一个能在写实现前主动提醒 AI 避免垃圾代码的 skill。

## 关键约束 / 不变量

- 不要仅为了记笔记而提前新建新的迭代目录。
- 如果对应迭代目录已存在，可以直接在其下创建 `work/`。
- `work/` 是过程笔记区，不替代最终迭代 `README.md`。
- 这轮仍然不要把机制引向新的指令体系。

## 证据 / 观察点

- 当前 `AGENTS.md` 已有复杂任务主方案文档规则，但原先缺少“复杂任务进行中如何保留动态上下文”的明确机制。
- 当前 `docs/logs` 制度原先允许可选文档，但尚未把 `work/` 工作目录显式命名为推荐结构。
- `long-chain-debugging` 原先已经要求结构化排查，但还没有和过程笔记目录形成联动。
- 当前仓库已经有很多相关规则和 skill，但“写实现前的总入口”仍不够显式：
  - 相关思想散在 Rulebook、`predictable-behavior-first`、目录治理、命名治理和 maintainability review 中
  - AI 即使最终会被 lint / review 纠正，也不一定会在动手前主动把这些约束组合起来
- 本轮已补齐：
  - `AGENTS.md` 迭代制度中的 `work/` 目录规则
  - `complex-work-needs-staged-plan-docs` 对 `work/working-notes.md` 的接入
  - 新 skill `iteration-work-notes`
  - 当前迭代 `README.md` 对工作笔记的显式链接

## 活跃假设

- 已收敛并验证的方案是：
  - 在迭代制度里显式允许并规范 `work/`
  - 在复杂任务规则里明确何时该开
  - 新增一个专门的工作笔记 skill
  - 在当前迭代里直接示范一次
- 当前活跃判断：
  - “避免垃圾代码”最合适的承载方式是一个新的前置 coding skill
  - Rulebook 只需要一条很薄的 project rule 把这个 skill 接进来

## 已排除项

- 不新增新的迭代目录
- 不把这次诉求继续混回“长链路 debug skill 本体就是全部机制”
- 不把 `work/` 设计成新的正式文档体系
- 不把 `work/` 做成原始日志堆放目录
- 不把“避免垃圾代码”的全部细节继续堆回 Rulebook
- 不把它做成一个纯 review 后置 skill

## 关键决策

- 新增 skill 名称定为 `iteration-work-notes`
- 默认文件落点定为 `docs/logs/<iteration>/work/working-notes.md`
- 只有内容明显分叉或膨胀时才拆更多 `work/*.md`
- 当前迭代 `README.md` 必须显式链接 `work/working-notes.md`
- `long-chain-debugging` 需要显式知道这条机制存在，并在长时间排查时建议配合使用
- 新增代码质量前置 skill 名称定为 `nextclaw-clean-implementation`
- 通过一条很薄的 `Project Rulebook` 规则 `nextclaw-clean-implementation-required` 自动接入

## 下一步

- 当前改动已完成。
- 若后续继续扩展这套机制，优先观察：
  - 工作笔记是否真的帮助跨轮接手
  - `working-notes.md` 是否足够轻，不会迅速长成重模板
  - 是否出现新的稳定拆分模式，再决定是否补更多示例
  - `nextclaw-clean-implementation` 是否真的能把垃圾代码风险前移，而不是仍然主要靠收尾 review 才暴露

## 剩余缺口 / 交接提醒

- 当前没有阻塞性缺口。
- 后续若有人继续迭代这套机制，优先保持“默认一个 `working-notes.md`”的轻量路径，不要很快长成一整套重模板。
