# 架构设计原则

用以下原则裁决 owner、状态、生命周期和抽象力度，只展开与当前决策直接相关的项：

- `information-expert`：职责归拥有所需事实和不变量的对象。
- `single-complete-owner`：同一事实、状态变化和生命周期只有一个权威且完整的 owner；owner 覆盖创建、状态、不变量、生命周期和对外语义。
- `minimal-responsibility-surface`：上层只提供 owner 无法自知的外部事实、用户选择或真实策略点。
- `high-cohesion-low-coupling`：一起变化且必须同步的状态放在一起；调用方不依赖内部细节。
- `tell-dont-ask`：调用业务意图，不读散字段后在 owner 外拼流程。
- `simple-structure-first`：对象、数组、局部函数或现有 owner 足够时，不升级为新 service、manager 或 context。
- `abstractions-pay-rent`：抽象必须消除真实重复、保护不变量或隔离稳定变化点，收益大于名字、文件、跳转和合同成本。
- `evidence-before-generality`：先服务已确认的用户路径和当前调用者；动态发现、多实现路由、registry/resolver/provider 层、namespace、分页、通用 DSL、capability 或扩展槽不能只凭未来可能性进入首版合同。第二个消费者、既有重复 owner、明确排期或昂贵持久迁移属于当前证据；没有证据时，需求出现后再增加通常更便宜。
- `balanced-complexity`：同时审计过小端的错误边界、重复生命周期和迁移债，以及过大端的无消费者抽象、状态和验证面；按全生命周期净复杂度选平衡点，不把最小改动或最大扩展性当目标。
- `constructor-builds-graph`：constructor 只建立同步确定的长期对象图；load/start/reload/stop/dispose 承担副作用。
- `cqs-pure-read`：read/get/list/status 不暗中改变状态；mutation 表达业务意图。
- `equivalence-by-construction`：当多个入口、宿主、实现或持久状态被要求语义等价时，让它们收敛到同一权威 owner、规范表示和状态迁移，并使旧实现与平行路径从正常链路中不可达；禁止靠消费者逐点补丁、复制规则或穷举黑盒场景拼装等价。测试只证明该机制及其不变量未被破坏，不负责用样例数量制造等价性。
- `no-compatibility-by-default`：内部重构直接迁移并删除旧入口；临时兼容必须有外部必要性、边界和删除点。
- `deletion-first`：新增前先删除重复入口、平行 owner、无语义 wrapper 和过期兼容；不为行数指标损害可读性和合同安全。

判断顺序：先写最小完整路径、事实、不变量、生命周期与已知变化轴；找到 information expert；要求跨入口等价时收敛到同一 owner；列出过小端与过大端成本；删除重复 owner 和透传层；逐个审计新增名词的当前证据与全生命周期净收益；冻结保留、删除、延后项。

输出命中的原则、违反点、推荐 owner、删除与延后项、生命周期边界，以及过小端、平衡点、过大端的关键代价。不能用“可扩展”或“最小改动”单独证明方案正确。
