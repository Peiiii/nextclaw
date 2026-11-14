# 上下文压缩失败恢复修复

## 2026-11-14 桌面端补发（已完成）

用户明确要求“如果漏发了赶紧发”，并要求使用现有全自动流程，不让 AI 手工拼接发布步骤。实际核对桌面 stable 仍为 `v0.59.1-desktop.1`，上次 `target=product` 没有生成桌面安装包。本节扩展原交付范围，不改写下方 0.59.4 产品发布的历史证据。

- active-contract：`CCF-20261113` 桌面补充；parent-goal：桌面用户通过正式安装/更新入口获得已验证的 0.59.4 压缩修复；scope-revision=2，scope-confirmation=user-confirmed。
- flow=bugfix；task-id=dt-c6f49e21；phase=retrospective；retrospective_state=completed；parent_status=ready-for-completion-check。
- 唯一发布 owner：现有 `release.yml target=all`，北京时间 19:43:15 单次触发 [parent 43591358194](https://github.com/Peiiii/nextclaw/actions/runs/43591358194)，冻结控制平面 `33de0a53caa1625f878020a5fe8af2a8f02614e2`。由父流程识别已发布身份、复用 NPM/Runtime 并自动推进 Desktop，不另发 NPM 或手工分配 Desktop 身份。
- 开始时任务 worktree 无改动，仅将已存在的两个远程指标提交快进纳入；原主工作区 WIP 不动。代码复用已验证修复，本次目前只更新同批日志。
- 验收合同 Review：发布完成须同时有正式资产、更新投影及父流程终态；单独 Draft、子流程构建成功或本地命令结束均不算完整。没有删除原验收项或降低平台覆盖。

| ID | Required | Status | 当前证据/完成条件 |
| --- | --- | --- | --- |
| CCF-07 | true | passed | child 43592691233 五平台构建/安装启动冒烟通过，精确 0.59.4 Runtime/0.0.305 Desktop 和 30 资产校验后公开 v0.59.4-desktop.1 |
| CCF-08 | true | passed | child 43595954511 APT fresh-install/upgrade 和 Pages 部署通过；五平台公开 manifest、官网 stable 下载 JSON、APT source/原包 HEAD 均实际读回一致 |
| CCF-09 | true | passed | parent 43595530154 整体 success/ALL_PLATFORMS_READY，官方 all proof 已逐字段验证，原主线协调 worker 继续保护 WIP；原 owner 修复及复盘完成 |

当前 open-required：无。`AUTOMATION_INTERVENTIONS=2`（初始触发与只读监控不计）。

最终结果：**DESKTOP_READY / ALL_PLATFORMS_READY**。正式 [NextClaw Desktop 0.0.305](https://github.com/Peiiii/nextclaw/releases/tag/v0.59.4-desktop.1) 内含 Runtime 0.59.4，五平台 30 资产，stable 非 prerelease，安装包 target `24537b34081c6fd529c0c9a17897303c1f38b99a` 始终未变。恢复 [parent 43595530154](https://github.com/Peiiii/nextclaw/actions/runs/43595530154) 从控制平面 `7effddaaa8ce759792cb26c7e1394ddd078b7b7b` 于北京时间 20:34:52 启动，20:43:39 输出 DESKTOP_READY，最终所有 job success。官方 artifact `feedback-release-0.59.4-784f2009faac5b482f2ac1e4131ccb0af5af0897-all` 解包逐字段相等：`{"version":"0.59.4","sha":"784f2009faac5b482f2ac1e4131ccb0af5af0897","target":"all","runId":"43595530154"}`。

APT-only [child 43595954511](https://github.com/Peiiii/nextclaw/actions/runs/43595954511) 20:40:16–20:43:29，结构化 `nextclaw.desktop-release/v1` wallMs=193000；APT job 150 秒（最慢 fresh-install 64 秒），Pages 部署 job 35 秒。构建/资产上传/Release 公开/更新分支步骤均按既有 checkpoint 跳过，没有重建五平台或新建 Desktop tag。五平台原构建证据仍归 child43592691233，不以恢复 run 的 skipped 冒充新构建。

公开复验：五份 stable manifest 均为 HTTP200/latestVersion0.59.4/floor0.0.141，bundle URL 均指向同一 Desktop tag，notes URL 为对应 0.59.4 文档；`desktop-downloads/stable.json` 指向 app0.0.305 及同一正式 Release。APT package-source 指向原始 `nextclaw-desktop_0.0.305_amd64.deb`，size142418242/SHA256 `98eea7ae152e988c558e2463c2320073220bbcf78212e0ae19caa0a204790940`；公开原包 HEAD200/Content-Length142418242。原 owner 验签/哈希与 CI fresh-install/upgrade 均通过；未再裁剪 seed 或改变原安装包。

`retrospective_decision=updated-existing-owners`：修复首次 Desktop source 选择与已公开身份重入；删除迁移到 Release/Pages artifact 后残留的重压缩消费者，原 APT builder/发布和验证 workflow/对应回归/自动化 reference 一起更新。AGENTS、入口/skill 数、discovery 和 baseline 未增长；不把一次入口选择不足另写全局“务必”规则。用户原机与桌面界面实际点击发消息仍未直接验证；本次证明五平台实包装配、安装启动、已有真实模型续跑证据和公开安装/更新交付，范围不混淆。原主工作区 WIP 保留，LOCAL_WORKTREE_RETRYING 已由 worker60750 自动接管，不伪称本地主线已同步。

19:45 首次 parent 失败：内置 token 已有 actions/contents write，但 `gh release create` 对旧产品 SHA 返回 403。旧提交相对默认分支包含旧 workflow tree，GitHub API 明确要求内置 token 无法取得的 workflows write。没有创建 Draft/tag，没有重发 NPM。对应真实 Git 源码选择回归修前 2 项失败，定位到原 resolver 追溯历史 target。方案和 Review 已补入原设计；修复原 preflight/recovery/prepare owner，首次选择经过 Runtime gate 的当前冻结 SHA，同 shipping 已公开身份按原 target/tag 复用，保留 Draft-first 与原生产验证。`AUTOMATION_INTERVENTIONS=1`，消除落点是原入口及回归，不新增令牌、发布器或人工发布路径。

修复验证：发布相关 3 文件 48 项回归通过，包含真实 Git workflow tree 前进后的首次 target、控制流程变化后的既有身份复用、Desktop shipping 更新、未发布 Runtime/依赖拒绝和 public/APT checkpoint prepare；Desktop `tsc`、5 文件定向 ESLint、actionlint、新代码治理、backlog ratchet、skill progressive loading 均通过。工作区最初缺 Desktop 依赖，按锁文件恢复后 `tsc` 实际通过，没有用缺工具的退出状态冒充成功。diff maintainability 5 文件 0 error/0 warning，非测试源码净增 7 行；主观复核确认复用原 preflight gate/恢复/prepare owner、未引入新入口，无未关闭 finding。

治理仅同步既有 Desktop 自动化 reference：AGENTS 11989 bytes、16 个 discovery skills、29 个 grouped Wiki skills、description 1510 chars、discovery 2916 chars、入口 2941 bytes 均未改变；未新增规则、命令、脚本文件或 baseline。原主工作区 8 项 Bibo 文档 WIP 与上批相同，未触达。

修复提交 `24537b34081c6fd529c0c9a17897303c1f38b99a` 已进入远程 master 和任务分支；北京时间 19:55:03 以同一业务入口触发 [parent 43592263799](https://github.com/Peiiii/nextclaw/actions/runs/43592263799)，expected_head 为该完整 SHA。父流程已复用 NPM/16 组安装证据，并成功创建隐藏 `v0.59.4-desktop.1`，Desktop app 0.0.305，target 精确为该冻结 SHA；原 403 失败点实际通过。NPM 产品 tag 仍为 `784f2009faac5b482f2ac1e4131ccb0af5af0897`，产品 packages/lockfile 无差异。当前等待 Runtime 验证及后续 Desktop child，尚未公开桌面版；CCF-07–09 保持 not-run。

第二次 parent 的 [Desktop child 43592691233](https://github.com/Peiiii/nextclaw/actions/runs/43592691233) 五平台全过，30 资产已校验并正式公开，target 未变；随后 APT 于北京时间 20:27:08 失败，142418242 字节 `.deb` 仍被旧逻辑裁剪/重压缩至 117057044 字节后错误施加 Git 的 100 MiB 门。实际二进制已通过 Release→SHA256→Pages artifact 输送，不入 Git。删除原 builder 的过期 flag/裁剪/重压缩分支，同步正式与验证 workflow，并直接引用原 Release 资产，不上传多余 `.pages.deb`。恢复 owner 将唯一的下游 APT builder 按实际角色识别为投影脚本，避免误触发 Desktop 重建。`AUTOMATION_INTERVENTIONS=2`，根因为存储链迁移后遗留的旧消费者；落点为原 APT owner、工作流及对应测试，不降低真实尺寸或哈希验收。

APT 修前定向 20 项中 2 项失败；修后发布相关 5 文件 68 项全过，包括 101 MiB 原包经过真实 metadata/source/artifact 组装后字节哈希一致，以及控制平面/APT-only 变化的原身份复用。Desktop tsc、targeted ESLint、actionlint、新代码治理通过；diff maintainability 0 error/0 warning，非测试源码净减 100 行。方案 Review 与实现复核无未关闭 finding；本机无运行中的 Linux Docker daemon，不冒充本地 APT fresh-install 通过，交给原 CI 同一资产的 fresh-install/upgrade smoke 实测。主线协调已复用 worker60750，LOCAL_WORKTREE_RETRYING，原 WIP 未触达。

## 迭代完成说明

**NextClaw 0.59.4 已完整发布，全部 Required 验收通过。** 目标及 active contract 见[设计](../../designs/2026-11-13-context-compaction-failure-recovery.design.md)。用户明确要求先复现，完成验收后直接发布。flow=bugfix；task-id=dt-09b8e34a；retrospective_state=completed；parent_status=ready-for-completion-check。

本次确认并修复：manual 收集器在异常时丢失失败事件、session manager 以有事件误判成功、soft 分支丢弃结构压力下的恢复候选、结构触发继续计入已覆盖原文。真实 actor 原本只同步提交 compressed，现将 failed/cancelled 一并在 actor 可见前持久提交。失败原因由原 checkpoint owner 保存，API 返回明确错误，正常供应商恢复后可重试成功。

旧版和当前失败基线位于 `/tmp/nextclaw-compaction-repro-HH56Aa/`：results.json 为旧版/当前摘要生成对照；boundary-results.json 为当前已有恢复持久化证据；current-failure.json 为当前假成功与结构重试失败基线。原始附件位于用户微信附件目录，未复制私有正文到公开仓库。

源码基线 802b1fe0c，主工作区只有既有 Bibo 文档 WIP，本任务无源区产品草稿。唯一写入位置为 Codex 管理的隔离 worktree，分支 `codex/compaction-failure-recovery`。未覆盖或迁移无关 WIP。

## 测试/验证/验收方式

当前 active ledger：CCF-01–06 全部 current passed，正式发布证据见下文和[官方终态 proof](artifacts/release.json)。Required IDs 与定义沿设计原文，不重编号。

- [复现与修后两轮持久化](artifacts/reproduction.json)：785 条合成历史；旧版固定错误；当前假成功与重复失败修前基线；修后 coveredMessageCount 1075→1832→1890，每轮冷重载一致、原文可读、每轮一次 provider 调用。
- [组装 API](artifacts/api.json)：真实 preflight→manual manager→native runtime→SessionRun 持久提交→session manager→HTTP controller。空输出与 transport 异常均返回 409/CONTEXT_COMPACTION_FAILED，返回时冷加载已能读取原因；恢复 provider 后同入口返回 200。
- [真实模型及 native 续跑](artifacts/live.json)：codex-sub/gpt-5.6-luna，81 条合成历史，11.66 秒，未裁剪 provider 摘要，续跑精确返回任务标记并 run.finished。DeepSeek 曾真实生成未裁剪、自然完成摘要（6241 输入/419 输出），后续返回 402 余额不足；未修改账号或默认模型，不宣称原机或该供应商的完整续跑通过。
- core/kernel/server tsc 通过；server 依赖闭包构建通过；定向 lint 0 error，4 个原有 warning；新代码治理、backlog ratchet 通过。核心压缩 9 文件 65 项、HTTP 6 项通过；actor 持久化及结构边界补充后最终受影响 6 文件 49 项通过（范围有重叠，不相加）。原预算/取消/旧 checkpoint 保护均由相应回归覆盖。

真实模型诊断脚本最初重复应用 native runtime 已应用的事件，造成标记重复；按实际 runtime 合同修正观察器后取得上述通过证据，未将夹具错误当作产品缺陷。DeepSeek 402 保留为真实供应商失败，不做盲目付费重试。用户原始 journal 与原机响应未取得，这只限制原事故现场结论，不阻止已复现修复的交付。

## 发布/部署方式

已沿现有 `release.yml target=product` 完成 NPM、stable Runtime、旧版升级与内容闭环；按同一0.59.4 checkpoint恢复，没有重复发布NPM。未请求Desktop installer，未发布新的桌面安装包。

## 用户/产品视角的验收步骤

通过 stable Runtime 更新通道或 `npm install -g nextclaw@latest` 升级至0.59.4，在已有长会话运行 `/compact`：失败应显示具体原因并保留旧检查点；修正 provider 后再次执行应成功。结构/硬预算压力下应进入可验证恢复，读取原历史后继续当前任务。参见[更新说明](https://docs.nextclaw.io/zh/notes/2026-11-13-nextclaw-v0-59-4)。

## 可维护性总结汇总

实现 Review 无未关闭正确性 finding。复用原 owner 和事件持久化路径，不增加压缩服务、轮询器或配置开关；公开错误变体经组装 HTTP 消费验证。

diff-only 自动维护性检查有 1 个 error 预算信号、2 个 warning，未伪称脚本通过：SessionRun 已超 600 行，本次净增 1 行触发预算；该行增长用于同一个终态提交点，拆出只转发的 helper 会增加跳转并割裂 actor 提交顺序。人工复核接受此必要增长；另两项为现有 preflight/utils 近预算。未为指标压行、删测试或扩大重构。

提交前治理发现触达文件既有深层 feature import 与重复 params 读取，均修回既有 barrel 和同函数解构，不改规则或 baseline。

## NPM 包发布记录

已发布 nextclaw@0.59.4 / latest；core@0.18.9、kernel@0.19.6 随同依赖闭包交付。没有重复上传 NPM、移动已发布 tag 或另起产品版本掩盖恢复问题。

### 最终终态与复盘

- **NEXTCLAW_STABLE_READY 0.59.4**：[parent43274017032 attempt2](https://github.com/Peiiii/nextclaw/actions/runs/43274017032)于北京时间02:22:06全部成功；00:45:49首次正式发布dispatch至终态共5777秒，主要等待冷构建、runner退役恢复与ARM排队。恢复parent本身01:52:42–02:22:06共1764秒；最初860秒NPM job含精确产物准备等待，明确time budget: missed。恢复NPM checkpoint job仅44秒；未再次上传包。
- 官方终态artifact已下载并逐字段验证：version0.59.4、sha784f2009faac5b482f2ac1e4131ccb0af5af0897、target product、runId43274017032。不可变产品初始源码82c79ee8f2；最终publisher控制平面8ab4df1177；Runtime准备control plane35d5d9222e，两者均明确消费原源码产物。
- 实装证据16组闭合：初始parent的Linux/macOS Intel/Windows共12组，恢复parent真实完成4组带`@0.59.4`身份的macOS ARM。Node24于02:16:56获runner，02:17:54通过。Node22在原attempt于02:04:26获runner并02:05:26完成，早于取消请求；不能把它的成功归因于重排。第四项干预的调度根因未确认，不新增猜测性的runner fallback或无限重试。
- Runtime推广与公开验证02:18:42–02:20:14共92秒，在120秒目标内；真实上一稳定版升级验证02:20:14–02:21:48共94秒通过。四平台公开manifest均实读200/0.59.4/hostKind=npm-runtime-bundle/floor0.18.11，releaseNotesUrl指向同一GitHub Release，四个zip资产完整。没有把整个job234秒冒充promotion耗时。
- [GitHub Release](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw@0.59.4)已由原owner发布四平台资产，双语正文用准备好的notes文件更新并完整回读一致；不含内部测试/治理噪音。双语文档页与JSON的国际/国内部署证据见本日志。此为常规product发布，无Desktop安装包、Bibo部署或社交发布；没有触达需要migration的新持久schema，也没有改变自管理CLI命令/USAGE资源。
- branch closure检查通过：远程master包含功能、已发布版本和后补内容，无release-only功能源码；主工作区原Bibo文档WIP保持，LOCAL_WORKTREE_RETRYING由原协调器worker接管。临时验证不写原用户会话；本任务产物全部在隔离worktree及对应提交内，最终记录同批提交推送后清理owned worktree。
- `retrospective_decision=updated-existing-owners`：产品错误落实为真实actor持久化/HTTP回归及结构边界测试；runner生命周期修回现有配置；已发布身份的准备复用原artifact验证owner；兼容证据绑定版本与精确源码。方法本身已有先复现和整体完成门，最初停在核验属于执行不足，不再堆新的全局提示词。CI合同测试增加后触发的statement预算已按“来源绑定/准备恢复”拆回原内聚测试，未放宽阈值；最终相关37项、ESLint、actionlint与局部维护性0error/0warning。产品SessionRun既有超预算文件净增1行的人工接受仍如实保留，不改称脚本通过。
- `AUTOMATION_INTERVENTIONS=4`：退役runner、旧源码准备复用、跨版本证据隔离、队列有界重排；前三项有原owner修复和回归，第四项使用原恢复入口，未把第三方未知原因固化为产品规则。整体无开放Required缺口；原反馈机器未接入，不能声称已直接验证该原机会话。

### 恢复过程（历史）

当时的恢复现场：prepare43268581572（control plane35d5d9222e，冻结source82c79ee8f2）已整体成功，原NPM artifact复用/完整性恢复及四平台Runtime均通过；Mac Intel最后完成的是Rust缓存post步骤。identity修复b19c0d295a与等义正则lint修正8ab4df1177通过actionlint、37项回归、ESLint和局部维护性0error/0warning。恢复parent43274017032于01:52:42从8ab4df1177 dispatch，正确只补4个`@0.59.4` ARM单元；Node20/26已通过，Node22/24长期queued，项目没有其它in_progress run，check无失败注释，GitHub公共状态正常，不能宣称第三方调度根因已知。使用原failed-only入口有界重排一次，保留14个有效实装结果与NPM checkpoint；同run attempt2，仍待终态。`AUTOMATION_INTERVENTIONS=4`，第四项是队列停滞的安全重排，未改平台、版本或验收标准。flow=bugfix，phase=delivery，retrospective_state=pending，CCF-06 pending。

第三个验收根因：恢复前审查确认旧ancestor筛选与未带版本的job名会将旧版实装success归入当前身份。先执行原resolver：16个prior-version-source旧格式success错误返回reused=true。修回原resolver/生产workflow，目标版本具名，旧格式仅精确初始SHA可复用，较旧祖先排除、当前release之后的正确版本恢复可复用；CLI缺目标身份明确失败。负例与producer合同一并回归。`AUTOMATION_INTERVENTIONS=3`；不以旧版矩阵代替本次ARM验收。

第二个独立恢复根因：43266715710在准备阶段明确失败，`remote-only=4, local-only=0`；原流程把已发布身份的旧源码恢复送入“新发布必须同步master”的门。未放宽该门。改原prepare workflow按精确artifact名称找未过期原包，调用原import验证与恢复版本树，再准备Runtime；无同源产物时仍走原新发布路径，错误产物明确失败。新增真实Git反例在远程主线已前进时导入旧SHA原artifact，并复验原source/版本/正文/包校验；不再重新打包已发布NPM。`AUTOMATION_INTERVENTIONS=2`，此为第二个根因的原owner修复，等待同一0.59.4恢复验证。

`EXISTING_RELEASE_PATH`：release.yml target=product，npm-production/NPM_TOKEN，最近成功 parent39306362156。最初 parent43262190699 于北京时间 00:45:49 单次 dispatch，冻结源码82c79ee8f2；prepare43262148717。NPM job131336674846 于00:46:45–01:01:05成功，860秒，time budget: missed；包含等待精确41包闭包产物与发布验证，不等同于纯registry上传耗时。NPM latest已实读0.59.4，core0.18.9/kernel0.19.6，release commit784f2009fa。内容提交022ec47a6及合并c97290f370已进入远程master。

macOS ARM四个安装单元被runner调度直接cancelled，job131345771477的check annotation为`The configuration 'macos-14-arm64-us-default' is not supported`，不是产品测试失败。GitHub官方已退役此镜像；按原runner配置迁移15并恢复同一0.59.4。`AUTOMATION_INTERVENTIONS=1`，根因是外部runner生命周期，修回既有工作流与兼容矩阵，并以已取消ARM单元补恢复回归；不重发NPM、不跳过ARM、不降级验收。

控制平面修复3ce342fcae已进入远程master：actionlint、36项发布合同、ESLint及局部维护性检查0error/0warning通过。原parent43262190699终态cancelled，12个非ARM实装成功；Runtime推广正确跳过。原prepare43262148717的ARM构建同样被调度取消，整体不可能成为可推广集合；在NPM已完成后请求取消其剩余非发布构建，释放同源concurrency锁。通过原npm-release-prepare入口单次恢复43266715710，control plane3ce342fcae、source_sha仍为82c79ee8f2，dispatch_id=ccf-0594-macos15-recovery。此准备不会上传NPM；待完整Runtime集合就绪后，原release入口按已发布0.59.4恢复，复用成功安装单元。以上动作均属同一runner退役根因，干预数仍为1。

文档部署43265714701成功：国际/国内manifest均为c97290f370fca60d3d9a60a92320861d27a1bcbe，tree8890981a9591181796e275aa5fe7dcdf9c9f040074f29524dce6eaa3415595d4；两站中英文0.59.4页面及JSON均200，JSON逐字段等于源码，国际CORS=*。国内镜像没有CORS，非产品默认跨域读取入口，未冒充该项通过。原验证命令误传短SHA产生commit mismatch，改用实际完整SHA后原owner验证通过，未改站点或降低校验。

主线协调器已返回LOCAL_WORKTREE_RETRYING并启动worker68897，原因是primary原有Bibo文档WIP；远程master已含本任务源码/版本/内容，无reset/stash/rebase或覆盖。当时仍待Runtime准备、ARM实装恢复、channel与旧版升级终态；retrospective_state=pending。

旧本地三个无关历史tag与远程存在差异，普通fetch拒绝覆盖；本次0.59.4及依赖新tag成功取得，未强制更改无关tag。Runtime、macOS ARM安装与最终旧版升级仍pending，不能将NPM_READY写成整个任务完成。
