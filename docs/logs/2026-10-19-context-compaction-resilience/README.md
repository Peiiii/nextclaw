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

### 已发布事实（02:02，最终产品门仍待关闭）

02:12失败定位及返工：parent39296598787在Windows四个Node20/22/24/26实装单元均失败，错误为snapshot import目录fsync的EPERM；其它平台通过，runtime promotion因依赖该矩阵成功而被正确跳过，stable runtime仍停留旧版。0.59.2 NPM身份不可修改，改为0.59.3正式patch，非重新上传旧版本。根因是把POSIX目录同步直接用于Windows，并在恢复文件上使用只读flush handle。按[Microsoft FlushFileBuffers](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers)要求，Windows文件flush需GENERIC_WRITE；提取同一个内部文件系统durability owner，两原调用方复用。Windows跳过不受Node支持的目录flush，文件和intent仍强制flush；复制文件在Windows用r+，POSIX保留r。没有吞掉普通文件fsync错误；不承诺Windows具备POSIX目录fsync的同等掉电语义，原始源/intent和进程中断恢复仍有效。本地33项durability/真实snapshot/维修定向测试与Kernel tsc通过，真实Windows最终证明由新版本发布矩阵完成。该失败与修复计为发布流程1次人工介入；不改发布机制或降低平台门。

后续交付审查又识别一个确定的验证夹具问题：旧NPM版本0.59.2没有Runtime资产，原安装验证却直接按相同版本下载，继续发布0.59.3必然在升级验证遇到404。保留原验证owner，明确“previous package”与“previous Runtime”两个真实事实：通过认证的官方GitHub Release元数据选择不高于旧NPM版本、四平台资产完整的最新stable Runtime，再按原方式下载/验证版本平台架构/写真实旧pointer。旧NPM launcher仍是0.59.2，实际旧Runtime为0.59.1，报告分别列出，不伪造版本或跳过升级。6项定向Node测试、实际官方release解析0.59.1、ESLint与actionlint通过；普通网络/认证错误仍失败，不以任意fallback掩盖。发布job仅补读取元数据所需的既有GH_TOKEN环境。此为第二个根因的发布修复介入，累计AUTOMATION_INTERVENTIONS=2；尚未dispatch0.59.3，不重发0.59.2或修改已发布包。

- 源码6e7a43a6ad已进入远程master，父发布run39296598787仅dispatch一次。NPM latest已为0.59.2；版本提交与tag `nextclaw@0.59.2` 指向c45d1a413b。Runtime及真实安装矩阵仍以parent终态为准，未提前宣称整个产品完成。
- Bibo从冻结6e7a43a6ad发布Worker/UI，47.49秒，版本6677a4c7-a923-4ce1-8a29-402dd773e914。部署前后两个容器镜像引用一致；16个入口静态资源SHA256与冻结构建一致。真实线上鉴权、桌面/触屏会话刷新与原文400/401/404通过，隔离测试会话已删除，无新增模型调用。空UI会话尚未建立canonical源，page cursor在此分支返回200空页；canonical非法游标400另由实际app route测试证明。
- 收尾扩展UI回归：4个hooks/timeline文件35项通过。输入边界fixture原有14项均因缺QueryClient失败，用只读Vite source override加载f9da基线两组件可稳定同现14项失败；原组件/hook和fixture此前未改。为验证本次触达的输入边界，只在该fixture显式隔离无关的问题抓取provider，不修改产品行为，14项现已通过；独立问题组件3项、原文manager3项也通过，合计55项UI定向证据。该test-only修正补跑UI tsc及ESLint，并做局部diff Review。
