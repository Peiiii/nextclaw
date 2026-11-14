# Issue #73 会话日志持久化故障

## 迭代完成说明

进行中。用户于 2026-11-14 明确要求处理最新 Issue，先复现、修复、充分验证，再发布新版本；沿本 chat 最新确认覆盖全平台 Desktop。来源：[Issue #73](https://github.com/Peiiii/nextclaw/issues/73)，创建于北京时间 20:44:22，环境 Windows11/Node24.18.1/旧版0.59.1。报告中的 JSON 损坏仅为待证假设，没有原用户 journal，不能宣称复现原机的特定触发。

flow=bugfix；task-id=dt-73b14f26；phase=delivery；retrospective_state=pending。唯一执行区为既有干净 managed worktree，分支 `codex/session-journal-write-failure`，起点 `bbfbd0757b29be0163d562f349abb9c042c3d88e`；原主工作区 Bibo WIP 不动，前项交付已提交。本任务不沿用前项完成状态。

已复现并修复的机制：普通事件原先先提交 actor 再后台持久化；故障不终止运行，后续锁存报错遮蔽首个 cause 并刷屏。现在全部 durable 事件经过同一 ingestion gate，首个错误只记录/通知一次，活动 runtime observer 随 run 生命周期监听故障并取消真实 controller、清空待运行输入；正常错误收尾不再递归写故障盘。observer 使用原 persisted source 发布 UI 投影，避免 clone 二次写入。另用真实 chmod 复现 loader 将 EACCES 返回 null，改为仅 ENOENT 表示缺失。原机最初的 IO/JSON 触发根因未完全定位，没有原文件；不宣称找回从未落盘的内容。

## 测试/验证/验收方式

active-contract: JRN-20261114；scope-revision: 1；parent-goal: 会话持久化失败时立即、明确停止不可靠续跑，保留已持久历史，重启后仍可访问；充分验证后通过现有自动父流程发布新版本。

| ID | Required | Status | 当前合同与证据 |
| --- | --- | --- | --- |
| JRN-01 | true | passed | 真实 journal/coordinator/actor 文件访问失败后 live 多1条、cold保留原1条；50事件50日志；修前2项回归失败。原机JSON触发未复现 |
| JRN-02 | true | passed | 真实 native→actor→coordinator→journal→实际 AgentRunClient：timer/terminal 写失败停止 controller、清空队列、明确拒绝再发、一次诊断与 RunError；healthy session 可继续 |
| JRN-03 | true | passed | 两种故障后冷开仍发现 broken/healthy 并可正常续聊；BigInt 序列化失败实际回滚保留原字节；EACCES 修前返回 null、修后明确抛错且原文件不变；既有 torn-tail 保留回归通过 |
| JRN-04 | true | passed | >20 MiB/1106 条历史、三轮真实 compaction owner、高频 Unicode 写入冷回放逐值一致；文本/推理/tool args 合并、取消/stale、队列/steering/压缩相邻回归有效 |
| JRN-05 | true | passed | Node22.23.2 10 文件83项回归；Node24.18.1 3文件18项故障/压力测试；kernel/server/Desktop tsc、kernel实际构建、定向lint/治理、实现Review；双语说明与changeset准备完成 |
| JRN-06 | true | not-run | 新 stable NPM/Runtime/Desktop 全平台自动发布、更新通道/安装升级/公开入口闭合，复盘完成 |

复现策略 reproduce：先在真实 journal/coordinator/actor 边界注入可控磁盘访问故障；再补损坏记录、元数据及压力矩阵。JSON 文本包含引号/括号不等于 journal JSON 损坏，须按实际序列化/解析链取证。

北京时间21:09已取得首个失败基线：`/tmp/issue73-reproduction.log`。原始持久文件字节不变，actor新增`must-not-be-memory-only`但冷回放没有它；50次事件日志50条，后续仅含锁存stack。当前修复方案已冻结于[设计](../../designs/2026-11-14-session-journal-write-failure.design.md)，方案Review passed。失败锁存为每session内存Map；尚无证据证明原机JSON损坏或本实现主动删除其journal。

读取故障基线 `/tmp/issue73-read-before.log`：真实 chmod 后存在的 journal 被当成 null；修后同入口 EACCES、文件原字节与冷读保留。整体结果 `/tmp/issue73-final-regression.log`、`/tmp/issue73-node24.log`；范围有重叠不累加测试数。Node24 首次命令定位到了错误的 root Vitest 入口，改用本 package 的实际 Vitest 后18项真实通过；没有把启动失败当产品失败或通过。

真实模型验收 `/tmp/issue73-live.json`：`codex-sub/gpt-5.6-luna`，两次消息分别返回 `JRN73_NORMAL_MESSAGE_OK` 与 `JRN73_AFTER_RESTART_OK`，中间关闭并冷启动 store/coordinator/actor；冷历史4条，耗时6797ms。通过当前配置 owner 仅在内存解析现有认证，使用隔离 synthetic journal，不复制凭据、不改默认模型/原用户历史。临时 live test 已移除，未混入 CI 的普通测试集合。未直接验证反馈者原机或桌面界面点击。

## 发布/部署方式

验收与 Review 已具备，尚未发布。版本计划为 nextclaw0.59.5/kernel0.19.7/Desktop0.0.306，Changesets12项（含private，实际NPM包以publisher为准）。`EXISTING_RELEASE_PATH`：原 `release.yml target=all`，现有 npm-production/NPM_TOKEN 路径；最近成功 parent43595530154。发布前无其它在途 release；只触发一个 parent，Actions自行闭合 prepare/安装矩阵/Runtime/Desktop/公开投影，不在Agent侧逐step轮询或gh run watch。`AUTOMATION_INTERVENTIONS=0`。

## 用户/产品视角的验收步骤

新版本入口待自动发布闭合。正常对话可落盘并在冷重启后读取；写失败时明确报错并停止当前运行，排队输入清空，后续发送明确拒绝；修正文件访问后退出并重新打开实例可续聊，已保存历史保持，其它会话可继续工作。参见双语 chat guide 新增“会话记录无法保存时”。

## 可维护性总结汇总

复用原 ingestion/coordinator/SessionRun/日志与恢复 owner，不新增第二套持久化、备用日志或绕过报错的写路径。首次维护性发现2项文件预算error：故障订阅移回活动runtime observer、原SessionPendingInputs类与类型原样移到独立队列模块并保留原类型出口，避免错误owner与继续混放。最终12文件diff检查0error/3warning：AgentRunRequest597/600（净+3必要路径）、SessionRun510/600（净-118）、journal store473/400（净0）；主观复核接受现有边界，不为预算压行或隐藏逻辑，无未关闭finding。定向ESLint0error/2个store既有warning。新路径preflight、新代码治理与ratchet通过，AGENTS/Skill/命令/baseline未改。

### 红区触达与减债记录

- `session-run.manager.ts`：从628降至510，队列原有状态owner独立成模块，actor保留运行/持久确认/故障终止职责；原队列/steering回归和native集成复验通过。
- `ncp-agent-session-journal.store.ts`：无净增长；只区分真实回滚写失败与显式拒绝并改回根公共type import。未为一次写故障扩展存储架构。

## NPM 包发布记录

需要新 stable patch；显式changeset为`@nextclaw/kernel`与`nextclaw`，依赖包按原publisher闭包跟随。当前未上传NPM；发布事实与精确版本以最终同一parent产物补录。
