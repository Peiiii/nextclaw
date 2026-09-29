# Session Journal 增长治理与 beta 发布复盘

## 迭代完成说明

- 交付范围：会话 Journal delta 合并、显式离线维护命令、双语说明与博客，以及 `nextclaw@0.59.0-beta.0` 的 NPM 和四平台 Runtime beta 发布。实现与可靠性边界见[设计记录](../../designs/2026-09-29-session-journal-growth-reliability.design.md)。远端 `master` 已包含实现和发布恢复修复，最终文档部署提交为 `5e3ae490c4cf3074aa556a3244190e786f432c03`。
- [beta Release](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.59.0-beta.0) 已公开，带四个平台 Runtime 资源。[文档部署 run 36582626182](https://github.com/Peiiii/nextclaw/actions/runs/36582626182) 的 build、global、domestic、verify 全部成功；两站清单均为上述提交和同一内容指纹 `05cc99ec67cb93d72f57daf32d15bb25b0c65ed04338881f345b204fa59d7d86`。
- 发布恢复有三类人工介入：NPM 精确版本核验读到陈旧 E404 缓存、真实安装遇到网络超时、国内文档 OSS 上传失败。前两类修复留在原验证脚本并完成定向检查；国内文档凭据由单段 1800 秒调整为两段各 3600 秒，最终真实部署通过。`AUTOMATION_INTERVENTIONS: 3`。成功的 NPM 版本与 Runtime 资源未重复发布。

### 发布延误复盘

- **复盘缺席的机制原因**：原 Lifecycle 只在流程顺序与完成门里写“复盘”，Delivery 成功后没有显式的 `ready-for-retrospective` 交接状态；复盘也没有必须返回的决定值。长时间外部等待结束后，发布成功被直接当成任务完成，完成门没有可核对的待办状态。用户指出这是机制问题，不能只归为执行者疏漏。
- **重复劳动**：第一次国内上传在约 1812 秒后以 30 个对象失败；当时 STS 有效期为 1800 秒，时间高度吻合，但没有保留逐对象错误报告，所以不能声称每个失败都已确认由凭据过期造成。我没有先重跑同一 run 的失败 job，而是改 workflow 后从新提交启动整站归档。新 run 无法复用旧提交的归档前缀，重传了全部文件。既有交付合同已经要求优先恢复失败阶段和复用成功产物；本次没有遵守。
- **确定的耗时来源**：成功 run 的国内归档上传 1225 个对象、161707948 字节，用时 2741 秒；正式站点再次上传相同数量和字节，用时 2983 秒。国内 job 从 14:28:11Z 到 16:04:07Z，约 96 分钟；全球 job 43 秒。`ossutil sync` 使用默认 3 个文件并发。两次完整上传是本次发布的实测关键路径，不以“CI 慢”代替原因。
- **公开状态短暂不一致**：同步期间，国内 `release-manifest.json` 已显示新提交，博客仍返回 404；全部同步、CDN 刷新和双站 verify 后两篇博客均返回 200。这证明单看 manifest 不足以判定部署完成，现有 verify 仍是必要完成门。后续若改发布顺序，应在文档部署 owner 内处理并真实验收，不用本次已成功的 run 冒充修复验证。
- **沟通与状态缺口**：状态不变时重复汇报等待，却没有持续保留“beta 已完成、国内镜像未完成、复盘待执行”的任务状态。`development-delivery` 对外部等待已有更新边界，但缺少从 Delivery 到 Retrospective 的显式 handoff，使长发布收尾时更容易遗漏后续工作。

### 机制修复与边界

- 共享流程权威源 [ai-development-system `e78aa47`](https://github.com/Peiiii/ai-development-system/commit/e78aa47) 将完整开发或授权发布的 `retrospective_state` 初始化为 `pending`；Delivery 成功只返回 `ready-for-retrospective`，Retrospective 返回已更新 owner 或 `no-increment` 及理由，Lifecycle 才允许进入整体完成检查。跨会话交接保存该状态；发现未完成结果时仍保持 pending 并返工。同步安装到 NextClaw，并与已有本地/上游规则差异合并。
- 此改动是**流程状态合同**，没有运行时拦截最终回复的硬执行器。上游安装校验和测试、NextClaw 渐进加载/治理检查可证明规则资产一致，不能证明模型在所有任务里必然遵守；需用后续长发布和普通小任务观察漏复盘、空日志及额外上下文成本。若不能降低遗漏，收窄或撤回。
- 阶段观测沿用现有 `development-task-telemetry` owner：完整开发和授权发布默认启用。任务开始声明阶段，flow 冻结时声明流程；之后只在阶段切换的原有回复首行显示 `[step:<phase>]`；历史机器 marker 保持兼容。报告与本地大盘显示 flow、根线程当前阶段和复盘观测状态；已完成却缺复盘阶段标记时显示 `missing`，旧任务保持 `unknown`。这能发现明显遗漏，不能单靠自报标记证明复盘决定的质量，整体完成仍由 Lifecycle 核查决定与证据。

## 测试/验证/验收方式

- Kernel 定向和完整测试、CLI 文档同步测试、匹配范围 `tsc`、文档构建及维护性检查通过；冻结副本从 178436341 字节降至 45655999 字节，冷重放消息一致，回退后 SHA-256 与备份一致。隔离源码实例的 598 条正文 SSE delta 对应 Journal 13 条，完成正文一致，重启后 API 可读。
- 已在隔离目录真实安装 `nextclaw@0.59.0-beta.0` 并验证公开版本和 `InputBudgetPruner.estimate/prune` 可调用。NPM 精确版本核验 9/9 通过；Runtime 发布 workflow [36577822736](https://github.com/Peiiii/nextclaw/actions/runs/36577822736) 成功。
- 文档部署 workflow 四个 job 均成功；全球和国内中英文博客实际 HTTP 200，两站 manifest 的 commit 与 tree hash 相同。
- 阶段观测的定向测试覆盖新旧标记、阶段冲突、正文示例误判、缺复盘与大盘 API；用本次真实 rollout 复验，报告读到 `flow=bugfix`、`current_phase=validation`、`retrospective_observation=pending`。共享包安装校验、项目渐进加载与治理检查通过。
- 尚无同条件流式 p95 增量与内存对照、Windows 文件切换、双实例同 HOME，以及所有旧版安装升级样本的完整矩阵。beta 发布不等于这些设计门槛已全部验证；不得在博客或交付摘要中补称其通过。

## 发布/部署方式

- Changesets beta 预发布生成并发布 9 个公共包；发行提交 `95b085ff0` 和相应 tag 已推送。NPM 发布后的本地验证脚本修复与文档凭据修复已进入远端 `master`。
- Runtime beta 由既有 `release:beta:runtime` 入口发布；文档站由同一不可变构建分别部署到 Cloudflare Pages 与阿里云 OSS/CDN，并由仓库 verify job 比较两域身份。
- 主工作区有其它任务的活跃文档 WIP；主线 reconcile 返回 `LOCAL_WORKTREE_RETRYING`，由既有 retry worker 接管本地镜像，不覆盖、stash 或 reset 无关改动。远端 `master` 与公开发布不受此本地镜像延后影响。

## 用户/产品视角的验收步骤

1. 在 NPM 查询 `nextclaw@beta`，应得到 `0.59.0-beta.0`；安装后 `nextclaw --version` 应显示同一版本。
2. 打开[中文优化报告](https://docs.nextclaw.io/zh/blog/2026-09-29-session-journal-storage-optimization)及[国内镜像](https://docs.nextclaw.net/zh/blog/2026-09-29-session-journal-storage-optimization)，两者均可读；英文版也在各站对应 `/en/blog/` 路径。
3. 已有会话在普通升级时不自动改写 Journal。离线维护必须先停掉共享 HOME 的所有写者，先 dry-run，再由操作者显式应用；冻结副本的真实应用、冷启动和回退已验证，用户原始 488.6 MB 文件未被本次任务改写。

## 可维护性总结汇总

- Journal 改动沿现有 kernel ingestion 与 store owner 实现，没有引入新磁盘格式；离线维护单独显式入口，不把危险重写塞入普通升级。匹配范围的 maintainability 检查无阻塞项，既有文件预算 warning 未作为新缺陷隐去。
- 发布恢复修复留在原 NPM 核验、安装 smoke 与 docs workflow owner。日志目录符合日期批次命名；本次复盘更新共享 Lifecycle/Delivery/Retrospective 的阶段交接合同并同步受管安装副本，没有新增常驻 AGENTS 规则、平行流程或窄治理脚本。
- 文档部署的完整双次上传与清单提前可见是已证实的后续改进候选，但本次只修复凭据有效期并通过真实部署；并发、增量同步或清单顺序尚未改动，也没有它们的生产验证。

## NPM 包发布记录

本次需要 beta 发布，9 个包均已发布：`nextclaw@0.59.0-beta.0`、`@nextclaw/kernel@0.19.2-beta.0`、`@nextclaw/client-sdk@0.12.14-beta.0`、`@nextclaw/harness@0.2.28-beta.0`、`@nextclaw/companion@0.2.71-beta.0`、`@nextclaw/remote@0.3.71-beta.0`、`@nextclaw/server@0.23.14-beta.0`、`@nextclaw/service@0.7.8-beta.0`、`@nextclaw/ui@0.27.5-beta.0`。`nextclaw` 的 `beta` dist-tag 指向 `0.59.0-beta.0`；`latest` 仍为稳定版 `0.58.0`。
