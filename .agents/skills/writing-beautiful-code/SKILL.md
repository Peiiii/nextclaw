---
name: writing-beautiful-code
description: 当讨论、审查或重构代码审美、代码是否干净、是否丑、是否优雅、是否过度防卫、是否过度抽象、是否像补丁堆叠，或用户明确要求提升代码审美、写出美丽代码时使用。
---

# Writing Beautiful Code

## 规则列表

- `universal-only`：只沉淀任何项目都适用的通用代码审美原则；项目、框架、目录、工具链、命名体系或业务架构专属规则不进入这里。
- `less-but-sharp`：规则宁缺毋滥，必须简练，但要明确到能指导下一次判断。
- `named-list-rules`：规则用 Markdown 列表维护；每条规则必须有稳定英文 slug，不使用编号。
- `visible-main-flow`：美丽代码让真实业务流程直接可见，不靠一串小私有函数制造“做了很多事”的假象。
- `boundary-only-defense`：防御、兼容、解析和归一化只放在真实边界；内部协作者之间依赖明确 contract。
- `catch-at-real-boundaries`：只在真实错误边界捕获异常，例如请求入口、后台任务调度器、事件 listener 调用者或进程边界；不要给每个内部函数调用都补 `try/catch` 或 `.catch(...)`。脱离调用栈的异步任务也应由一个 owner 级错误归口承接，而不是在业务流程中散落 catch。
- `no-alias-ladders`：不要为一个新 contract 同时读取多套历史字段名、别名或猜测路径。兼容旧输入时，只能在真实迁移/适配边界做一次显式归一化，并写清删除条件；内部业务代码只读规范字段。
- `types-tell-truth`：类型应该表达事实，不用 `as` 把未知结构伪装成确定合同。
- `defaults-have-owners`：默认值必须属于拥有该策略的 owner，并在主流程或策略 owner 里显式出现。
  Reader、parser、getter、helper 只能读取事实，不能把缺失值偷偷改成默认策略。
- `single-fact-owner`：一个事实只应有一个清晰 owner；不要用双写状态、重复缓存或多条并行链路表达同一件事。
- `abstractions-pay-rent`：抽象只有在减少真实复杂度、表达稳定语义或隔离真实变化点时才成立。
- `stable-object-shape`：对象构造应直接呈现合同形状；不要用条件 spread 拼可选字段来隐藏对象形态变化。
  - 常规业务对象优先显式赋值为 `undefined` / `null` 或先建清晰局部值。
  - 字段值本身可以用清晰的三元表达式表达 `undefined` / `null`；问题是条件 spread 让对象形态变化藏进展开语法里。
- `prefer-const`：优先用 `const` 表达派生值；只有真实需要重新赋值的流程状态才用 `let`。若 `let` 只是为了跨分支拼结果，优先考虑用清晰表达式或有稳定语义的 helper 返回值。

## 使用方式

- 讨论代码时先指出“丑”的结构性来源，而不是只挑语法细节。
- 输出结论时给出明确取舍：保留什么、删除什么、归谁负责，以及为什么这样更美。
