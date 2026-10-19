# 上下文压缩修复交付合同

- contract-id: compaction-resilience-20261019
- parent-goal: 长会话在摘要失败、大历史和恢复条件下仍安全、可用、加载有界，并发布 NextClaw 正式修复版。
- scope-revision: 1；用户于 2026-10-19 确认既定设计并授权实现、充分验证与整个产品发布。
- 原始输入：[日志](../../logs/2026-10-19-context-compaction-resilience/README.md)。
- 设计：[已审查设计](../../designs/2026-10-19-context-compaction-resilience.design.md)，其性能预算与故障条件均保持有效。
- 一个交付阶段，内部按依赖分批；不以局部错误消失代替整体完成。桌面发布按项目产品发布语义不属于本次明确平台授权；NPM、runtime、文档与适用宿主必须闭合。

## 验收账本

| ID | Required | 合同 | Status | 当前证据 |
| --- | --- | --- | --- | --- |
| CR-01 | true | 摘要为可丢弃内容；一次增量摘要、普通压力延后与节流、硬压力确定性恢复，完整请求预算有效 | passed | 一次摘要/软延后/硬恢复/完整输入预算与永久坏摘要专项；Kernel完整796项及runtime25项通过。 |
| CR-02 | true | v1/v2 冷热投影兼容；归档/保留/摘要来源有界；取消、并发追加、rewind 与持久提交不产生半检查点 | passed | v1/v2冷恢复、同长度源替换、取消前/写中/提交后、快照故障/进程中断回滚及时间线；最新40项故障回归通过。 |
| CR-03 | true | 恢复态精确历史读取、授权与实际工具 dispatch 限制，不能自称恢复后重做副作用 | passed | 实际dispatch7项、渠道trusted human确认4项；8次历史后仍可澄清，普通聊天/模型自称不解除。 |
| CR-04 | true | 本地派生索引、描述与正文分片；普通分页和精确读取不随归档线性增长 | passed | 256MiB/64MiB/40个大CP页与精确分片；页源读取<4MiB；完整导出源重放保真。 |
| CR-05 | true | 运行窗口有界、冷热一致、缓存与并发容量有界；无全历史装载后截断 | passed | 实时64MiB消息/10会话/2冷槽/64MiB闲置缓存及并发容量；多大CP运行窗口读取预算专项通过。 |
| CR-06 | true | 缺失/损坏/长尾投影可见准备、单维修、取消及最终可用；巨型旧事件流式处理 | passed | 真实64MiB与百万delta显式准备最终ready、故障/取消/续水位；DO控制全过程p95<500ms。 |
| CR-07 | true | UI/server/SDK/本地及托管 history 实际入口满足统一合同；兼容宿主边界显式验证 | in-progress | 本地/托管/浏览器与Bibo线上已过；0.59.2实装矩阵发现Windows fsync EPERM，已修复并通过33项定向验证，0.59.3 Windows真实矩阵仍待关闭。 |
| CR-08 | true | 固定设计负载与环境至少 30 次性能测量；字节、延迟、内存与写入放大符合预算，真实模型长任务与冷恢复可用 | passed | performance-evidence.json：固定Linux x64 guest2CPU/2GiB与M4 Chrome，每组30次；所有字节/时延/堆预算通过。真实DeepSeek两次自动压缩+冷恢复成功；环境及边界已披露。 |
| CR-09 | true | 永久坏摘要、巨型消息、百万 delta、故障注入、状态转换与随机边界验证；匹配 tsc 和源码 Review 无未关闭问题 | passed | 永久坏摘要/故障矩阵/Unicode随机/巨型事件/百万delta/Node20驱动通过；匹配tsc、ESLint、public imports通过。人工Review无开放finding；自动维护性27预算信号的接受理由在日志明确记录，未宣称脚本通过。 |
| CR-10 | true | 文档/changeset、冻结主线正式 patch 发布、安装升级和发布后实际 smoke、适用 runtime/update channel 与主线回流 | not-run | 尚未发布 |

## 当前阶段门

结果：保持原 journal，所有恢复可回读。当前 open-required: CR-07、CR-10。Windows发布实装失败后重开兼容边界，等待0.59.3真实矩阵及完整产品发布；不能以局部验证或NPM版本出现提前声明整个任务完成。

契约 Review：性能、旧数据、真实入口、托管与最终发布单列，避免局部成功掩盖未交付；不重复登记通用格式/lint 规则。无待决范围变更。
