# 上下文压缩可靠性执行计划

- 上位：[设计](../designs/2026-10-19-context-compaction-resilience.design.md)。目标和范围由 [合同 compaction-resilience-20261019 r1](../work/2026-10-19-context-compaction-resilience/acceptance-contract.md) 唯一拥有。
- 唯一恢复入口：[当前状态](../work/2026-10-19-context-compaction-resilience/current-state.md)。当前无产品代码变更。
- 所有部分复用已冻结设计；如出现新状态 owner 或无法满足既定兼容/预算的分叉，先回 Design 修订并审查，不能以局部 fallback 降低合同。

| 顺序 | 责任域与输入 | 交付结果 | 验证与边界 |
| --- | --- | --- | --- |
| 1 | core/kernel compaction，原计划/预算/事件 | 可选摘要、软硬压力与 v2 来源/恢复态，节流、有界请求 | CR-01/02；永久坏摘要、随机边界、取消追加；当前摘要测试与 tsc |
| 2 | 原 projection/journal owner 与持久化接口 | SQLite 描述、正文片段与身份索引，维修准备与 watermark，bounded seed | CR-04/05/06；256 MiB、64 MiB 单条、百万 delta、冷读和故障；tsc |
| 3 | SessionManager/runtime/history/server/UI/托管 | 同一 run seed，精确回读与 dispatch 闸，进度与分页 | CR-03/07；实际端点、权限、工具副作用拒绝、冷恢复与 UI |
| 4 | 验证 owner，冻结实现 | 故障矩阵与设计性能证据、必要真实模型链路 | CR-08/09；固定负载 >=30 次、匹配 tsc、一次 diff-only maintainability 与 Review |
| 5 | 正式发布 owner，冻结远程主线 | whole product patch、安装升级、runtime/update 与文档 | CR-10；幂等发布与 postpublish smoke，主线回流；复盘后整体完成门 |

部分 1–3 不单独发布或宣称整体完成。中断时记录当前 diff、失败证据、未执行外部动作；恢复先核对主线与持久状态，避免重复发布。
