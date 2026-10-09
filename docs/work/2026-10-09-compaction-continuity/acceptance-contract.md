# 压缩连续性修复交付合同

- contract-id：compaction-continuity-20261009
- parent-goal：长任务经过一次及连续上下文压缩后，仍能识别已完成操作与正确下一步；充分验证后发布 patch。
- scope-revision：2；授权来源：2026-10-09 当前会话，用户要求完成修复、充分测试并发布 patch，随后明确补充桌面端必须发布，并要求复用自动化、减少 Token。
- 来源：用户截图反映压缩后重复读文件、重复调查及重复执行；用户算法建议只作参考。截图无现场 journal，不能认定具体版本或直接根因。

| ID | Required | 合同 | Status | 证据 |
| --- | --- | --- | --- | --- |
| CC-01 | true | 工具名称、参数、调用关联和结果进入摘要源；长历史不能静默丢弃中间执行记录 | passed | 修前失败、修后通过的身份/中间记录回归；400 条身份分批测试 |
| CC-02 | true | 最近完整助手/工具轮次按预算保真，无孤立结果；同一 assistant 新 parts 不重复也不丢失 | passed | 完整轮次与过大轮次回归；两次压缩和冷投影后 migrate-once、新 parts 各出现一次 |
| CC-03 | true | 连续压缩更新已完成/进行中/阻塞和下一步；真实模型经过至少两次压缩后不重复已完成副作用 | passed | Codex gpt-6-luna 与 DeepSeek flash 均两次自动压缩，八个隔离操作各一次，重开会话零新增调用 |
| CC-04 | true | 大输出、小窗口、工具 schema、失败/取消、旧 checkpoint、持久化恢复保持预算与原数据完整 | passed | 核心 13 项、kernel 88 项及 runtime/toolkit/journal 回归；缩小重试预算耗尽仍安全恢复 |
| CC-05 | true | 匹配 tsc、lint、跨包压缩回归和实现 Review 通过；无无关 WIP 混入 | passed | core/kernel/runtime-next tsc；定向 lint、治理；实现 Review 无未关闭 finding。168 项相关检查通过；14 项未修改 UI 失败经修前基线复现，作为已有缺陷排除而非计为通过 |
| CC-06 | true | patch 发布及适用 NPM/runtime/desktop、文档、主线闭环完成，产物可安装且身份可验证 | not-run | 待交付合同判定及发布 |

单阶段交付；不增加无关视觉截图或性能压测。状态更新不改变标准。
