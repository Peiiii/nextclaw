---
name: post-edit-maintainability-guard
description: 在完成源码、脚本、测试或运行链路配置改动后运行一次自动可维护性检查；用于发现本次 diff 新增或恶化的文件、目录、复杂度、命名和红区债务，不负责所有任务的主观二次 Review。
---

# Post Edit Maintainability Guard

## 定位

这是一次性的 diff-only 自动闸门。它负责发现可执行规则能稳定识别的问题，不重复承担主观架构 Review、仓库体积长报告或强制代码行数抵消。

纯文档、措辞和普通元信息改动不适用。

## 默认入口

源码、脚本、测试或运行链路配置改动完成后运行：

    node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs

改动范围明确时优先缩窄：

    node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <touched-files...>

--non-feature 是显式“零增长治理/减债任务”模式，不再因为任务名叫 bugfix、refactor 或 cleanup 就默认启用。只有用户、计划或专项治理任务明确把非测试净增 <= 0 作为交付合同时才使用；其既有 hard gate 语义保持不变。

## 信号

脚本输出是阈值和路径判断的事实源，skill 不再重复维护整套实现细节。

默认阻塞本次新增或恶化的：

- 文件、函数或目录预算违规；
- 新复杂度或 eslint-disable 绕过；
- 高置信度文件名与职责错配；
- 红区触达但缺少必需记录；
- 当前 diff 引入的治理违规。

默认只报告：

- 未继续恶化的历史债务；
- 接近预算线但尚未越界的文件/目录；
- 仓库代码体积趋势；
- --non-feature 未启用时的普通净行数变化。

不要为了消除普通净增长而扩大到无关模块、压缩可读性、删除类型/协议保护或制造额外抽象。

## 与主观 Review 的关系

guard 通过后，普通局部改动直接收尾。只有以下情况才读取 post-edit-maintainability-review：

- guard 告警需要主观判断；
- 抽象、owner、文件或目录边界发生明显变化；
- 改动跨模块、规模较大或维护风险明显；
- 用户明确要求二次复核。

## 输出

只汇报：

- 实际检查范围；
- 阻塞项；
- 与本次决策有关的警告；
- 是否触发主观 Review 或迭代记录。

没有发现时写清“无本次新增可维护性问题”即可，不展开完整仓库指标和所有未命中类别。

## 资源

- scripts/check-maintainability.mjs：统一入口与当前阈值事实源。
- scripts/maintainability-guard-core.mjs：结果组装和 diff-only 判定。
- scripts/maintainability-guard-directory-budget.mjs：目录预算。
- scripts/maintainability-guard-hotspots.mjs：红区。
- scripts/maintainability-guard-lint.mjs：ESLint 结果解析。
