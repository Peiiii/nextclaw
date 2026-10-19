# 上下文压缩可靠性与大历史性能修复

## 原始输入与约束

2026-10-19 用户提供客户错误：`Context compaction batch failed; refusing to install a partial-history checkpoint. The previous checkpoint was kept unchanged.` 一周内两次，无客户日志。要求参考 Codex、Pi、OpenCode、DeepSeek 的实际开源实现，从架构降低未知失败风险，不能只靠上线后迭代。特别要求考虑几百 MB 文件造成会话加载缓慢。

用户确认研究方案后明确：“按这个落地完成并充分地验证……最好能够制造各种之前不行的……bad case……hard case。但是也不要太浪费 token……完成之后没问题就发布……新的修复版本，就是整个产品发布。” 此为实现、充分验证与正式产品 patch 发布授权；确定性故障注入优先，真实模型只覆盖必要闭环。没有授权缩减既定性能、恢复或兼容范围。

## 入口与历史

- [设计与实际源码研究](../../designs/2026-10-19-context-compaction-resilience.design.md) 已在 f9da4930b 前完成；包含上游固定 SHA 与原探针数据。
- [合同](../../work/2026-10-19-context-compaction-resilience/acceptance-contract.md)、[执行现场](../../work/2026-10-19-context-compaction-resilience/current-state.md)、[计划](../../plans/2026-10-19-context-compaction-resilience.plan.md)。
- 21:53 开始实施任务；21:57 新建隔离 worktree 并通过精确 Node 的 offline bootstrap。原主工作区 WIP 保持不变。

## 交付结果

**已完成并发布NextClaw 0.59.3 patch**，含NPM/runtime、文档及触达的Bibo Worker/UI；不含desktop installer。首个0.59.2候选被Windows实装矩阵阻止推广Runtime，最终0.59.3恢复parent39306362156成功，全部适用发布门已闭合。

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

### 发布候选返工与最终门

02:12失败定位及返工：parent39296598787在Windows四个Node20/22/24/26实装单元均失败，错误为snapshot import目录fsync的EPERM；其它平台通过，runtime promotion因依赖该矩阵成功而被正确跳过，stable runtime仍停留旧版。0.59.2 NPM身份不可修改，改为0.59.3正式patch，非重新上传旧版本。根因是把POSIX目录同步直接用于Windows，并在恢复文件上使用只读flush handle。按[Microsoft FlushFileBuffers](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers)要求，Windows文件flush需GENERIC_WRITE；提取同一个内部文件系统durability owner，两原调用方复用。Windows跳过不受Node支持的目录flush，文件和intent仍强制flush；复制文件在Windows用r+，POSIX保留r。没有吞掉普通文件fsync错误；不承诺Windows具备POSIX目录fsync的同等掉电语义，原始源/intent和进程中断恢复仍有效。本地33项durability/真实snapshot/维修定向测试与Kernel tsc通过，真实Windows最终证明由新版本发布矩阵完成。该失败与修复计为发布流程1次人工介入；不改发布机制或降低平台门。

后续交付审查又识别一个确定的验证夹具问题：旧NPM版本0.59.2没有Runtime资产，原安装验证却直接按相同版本下载，继续发布0.59.3必然在升级验证遇到404。保留原验证owner，通过认证的官方GitHub Release元数据选择不高于旧NPM版本、四平台资产完整的最新stable Runtime，再按原方式下载/验证版本平台架构/写真实旧pointer。6项定向Node测试、实际官方release解析0.59.1、ESLint与actionlint通过；普通网络/认证错误仍失败，不以任意fallback掩盖。发布job补读取元数据所需的既有GH_TOKEN环境。此为第二个根因的发布修复介入。

0.59.3 parent39302315623/source c574879134于02:25执行，NPM、四平台×Node20/22/24/26实装16组及Runtime推广均成功；02:44最后升级验证失败。第三个根因是夹具将NPM0.59.2与Runtime0.59.1混合后执行分步升级，旧launcher bootstrap在后续启动时自动应用已下载版本，随后显式apply成为重复操作。失败栈已来自0.59.3 Runtime，原文保存在/tmp/compaction-v0593-failed.log。修回同一owner：上一完整stable使用相同package/runtime版本分步验证check/download/apply；较新NPM+旧Runtime单独执行正常一体update，严格断言最终pointer与新进程版本，不接受失败命令。升级验证消费当前publisher控制平面，产品tag与四资产仍固定0.59.3。累计AUTOMATION_INTERVENTIONS=3，真实验证与同一版本恢复终态仍待闭合。

02:53上述两路径真实公网精确安装均通过：0.59.1完整稳定版check/download/apply、新进程0.59.3及Portable Service App调用成功；0.59.2 launcher+0.59.1 Runtime一体update也得到restart-required、pointer及新进程0.59.3。临时home/cache均由原owner清理。6个verifier单测、14个orchestration合同、ESLint/actionlint通过；局部自动维护性零error/2warning，人工复核没有开放finding。四平台公开manifest均为0.59.3/hostKind=npm-runtime-bundle/floor0.18.11，签名与hash存在；releaseNotesUrl仍指向冻结源码所确定的同一GitHub Release，最终正文使用已构建双语notes，不移动tag或修改已发布包。

同一0.59.3恢复parent39306362156于02:53:44从daa1098b5e单次dispatch，docs自动部署39306292558；不重复上传NPM或重建Runtime。普通本地new-release dry-run没有发布checkpoint且以仍活跃的local master为Changesets基线，不能模拟CI recovery；明确未把这次dry-run称为成功，未为绕过它移动primary master。CI现有identity gate自行从冻结SHA识别已发布0.59.3，最终完成仍以此parent终态为准。

发布耗时取GitHub job/step metadata（不读取成功job日志）：0.59.2 NPM job783秒，其中prepared batch+Git731秒；0.59.3 NPM job588秒，其中同一步540秒，均为`time budget: missed`。这些含exact-source准备/发布/Git等待，不能当作纯registry上传时间。0.59.3 Runtime promotion及公开channel验证116秒，在120秒目标内；后续失败的升级验证87秒单列。NPM慢点集中于首次广泛依赖闭包与两次必要源码返工后的精确产物准备；继续复用immutable artifacts和成功兼容矩阵，不新增手工发布快速通道。细分package计时未独立导出为artifact，当前只声明可由metadata证明的层级。

- 首候选源码6e7a43a6ad进入远程master，父发布run39296598787仅dispatch一次。当时NPM latest为0.59.2，tag `nextclaw@0.59.2` 指向c45d1a413b；Windows失败后未推广Runtime。该候选已被下述0.59.3正式结果取代。
- Bibo从冻结6e7a43a6ad发布Worker/UI，47.49秒，版本6677a4c7-a923-4ce1-8a29-402dd773e914。部署前后两个容器镜像引用一致；16个入口静态资源SHA256与冻结构建一致。真实线上鉴权、桌面/触屏会话刷新与原文400/401/404通过，隔离测试会话已删除，无新增模型调用。空UI会话尚未建立canonical源，page cursor在此分支返回200空页；canonical非法游标400另由实际app route测试证明。
- 收尾扩展UI回归：4个hooks/timeline文件35项通过。输入边界fixture原有14项均因缺QueryClient失败，用只读Vite source override加载f9da基线两组件可稳定同现14项失败；原组件/hook和fixture此前未改。为验证本次触达的输入边界，只在该fixture显式隔离无关的问题抓取provider，不修改产品行为，14项现已通过；独立问题组件3项、原文manager3项也通过，合计55项UI定向证据。该test-only修正补跑UI tsc及ESLint，并做局部diff Review。

### 最终正式发布与复盘

- **NEXTCLAW_STABLE_READY 0.59.3**：[恢复parent39306362156](https://github.com/Peiiii/nextclaw/actions/runs/39306362156)于02:53:44–03:01:17全部成功，453秒；未重发NPM、未重建Runtime，复用parent39302315623的16组平台/Node实装成功证据。final artifact记录version0.59.3、sha **cdd34ef29a5745ca04ec8b8bbcdbe20dcbc38816**、target product及此runId，已下载核对。原不可变产品源c574879134，恢复控制平面/内容源daa1098b5e，来源明确分开。
- 恢复NPM job146秒，最慢为Infer release checkpoint 91秒，`time budget: missed`；这是已发布事实/历史兼容证据识别与环境准备，不是再次上传。Runtime job206秒，其中真实旧安装/升级123秒；原Runtime promotion116秒在120秒目标内。重用成功checkpoint避免重复平台安装、重新打包或新发布通道；未把job总时长冒充registry上传或Runtime promotion时间。
- 四平台公开manifest实读均0.59.3、minimumLauncherVersion0.18.11、hostKind=npm-runtime-bundle，hash/signature字段存在；releaseNotesUrl保留冻结源决定的[同一GitHub Release](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw@0.59.3)。该Release已更新为owner生成的中英双语正文并逐字回读，四个Runtime资产仍在，tag没有移动。
- [docs部署39306292558](https://github.com/Peiiii/nextclaw/actions/runs/39306292558)国际、国内及verify全部成功，commit daa1098b5e，tree **698e13bf8edda8003d2170004f20be57891de4bf123991e0d4c6ffa27ee1e366**。两站中英文0.59.3页面与JSON均200，JSON与源码一致；产品默认跨域读取入口docs.nextclaw.io的CORS=*已验证。额外检查发现国内镜像JSON没有CORS，旧0.59.1也如此；它不是本版产品跨域消费入口，未把国内跨域读取列为通过项，未扩大范围改托管基础设施。
- Branch closure检查通过：origin/master与codex/compaction-resilience均包含全部用户功能、版本及已发布内容，无release-only源码。主线协调器返回**LOCAL_WORKTREE_RETRYING**，因为primary原有tracked WIP尚在；单例worker接管，未reset/stash/rebase或覆盖。原tracked diff SHA256仍**6b9d5f0f9688351cdb5bfeb74340a06dcf2a5cdef2afdbbbdffe39d0cd53e02f**，原未跟踪路径保留。远程交付已闭合，本地自动协调不是用户待办。
- 临时Bibo发布worktree已安全移除；owned验证宿主18897、Docker容器和volume已清理，安装fixture由原owner自动清理。实施worktree保留作为可查看交付，原有设计worktree不动。没有桌面安装包授权，本次没有installer发布；这是可靠性patch，用户文档/notes已更新，无额外官网营销改版或社交传播，夜间没有社交平台读写。
- **retrospective_decision=updated-existing-owners**：三个根因均修回原owner与反例，平台durability差异补入原设计，升级验证按完整stable与bootstrap两种真实语义分开，当前publisher可恢复旧不可变产物。current-state重写为当前快照，历史归本日志。不新增全局规则、平行发布器或空复盘文档。功能、类型、故障、性能及实装证据边界明确；没有客户日志，不能声称确定还原客户每次事故；自动维护性预算信号的人工接受不被改写成脚本通过。
- `AUTOMATION_INTERVENTIONS=3`；`parent_status=ready-for-completion-check`；CR-01–CR-10全部关闭。最终阶段统计以task=end后observer实际rollout为准，不推算Token。
