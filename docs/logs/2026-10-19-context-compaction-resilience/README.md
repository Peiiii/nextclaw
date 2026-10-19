# 上下文压缩可靠性与大历史性能修复

## 原始输入与约束

2026-10-19 用户提供客户错误：`Context compaction batch failed; refusing to install a partial-history checkpoint. The previous checkpoint was kept unchanged.` 一周内两次，无客户日志。要求参考 Codex、Pi、OpenCode、DeepSeek 的实际开源实现，从架构降低未知失败风险，不能只靠上线后迭代。特别要求考虑几百 MB 文件造成会话加载缓慢。

用户确认研究方案后明确：“按这个落地完成并充分地验证……最好能够制造各种之前不行的……bad case……hard case。但是也不要太浪费 token……完成之后没问题就发布……新的修复版本，就是整个产品发布。” 此为实现、充分验证与正式产品 patch 发布授权；确定性故障注入优先，真实模型只覆盖必要闭环。没有授权缩减既定性能、恢复或兼容范围。

## 入口与历史

- [设计与实际源码研究](../../designs/2026-10-19-context-compaction-resilience.design.md) 已在 f9da4930b 前完成；包含上游固定 SHA 与原探针数据。
- [合同](../../work/2026-10-19-context-compaction-resilience/acceptance-contract.md)、[执行现场](../../work/2026-10-19-context-compaction-resilience/current-state.md)、[计划](../../plans/2026-10-19-context-compaction-resilience.plan.md)。
- 21:53 开始实施任务；21:57 新建隔离 worktree 并通过精确 Node 的 offline bootstrap。原主工作区 WIP 保持不变。

## 交付结果

实现及验证完成，正式发布尚待执行。目标为 NextClaw 0.59.2 patch，含 NPM/runtime、文档及触达的 Bibo Worker/UI；不含 desktop installer。

### 实现结果

- 一次可选摘要；源截断、空输出、异常结束或超预算不会安装成完整摘要。软压力可延后，硬压力保存可验证 v2 恢复检查点；实际 dispatch 限制恢复态副作用，只有受信业务澄清确认解除。
- JSONL 为唯一原始事实；SQLite 保存消息描述、精确正文分片、问题/身份/来源索引和维修水位。运行态8MiB/256条/1024parts、冷加载2槽、运行8槽、闲置缓存64MiB；页面256KiB、首屏24KiB、原文片段24KiB。
- 本地与 Cloudflare 复用一个 SQL/replay/cursor owner。缺失/损坏索引显式准备、可取消及恢复；导出/rewind 这类明确请求完整记录的操作从原 journal 重放，未宣称这些批量操作也为常量成本。
- 检查点持久提交先于 actor/UI；来源 generation/epoch/digest 防陈旧安装。导入快照使用同步后的临时源、备份与 durable intent，启动时回滚进程中断的源和元数据，派生索引可重建。

### 验证

- Kernel 完整回归159文件796项通过、3项显式性能 opt-in 跳过；随后受影响的导入中断/维修/连续大CP/时间线40项、分页路由5项通过。runtime真实恢复边界25项、原文UI manager3项通过。
- Bibo174项通过，最新游标错误/原文404 route31项通过，实际Miniflare DO SQLite通过；Worker/网页/脚本三个tsc、依赖闭包tsc、targeted ESLint和公共导入检查通过。生产UI构建通过，保留既有chunk-size/dynamic-import警告。
- Bibo完整desktop/mobile浏览器 smoke成功；专门的分页、准备刷新、503保留当前页/重试、页替换不累积和reload在1440px及390px触屏通过。NextClaw真实触屏原文两次分片读取、44px操作目标、无横向溢出通过。
- [固定负载机器证据](../../work/2026-10-19-context-compaction-resilience/performance-evidence.json)：Linux x64 guest2CPU/2GiB（M4宿主仿真）30次/组，256MiB/64MiB/百万delta页p95=8.08/0.55/1.13ms，规划p95=7.98/0.20/2.43ms；维修堆增11.18/2.17/22.51MiB。首次维修24.93/4.71/115.56秒，显式可见；不是首次维修也瞬时完成的承诺。
- Chrome155/M4/16GiB、50ms延迟/10Mbps、壳缓存热/目标数据点击后放行、30次/组，256MiB/64MiB点击可见p95=188.62/135.04ms。报告明确区分OS缓存热、进程状态和SQLite新连接；不拿M4结果冒充原生x64服务器。
- 真实DeepSeek长任务经历两次自动压缩及平台冷恢复，保留随机文件标识与禁止重复创建条件；两次摘要总计约26k provider输入token。检查点新UUID修复在该模型实验后，以真实存储旧检查点的独立冷热回归证明，未为纯ID逻辑重复付费模型调用。

### Implementation Review

发现并关闭：大检查点摘要被预览截短、运行窗口先全取多条大descriptor、滚动CP复用旧确认ID、DO事务timer死锁、完整导出混入预览、增量/冷重放时间戳差异、source游标长度及重复URL解码、托管非法游标500。均有对应反例或真实入口证据；没有开放的正确性/权限/协议/持久化 finding。

diff-only自动维护性检查检查121文件，报告27项error级预算信号、19项warning，**该脚本未通过**；与人工结论分别记录，不改规则或伪造绿色。主观复核接受本次必要增长：actor的窗口/容量与持久串行仍由原SessionRun拥有；SessionManager为同一公共宿主合同；journal的原子导入回滚必须处于同一写队列；SQL457行集中同一schema与两宿主读合同，part和event已有独立owner；parser是137行有界token状态机；runtime只在原重试入口加真实overflow恢复；UI只连接原文owner。拆成仅转发的manager/service或把互依状态藏到多参数helper会增加复杂度。函数statement/depth和describe长度信号逐项对应上述状态机、事务及故障矩阵；没有用压行、删除协议保护、删测试或修改阈值消除指标。

审查结论：上述结构增长有当前消费者及被验证的风险边界，接受预算信号；`no findings` 仅指人工源码审查无未关闭问题，不表示自动预算检查成功。

### 发布授权与既有路径

`EXISTING_RELEASE_PATH`: release.yml target=product，npm-production NPM_TOKEN；最近成功生产run37934477862/source58def57df。未迁移认证，不执行raw npm publish。dry-run确定0.59.1→0.59.2、23个NPM包、41个workspace验证闭包，runtime更新与真实旧版升级由同一parent闭合；desktop排除。
