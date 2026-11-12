# 上下文压缩失败恢复修复

## 迭代完成说明

实现及 AI 验收完成，正在交付发布。目标及 active contract 见[设计](../../designs/2026-11-13-context-compaction-failure-recovery.design.md)。用户明确要求先复现，完成验收后直接发布。flow=bugfix；task-id=dt-09b8e34a；retrospective_state=pending。

本次确认并修复：manual 收集器在异常时丢失失败事件、session manager 以有事件误判成功、soft 分支丢弃结构压力下的恢复候选、结构触发继续计入已覆盖原文。真实 actor 原本只同步提交 compressed，现将 failed/cancelled 一并在 actor 可见前持久提交。失败原因由原 checkpoint owner 保存，API 返回明确错误，正常供应商恢复后可重试成功。

旧版和当前失败基线位于 `/tmp/nextclaw-compaction-repro-HH56Aa/`：results.json 为旧版/当前摘要生成对照；boundary-results.json 为当前已有恢复持久化证据；current-failure.json 为当前假成功与结构重试失败基线。原始附件位于用户微信附件目录，未复制私有正文到公开仓库。

源码基线 802b1fe0c，主工作区只有既有 Bibo 文档 WIP，本任务无源区产品草稿。唯一写入位置为 Codex 管理的隔离 worktree，分支 `codex/compaction-failure-recovery`。未覆盖或迁移无关 WIP。

## 测试/验证/验收方式

当前 active ledger：CCF-01–05 passed；CCF-06 的本地验证与 Review passed，正式发布 pending。Required IDs 与定义沿设计原文，不重编号。

- [复现与修后两轮持久化](artifacts/reproduction.json)：785 条合成历史；旧版固定错误；当前假成功与重复失败修前基线；修后 coveredMessageCount 1075→1832→1890，每轮冷重载一致、原文可读、每轮一次 provider 调用。
- [组装 API](artifacts/api.json)：真实 preflight→manual manager→native runtime→SessionRun 持久提交→session manager→HTTP controller。空输出与 transport 异常均返回 409/CONTEXT_COMPACTION_FAILED，返回时冷加载已能读取原因；恢复 provider 后同入口返回 200。
- [真实模型及 native 续跑](artifacts/live.json)：codex-sub/gpt-5.6-luna，81 条合成历史，11.66 秒，未裁剪 provider 摘要，续跑精确返回任务标记并 run.finished。DeepSeek 曾真实生成未裁剪、自然完成摘要（6241 输入/419 输出），后续返回 402 余额不足；未修改账号或默认模型，不宣称原机或该供应商的完整续跑通过。
- core/kernel/server tsc 通过；server 依赖闭包构建通过；定向 lint 0 error，4 个原有 warning；新代码治理、backlog ratchet 通过。核心压缩 9 文件 65 项、HTTP 6 项通过；actor 持久化及结构边界补充后最终受影响 6 文件 49 项通过（范围有重叠，不相加）。原预算/取消/旧 checkpoint 保护均由相应回归覆盖。

真实模型诊断脚本最初重复应用 native runtime 已应用的事件，造成标记重复；按实际 runtime 合同修正观察器后取得上述通过证据，未将夹具错误当作产品缺陷。DeepSeek 402 保留为真实供应商失败，不做盲目付费重试。用户原始 journal 与原机响应未取得，这只限制原事故现场结论，不阻止已复现修复的交付。

## 发布/部署方式

验收后沿现有 `release.yml target=product` 单次 dispatch，覆盖 NPM、stable Runtime、旧版升级与内容闭环；未请求 desktop installer，不扩展为全平台安装包发布。

## 用户/产品视角的验收步骤

在已有长会话运行 `/compact`：失败应显示具体原因并保留旧检查点；修正 provider 后再次执行应成功。结构/硬预算压力下应进入可验证恢复，读取原历史后继续当前任务。

## 可维护性总结汇总

实现 Review 无未关闭正确性 finding。复用原 owner 和事件持久化路径，不增加压缩服务、轮询器或配置开关；公开错误变体经组装 HTTP 消费验证。

diff-only 自动维护性检查有 1 个 error 预算信号、2 个 warning，未伪称脚本通过：SessionRun 已超 600 行，本次净增 1 行触发预算；该行增长用于同一个终态提交点，拆出只转发的 helper 会增加跳转并割裂 actor 提交顺序。人工复核接受此必要增长；另两项为现有 preflight/utils 近预算。未为指标压行、删测试或扩大重构。

提交前治理发现触达文件既有深层 feature import 与重复 params 读取，均修回既有 barrel 和同函数解构，不改规则或 baseline。

## NPM 包发布记录

尚未发布，版本由原发布 owner 根据冻结 changeset 确定。

### 0.59.4 发布执行与恢复

第二个独立恢复根因：43266715710在准备阶段明确失败，`remote-only=4, local-only=0`；原流程把已发布身份的旧源码恢复送入“新发布必须同步master”的门。未放宽该门。改原prepare workflow按精确artifact名称找未过期原包，调用原import验证与恢复版本树，再准备Runtime；无同源产物时仍走原新发布路径，错误产物明确失败。新增真实Git反例在远程主线已前进时导入旧SHA原artifact，并复验原source/版本/正文/包校验；不再重新打包已发布NPM。`AUTOMATION_INTERVENTIONS=2`，此为第二个根因的原owner修复，等待同一0.59.4恢复验证。

`EXISTING_RELEASE_PATH`：release.yml target=product，npm-production/NPM_TOKEN，最近成功 parent39306362156。当前 parent43262190699 于北京时间 00:45:49 单次 dispatch，冻结源码82c79ee8f2；prepare43262148717。NPM job131336674846 于00:46:45–01:01:05成功，860秒，time budget: missed；包含等待精确41包闭包产物与发布验证，不等同于纯registry上传耗时。NPM latest已实读0.59.4，core0.18.9/kernel0.19.6，release commit784f2009fa。内容提交022ec47a6及合并c97290f370已进入远程master。

macOS ARM四个安装单元被runner调度直接cancelled，job131345771477的check annotation为`The configuration 'macos-14-arm64-us-default' is not supported`，不是产品测试失败。GitHub官方已退役此镜像；按原runner配置迁移15并恢复同一0.59.4。`AUTOMATION_INTERVENTIONS=1`，根因是外部runner生命周期，修回既有工作流与兼容矩阵，并以已取消ARM单元补恢复回归；不重发NPM、不跳过ARM、不降级验收。

控制平面修复3ce342fcae已进入远程master：actionlint、36项发布合同、ESLint及局部维护性检查0error/0warning通过。原parent43262190699终态cancelled，12个非ARM实装成功；Runtime推广正确跳过。原prepare43262148717的ARM构建同样被调度取消，整体不可能成为可推广集合；在NPM已完成后请求取消其剩余非发布构建，释放同源concurrency锁。通过原npm-release-prepare入口单次恢复43266715710，control plane3ce342fcae、source_sha仍为82c79ee8f2，dispatch_id=ccf-0594-macos15-recovery。此准备不会上传NPM；待完整Runtime集合就绪后，原release入口按已发布0.59.4恢复，复用成功安装单元。以上动作均属同一runner退役根因，干预数仍为1。

文档部署43265714701成功：国际/国内manifest均为c97290f370fca60d3d9a60a92320861d27a1bcbe，tree8890981a9591181796e275aa5fe7dcdf9c9f040074f29524dce6eaa3415595d4；两站中英文0.59.4页面及JSON均200，JSON逐字段等于源码，国际CORS=*。国内镜像没有CORS，非产品默认跨域读取入口，未冒充该项通过。原验证命令误传短SHA产生commit mismatch，改用实际完整SHA后原owner验证通过，未改站点或降低校验。

主线协调器已返回LOCAL_WORKTREE_RETRYING并启动worker68897，原因是primary原有Bibo文档WIP；远程master已含本任务源码/版本/内容，无reset/stash/rebase或覆盖。当前仍待Runtime准备、ARM实装恢复、channel与旧版升级终态；retrospective_state=pending。

旧本地三个无关历史tag与远程存在差异，普通fetch拒绝覆盖；本次0.59.4及依赖新tag成功取得，未强制更改无关tag。Runtime、macOS ARM安装与最终旧版升级仍pending，不能将NPM_READY写成整个任务完成。
