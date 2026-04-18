---
name: nextclaw-clean-implementation
description: Use when implementing or refactoring code in this repository, especially if a task could add fallback-heavy logic, duplicate branches, weak abstractions, unclear file placement, ad-hoc helpers, or patch-style fixes that would turn into garbage code.
---

# NextClaw Clean Implementation

## 概述

这个 skill 用来在写代码之前先拦住“垃圾代码”。

这里的“垃圾代码”不是指风格不好看，而是指：

- 用兜底、特判、双路径把问题糊过去
- 该有 owner 的业务逻辑没有 owner
- 该删除的旧路径没删，只是在外面再包一层
- 抽象、目录、命名、边界都说不清
- 明明能复用，却继续复制一份
- 代码虽然能跑，但复杂度、分支数、文件数和理解成本一起上涨

目标不是“先写出来再靠 review 收尸”，而是默认在动手前就把这些风险压下去。

## 何时使用

在本仓库里，只要要写或改下面这些内容，默认都该先用这个 skill：

- 源码
- 脚本
- 测试
- 会影响运行链路的配置

尤其当任务包含以下信号时，更应该先过这个 skill：

- 想加 fallback / compatibility / rescue path
- 准备新增 helper / util / adapter / wrapper
- 觉得“先这样 patch 一下”
- 目录落点或文件角色拿不准
- 业务逻辑开始散落到组件 / hook / effect / 多个函数里
- 准备复制一段相似实现再小改
- 改动不大，但会继续推高复杂度

## 写代码前固定要回答的问题

### 1. 这次真的是要新增代码吗

先回答：

- 这次是在新增用户能力，还是只是在修结构/修 bug/修链路
- 如果不是新增能力，什么旧代码可以直接删
- 能不能通过删路径、删分支、删中间层解决，而不是继续加逻辑

只要删得掉，默认先删，不要先加。

### 2. 这段逻辑的 owner 是谁

先回答：

- 这段逻辑是不是业务规则或业务编排
- 它的状态、上下文、生命周期由谁拥有
- 主流程现在是在一个清晰 owner 里，还是散落在函数 / hook / effect / action 中

如果答案说不清，先收敛 owner，再写增量逻辑。

默认倾向：

- 业务主干进 class owner
- 普通函数只保留给纯工具、纯计算、纯无状态辅助

### 3. 这是不是在制造隐藏路径

先回答：

- 这条 fallback 会不会掩盖真实缺陷
- 这是正式主路径，还是事故补丁
- 如果删掉这段 fallback，是否更应该修上游合同或边界映射

只要工作涉及 fallback、兼容、环境探测、just-in-case 逻辑，立即联动 `predictable-behavior-first`。

### 4. 这是单一路径还是多路径继续膨胀

先回答：

- 当前实现能否收敛成一条显式主路径
- 是不是只因为“稳妥”就在保留旧实现
- 新旧两条路是否真的都还有长期价值

不要把“暂时先留着”当默认答案。

### 5. 这段代码真的该放在这里吗

先回答：

- 当前目录是不是正确的 feature root / 角色目录
- 文件主职责是什么
- 有没有现成位置可以直接复用，而不是新增散点

目录结构不清时联动 `collapsible-feature-root-architecture`。  
角色和命名不清时联动 `role-first-file-organization` 与 `file-naming-convention`。

### 6. 这是不是重复实现

先回答：

- 仓库里是否已经有可复用的 class / helper / component / primitive
- 如果不能直接复用，是否应该抽一个稳定共享核心
- 现在的实现是不是只比旧实现改了 10%，却复制了 90%

默认优先级：

- 直接复用
- 抽稳定共享核心
- 最后才是新增平行实现

### 7. 这是不是 effect / helper / util 越界

先回答：

- `useEffect` 是在同步外部系统，还是在偷偷做业务编排
- 普通函数有没有原地改入参
- helper / utils 里是不是偷偷长出了状态、缓存、重试、流程控制

如果有，先把逻辑收回 owner 层。

### 8. 最小可信验证是什么

先回答：

- 这个改动最贴近真实风险的验证路径是什么
- 如果这是 bugfix，怎么证明它真的解决了原问题
- 如果做不到真实链路验证，最小替代验证是什么

不要把“代码改了 + lint 绿了”当完成。

## 垃圾代码高频形态

以下模式默认都应视为危险信号：

- `if/else` 越补越多，但没人能说清主路径
- 为了通过当前 case，增加事故特判或日志关键字分支
- 业务逻辑散在组件、hook、effect 和 helper 之间，没有 owner
- 为了“先快一点”复制一份旧实现
- 为了一个新领域词发明一个新目录或新角色
- 用 `utils`、`helpers`、`common` 掩盖真实业务职责
- 非测试改动净增很多，但解释不了为什么删不掉
- 目录已经很平，但继续往里扔文件

## 决策顺序

在这个仓库里，默认按这个顺序做设计决策：

1. 先删减
2. 再简化
3. 再收敛 owner 和边界
4. 再决定目录落点和命名
5. 最后才是新增实现

如果当前方案跳过了前四步，直接来到“加一个新东西”，大概率就是风险信号。

## 需要联动的 skill

- fallback / compatibility / rescue path：`predictable-behavior-first`
- 目录结构 / 文件落点：`collapsible-feature-root-architecture`
- 文件角色 / 假目录 / barrel：`role-first-file-organization`
- 文件命名：`file-naming-convention`
- 复杂 debug：`long-chain-debugging`
- 复杂任务过程笔记：`iteration-work-notes`
- 改后主观可维护性复核：`post-edit-maintainability-review`

## 输出要求

使用这个 skill 时，在真正开始写代码前，至少先写清：

1. 这次准备删什么 / 不删的原因是什么
2. 这段逻辑的 owner 是谁
3. 主路径是什么，为什么不是双路径
4. 为什么这不是隐藏 fallback 或补丁式修复
5. 文件为什么放在这里
6. 最小可信验证是什么

如果这 6 个问题里有 2 个以上答不清，先不要写代码。

## 完成标准

只有同时满足以下条件，才算这次没有写出垃圾代码：

1. 旧路径、重复路径或无意义中间层已经优先评估过能否删除
2. 业务主逻辑有清晰 owner，而不是散落拼接
3. 没有为了“稳妥”保留无退出条件的 fallback / 双路径
4. 目录、文件角色与命名都能自解释
5. 改动后的复杂度增长已被压到最小
6. 验证方式能证明真实风险被覆盖
