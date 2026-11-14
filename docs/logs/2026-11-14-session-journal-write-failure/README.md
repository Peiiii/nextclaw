# Issue #73 会话日志持久化故障

## 迭代完成说明

进行中。用户于 2026-11-14 明确要求处理最新 Issue，先复现、修复、充分验证，再发布新版本；沿本 chat 最新确认覆盖全平台 Desktop。来源：[Issue #73](https://github.com/Peiiii/nextclaw/issues/73)，创建于北京时间 20:44:22，环境 Windows11/Node24.18.1/旧版0.59.1。报告中的 JSON 损坏仅为待证假设，没有原用户 journal，不能宣称复现原机的特定触发。

flow=bugfix；task-id=dt-73b14f26；phase=delivery；retrospective_state=pending。唯一执行区为既有干净 managed worktree，分支 `codex/session-journal-write-failure`，起点 `bbfbd0757b29be0163d562f349abb9c042c3d88e`；原主工作区 Bibo WIP 不动，前项交付已提交。本任务不沿用前项完成状态。

已复现并修复的机制：普通事件原先先提交 actor 再后台持久化；故障不终止运行，后续锁存报错遮蔽首个 cause 并刷屏。现在全部 durable 事件经过同一 ingestion gate，首个错误只记录/通知一次，活动 runtime observer 随 run 生命周期监听故障并取消真实 controller、清空待运行输入；正常错误收尾不再递归写故障盘。observer 使用原 persisted source 发布 UI 投影，避免 clone 二次写入。另用真实 chmod 复现 loader 将 EACCES 返回 null，改为仅 ENOENT 表示缺失。原机最初的 IO/JSON 触发根因未完全定位，没有原文件；不宣称找回从未落盘的内容。

## 测试/验证/验收方式

active-contract: JRN-20261114；scope-revision: 2；parent-goal: 会话持久化失败时立即、明确停止不可靠续跑，保留已持久历史，重启后仍可访问；充分验证后通过现有自动父流程发布新版本，发布期间新增兼容修复纳入同一交付。

| ID | Required | Status | 当前合同与证据 |
| --- | --- | --- | --- |
| JRN-01 | true | passed | 真实 journal/coordinator/actor 文件访问失败后 live 多1条、cold保留原1条；50事件50日志；修前2项回归失败。原机JSON触发未复现 |
| JRN-02 | true | passed | 真实 native→actor→coordinator→journal→实际 AgentRunClient：timer/terminal 写失败停止 controller、清空队列、明确拒绝再发、一次诊断与 RunError；healthy session 可继续 |
| JRN-03 | true | passed | 两种故障后冷开仍发现 broken/healthy 并可正常续聊；BigInt 序列化失败实际回滚保留原字节；EACCES 修前返回 null、修后明确抛错且原文件不变；既有 torn-tail 保留回归通过 |
| JRN-04 | true | passed | >20 MiB/1106 条历史、三轮真实 compaction owner、高频 Unicode 写入冷回放逐值一致；文本/推理/tool args 合并、取消/stale、队列/steering/压缩相邻回归有效 |
| JRN-05 | true | passed | Node22.23.2 10 文件83项回归；Node24.18.1 3文件18项故障/压力测试；kernel/server/Desktop tsc、kernel实际构建、定向lint/治理、实现Review；双语说明与changeset准备完成 |
| JRN-06 | true | not-run | 新 stable NPM/Runtime/Desktop 全平台自动发布、更新通道/安装升级/公开入口闭合，复盘完成 |
| JRN-07 | true | not-run | Node20旧Desktop宿主libSQL binding实际打包与历史升级回读；Windows focused复验待完成 |
| JRN-08 | true | passed | prepare未结束时原Runtime selector返回null导致parent失败；现只等待同source active run且保留失败门，纯selector/编排回归证明 |

复现策略 reproduce：先在真实 journal/coordinator/actor 边界注入可控磁盘访问故障；再补损坏记录、元数据及压力矩阵。JSON 文本包含引号/括号不等于 journal JSON 损坏，须按实际序列化/解析链取证。

北京时间21:09已取得首个失败基线：`/tmp/issue73-reproduction.log`。原始持久文件字节不变，actor新增`must-not-be-memory-only`但冷回放没有它；50次事件日志50条，后续仅含锁存stack。当前修复方案已冻结于[设计](../../designs/2026-11-14-session-journal-write-failure.design.md)，方案Review passed。失败锁存为每session内存Map；尚无证据证明原机JSON损坏或本实现主动删除其journal。

读取故障基线 `/tmp/issue73-read-before.log`：真实 chmod 后存在的 journal 被当成 null；修后同入口 EACCES、文件原字节与冷读保留。整体结果 `/tmp/issue73-final-regression.log`、`/tmp/issue73-node24.log`；范围有重叠不累加测试数。Node24 首次命令定位到了错误的 root Vitest 入口，改用本 package 的实际 Vitest 后18项真实通过；没有把启动失败当产品失败或通过。

真实模型验收 `/tmp/issue73-live.json`：`codex-sub/gpt-5.6-luna`，两次消息分别返回 `JRN73_NORMAL_MESSAGE_OK` 与 `JRN73_AFTER_RESTART_OK`，中间关闭并冷启动 store/coordinator/actor；冷历史4条，耗时6797ms。通过当前配置 owner 仅在内存解析现有认证，使用隔离 synthetic journal，不复制凭据、不改默认模型/原用户历史。临时 live test 已移除，未混入 CI 的普通测试集合。未直接验证反馈者原机或桌面界面点击。

## 发布/部署方式

验收与 Review 已具备。版本计划为 nextclaw0.59.5/kernel0.19.7/Desktop0.0.306，Changesets12项（含private，实际NPM包以publisher为准）。`EXISTING_RELEASE_PATH`：原 `release.yml target=all`，现有 npm-production/NPM_TOKEN 路径。修复提交 `02cc054440a66cde127b01375afe2ace13ad79f0` 已普通 atomic push 至 master 与任务分支；北京时间22:03触发有效父流程 [43602716658](https://github.com/Peiiii/nextclaw/actions/runs/43602716658)，target=all、expected_head 为此精确 SHA。Actions自行闭合 prepare/安装矩阵/Runtime/Desktop/公开投影，Agent不逐step轮询或gh run watch。

触发纠偏：首次43602685331错误手填 expected_head，被发布前 identity gate 拦截，已请求取消；未执行NPM发布。实际提交号由 `git rev-parse HEAD` 读取后重新触发同一源身份的有效parent。`AUTOMATION_INTERVENTIONS=1`（Agent触发参数错误→修正为实际SHA；流水线本身尚无人工恢复）。不为这次偶发手填疏漏新增规则或第二套publisher。

发布期间独立 `desktop-validate` 43602675948 Windows 旧壳回开验收失败；当前 candidate 首次冷开已找回同一条原始消息，随后0.44旧壳加载该runtime首次请求为空。修复前的上一次43595521551在完全相同脚本位置失败，证明不是本次产品补丁新引入。当前history API明确以 `preparation=queued/preparing` 返回暂空page，原smoke却只请求一次；在既有Windows smoke owner增加只对这些显式状态有界等待，failed/cancelled/超时及真实消息缺失仍报错。Windows focused路径复验中；不以本地16项closure回归替代真实Windows结果，不修改已冻结的产品代码或重复发布NPM。

双站 `pnpm deploy:docs:verify -- --expected-commit 02cc054440a66cde127b01375afe2ace13ad79f0` 已通过，同一tree `fab0a3babad75e91c5f84900304139448c8aa55723121e901f7b358c0db36159`。无cache-bust的国内CDN旧响应只作传播观察，不判为部署失败。

后续事实：0.59.5/kernel0.19.7已发布NPM，release commit为52f3bf90fcb20018f9461efd349f087a4aa5892a。parent43602716658在Runtime gate失败，因为精确源prepare43602675942当时未结束、随后成功；没有Runtime/公开Desktop完成证明。Windows focused43604136341新诊断明确 preparation=failed，缺`@libsql/win32-x64-msvc`，等待假设不充分，保留有效有界等待并修真正的native resource owner。新增目标nextclaw0.59.6/kernel仍0.19.7/Desktop0.0.307；非重复发布0.59.5。原0.59.5 Desktop draft无资产且未公开，发布新identity前安全撤掉未完成草稿，NPM与产品tag不动。

兼容修复定向21项回归通过；真实Node20.18.1隔离打包的SQLite owner在缺binding时MODULE_NOT_FOUND，复制原native resource owner产物后真实写入、关闭、冷开读取`JRN73_NODE20_HISTORY`成功，证据`/tmp/issue73-libsql-{before,after}.log`。Windows实际复验仍待完成；无发布后源码变更的伪验收。新增脚本diff维护性0error/2warning（既有目录16文件、资产owner401/500），边界复核接受必要的native合同检查，未新增文件或重复owner。

## 用户/产品视角的验收步骤

新版本入口待自动发布闭合。正常对话可落盘并在冷重启后读取；写失败时明确报错并停止当前运行，排队输入清空，后续发送明确拒绝；修正文件访问后退出并重新打开实例可续聊，已保存历史保持，其它会话可继续工作。参见双语 chat guide 新增“会话记录无法保存时”。

## 可维护性总结汇总

复用原 ingestion/coordinator/SessionRun/日志与恢复 owner，不新增第二套持久化、备用日志或绕过报错的写路径。首次维护性发现2项文件预算error：故障订阅移回活动runtime observer、原SessionPendingInputs类与类型原样移到独立队列模块并保留原类型出口，避免错误owner与继续混放。最终12文件diff检查0error/3warning：AgentRunRequest597/600（净+3必要路径）、SessionRun510/600（净-118）、journal store473/400（净0）；主观复核接受现有边界，不为预算压行或隐藏逻辑，无未关闭finding。定向ESLint0error/2个store既有warning。新路径preflight、新代码治理与ratchet通过，AGENTS/Skill/命令/baseline未改。

### 红区触达与减债记录

- `session-run.manager.ts`：从628降至510，队列原有状态owner独立成模块，actor保留运行/持久确认/故障终止职责；原队列/steering回归和native集成复验通过。
- `ncp-agent-session-journal.store.ts`：无净增长；只区分真实回滚写失败与显式拒绝并改回根公共type import。未为一次写故障扩展存储架构。

## NPM 包发布记录

需要新 stable patch；显式changeset为`@nextclaw/kernel`与`nextclaw`，依赖包按原publisher闭包跟随。当前未上传NPM；发布事实与精确版本以最终同一parent产物补录。
