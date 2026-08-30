---
name: development-review
description: 通用开发生命周期的「Code Review」阶段 owner；当实现和验证形成可审查结果，或用户明确要求代码/PR/风险评审时使用，负责 findings-first 审查和维护性自动检查，不负责修改实现或执行发布。
---

# Development Review

## 目标

回答“这份已经实现并验证的改动是否可以被接受”。优先检查正确性、回归风险、契约清晰度和可维护性压力，而不是停留在样式偏好。

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
5. 检查改动是否把单次实例抬成全局机制、把局部经验固化为公共合同，或让抽象层级高于证据；没有多个独立场景、稳定不变量或真实消费者时，列 finding 并收敛到最窄 owner。
6. 检查重复逻辑、多份真相、隐藏 fallback 和不必要增长，再判断删除、简化或收敛路径。
7. 对重复 UI 骨架判断是否应采用共享骨架、类型化配置和薄壳组合。
8. 输出按严重级别排序的 findings、证据、风险和最小可信修复方向。

净增长本身不是 finding；只有增长不必要、重复、扩大范围、增加无收益抽象或存在明显更小实现时才报告。强行压行、隐藏复杂度、把负担移出统计面或用临时 hack 换取减少，同样是 finding。

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
