---
name: development-review
description: 通用开发的 Review 方法 owner；mode=design 审查实现前方案与验收设计，mode=implementation 审查已验证产物；返回 findings 和返工目标，不修改产物或执行发布。
---

# Development Review

## 目标

先明确 mode=design 或 implementation，不因尚无代码跳过方案审查。两个 mode 都按证据输出 findings，由总流程决定下一步。

## 方案 Review（mode=design）

检查目标覆盖、现有能力复用证据、owner/主链路唯一性、重要反例、失败边界、可行性，以及验收是否会放过不完整结果；缺证据即 finding，方案自洽不等于成立。
对照设计中的交付与验收方式走查：全部标准通过是否真的满足原目标；验收是否沿真实角色与入口，是否把 AI 的执行、等待或排障责任转给用户；交付物、环境和授权前提是否可落实。遗漏最终结果、用局部演示替代主链路或要求非必要人工操作，均须在实现前修正；纯内部任务不强加人工验收。

问题给出对应设计位置、影响和修正方向；未关闭 finding 返回 Design，通过返回 design-review: passed。后续设计语义变化后重审受影响部分。不运行代码维护性脚本，不要求子代理，不复制完整方案。以下环节仅适用于 implementation。

## 进入

- 有实现产物时，在验证证据稳定后进入；
- 用户明确要求代码 review、PR review、风险扫描或拟议修复评审时可直接进入；
- 纯文档、措辞和普通元信息只做内容、结构和 diff review，不运行代码维护性脚本；
- 普通局部改动使用轻量 review，L3-L4、跨模块、结构大改或用户明确要求时执行完整 findings-first review。

## 自动检查

源码、脚本、测试或运行链路配置改动先运行一次 diff-only 检查：

    node .agents/skills/development-review/scripts/check-maintainability.mjs

范围明确时优先缩窄：

    node .agents/skills/development-review/scripts/check-maintainability.mjs --paths <touched-files...>

`--non-feature` 只用于明确把非测试净增 `<= 0` 设为交付合同的治理/减债任务，普通 bugfix、refactor 或 cleanup 不默认启用。

脚本默认阻塞本次新增或恶化的文件/函数/目录预算违规、新复杂度、eslint-disable 绕过、职责错配、红区缺少记录和治理违规；历史债务、接近预算线和普通净增长只作为信号。不得为消除普通净增长扩大无关范围、压缩可读性或删除类型/协议保护。

## Findings-first 审查

1. 明确 diff、触达文件、相邻合同和受影响测试。
2. 重建改动前后真实用户或调用方可观察行为。
3. 优先检查正确性、边界、状态迁移、异步、数据流、API/UI 合同和运行失败模式。
4. 判断测试是否保护稳定外部行为；只有真实回归路径缺保护时才把缺测试列为 finding。
5. 检查改动是否把单次实例抬成全局机制、把局部经验固化为公共合同，或让抽象层级高于证据；同时检查重复真相、隐藏 fallback、无收益抽象，以及小 diff 保留的错误 owner、重复生命周期和确定迁移债。
6. 双向比较删除无收益路径与继续压缩造成的欠设计，按全生命周期净复杂度选择修正，不预设抽象或最小改动为答案。
7. 对重复 UI 骨架判断是否应采用共享骨架、类型化配置和薄壳组合。
8. 输出按严重级别排序的 findings、证据、风险和可信修复方向。

净增长本身不是 finding；更小实现只有在不新增双 owner、错误边界、迁移债和恢复缺口时才是有效反例。强行压行、隐藏或转移复杂度同样是 finding。

## 条件主观复核

只有以下情况才读取[主观可维护性复核](references/subjective-review.md)：

- 自动检查告警需要主观判断；
- 抽象、owner、文件或目录边界发生明显变化；
- 改动跨模块、规模较大或维护风险明显；
- 用户明确要求二次复核。

自动检查通过后的普通局部改动不追加完整主观复核。

## 通过与返工

- 只要存在一个未关闭 finding，Review 就不通过，返回 `rework` 和 Design 或 Implementation 目标。
- 修改产物后，旧验证证据失效；必须重新验证并再次 Review。
- 只有 findings 清零后才允许输出 `no findings` 或等价通过结论。
- 外部阻塞导致 finding 无法关闭时，明确阻塞项和风险，结论仍然不通过。

## 输出

顺序固定为：

1. 按严重级别排序的 findings；
2. 开放问题或前提假设；
3. `no findings` 或未通过结论、自动检查范围、主要警告和剩余风险。

本阶段不修改实现、不重新执行功能验证，也不 commit、push、release 或 deploy。
