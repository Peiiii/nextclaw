# 实现工艺

只用于“保留、拆分还是抽象”的明确裁决。项目架构和目录规则仍由各自 owner 负责。

## 永久原则

- `visible-main-flow`：真实业务流程直接可见，不用大量小函数制造虚假分层。
- `boundary-only-defense`：解析、归一化、兼容和异常捕获只放在真实边界；脱离调用栈的异步任务由一个 owner 级错误归口承接。
- `no-alias-ladders`：旧字段只在迁移边界归一化一次并写清删除条件，内部只读规范字段。
- `types-tell-truth`：类型表达事实，不用断言把未知结构伪装成确定合同。
- `semantic-names`：名字简洁、无歧义，并能暴露主要职责。
- `defaults-have-owners`：默认策略由真实 owner 显式拥有；reader/parser/getter/helper 不偷偷补策略。
- `single-fact-owner`：不以双写、重复缓存或平行链路表达同一事实。
- `simplest-shape-first`：先用最少概念、owner 和文件表达主流程；真实重复、不变量、生命周期或稳定变化点出现后再抽象。
- `abstractions-pay-rent`：新抽象必须减少真实复杂度、表达稳定语义或隔离变化点，并覆盖新增名字、文件、跳转和参数合同的成本。
- `split-pays-for-itself`：拆分应提高主流程可见性、隔离变化、消除重复、保护不变量或形成真实复用；若只是把 A 搬到 B 并增加 props/handler 转发和阅读跳转，就保持内聚。
- `split-by-change-reason`：按独立变化原因、生命周期、不变量和复用边界拆分，不按行数、JSX 数量、目录对称或理论洁癖拆分。
- `stable-object-shape`：对象构造直接展示合同；字段可显式为 `undefined/null`，不以条件 spread 隐藏形状变化。
- `prefer-const`：派生值用 `const`；只有真实流程状态需要重赋值时使用 `let`。
- `readability-over-metrics`：不以压行、转移复杂度或无意义搬运换取行数和检查指标。

## 裁决输出

指出当前复杂度来源，并明确：保留什么、删除什么、由谁负责、是否拆分/抽象，以及收益为何大于成本。没有足够收益时，选择更内聚、更直接的实现。
