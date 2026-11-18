# Issue #73 会话日志持久化故障

## 2026-11-18 复现并修复手动压缩无法前进

作者的 [0.59.10 复现](https://github.com/Peiiii/nextclaw/issues/73#issuecomment-6942044029) 显示提供方正常结束后，删节输入触发失败，原检查点迟迟不能前进。对原 0.59.10 发布 commit 检查受影响源码一致。合成 640 KB 来源在 1,048,576 token 模型设置下重现：测试先红，实际状态 failed，finishReason=stop、sourceTruncated=true、recovery=provider-summary。修后从零覆盖恢复标记继续，保留归档待核实状态，检查点推进；加入新消息后第二次真实计划不再把同一条已覆盖长消息作为原文送入摘要。最终模型预算门保持。原路径无客户正文。

新增安全日志记录候选检查点、原界限、读取与选择记录数、预算、恢复结果。通过真实 journal 的失败路径确认旧检查点保持、失败条目落盘、提供方恢复后压缩成功。测试同时验证可提取模型声明的上限及实际请求 token 数，且诊断不含响应正文。HTTP 路由已验证受控压缩失败返回结构化 409；客户收到纯文本 500 的外层原因待其当时的 service 日志。旧版 EPERM 已确认 metadata 原子替换阶段，Windows 拒绝该操作的条件待核。针对两个问题仅索取可查的摘要时间线与短日志窗口，已回读 [Issue 评论](https://github.com/Peiiii/nextclaw/issues/73#issuecomment-6971752412)。

73 项 kernel 测试及 6 项 HTTP 测试通过，kernel tsc、治理、文档构建和双语检查通过。恢复标记与第二次计划加强后的 13 项连续性测试复验通过，与 73 项有重叠。既有日志服务及文件 sink 的 14 项回归通过。设计与实现审查通过，维护性 0 错误，preflight service 保留近预算警告。

0.59.11 已完整发布。唯一 [all 父流程](https://github.com/Peiiii/nextclaw/actions/runs/44257848208) 在 15:18:28–16:22:29 北京时间首轮成功，历时 64 分 01 秒。冻结源 5c29ef67d9d21940853998c872d4ee384b90ef1b，版本提交与公开桌面目标 7d0ceb35605822d7ee168ca77a30ef2ddbebf2ef。NPM_READY 15:32:50，耗时 14 分 22 秒，60 秒目标未达。新版本的四平台各四 Node 安装/SQLite 验证全过，Windows 是最长一组。Runtime 公开 manifest 正确，桌面 [child](https://github.com/Peiiii/nextclaw/actions/runs/44262002839) 五平台构建与安装冒烟通过，Intel Mac 为最长构建。桌面 0.0.312 公开版的 30 个资产名、非空状态及目标通过校验，Windows x64 安装包 200564996 字节。公开两类 stable manifest 为 0.59.11，APT 为 0.0.312，发行说明 JSON 为 0.59.11。

国内站私有 OSS 归档停留 49 分钟，取消原文档 run 后只重试原国内部署 job，同一 [Docs run](https://github.com/Peiiii/nextclaw/actions/runs/44257830732) attempt2 成功。双站 commit/tree 核验通过，tree 为 2dfdd594076765eef1a7ef157b12c0c4c7acce33ec9670c26a4c51d04697700b。产品父流程零人工续跑，独立文档恢复一次。取消前日志未给出可核实的 OSS 根因，暂不修改超时或发布流程。复盘把可复用诊断直接落到原压缩管理器，继续追踪原机检查点来源、纯文本 500 的外层异常与 0.59.1 EPERM 系统拒绝原因。已发送并回读 [下载与日志回执](https://github.com/Peiiii/nextclaw/issues/73#issuecomment-6973176745)，Issue 保持开放。

## 当前交付状态：2026-11-17 11:27（scope revision 8）

0.59.10已完成NPM/Runtime/Desktop/文档/更新渠道/APT公开发布；最终all parent [43938566446](https://github.com/Peiiii/nextclaw/actions/runs/43938566446) success，03:21:56–03:28:00，控制源d8f78d74aec2f7501c29fff1e0625e18f0c8d03c。冻结产品源8e7849ace2af4722323236af9d397e5c19f75f51、NPM/桌面tag目标325f259f3a25aa1de6d3945a0619414c12a3ec67、Desktop0.0.311均保持；没有再发新产品身份。Windows安装包及其它平台入口见[公开Release](https://github.com/Peiiii/nextclaw/releases/tag/v0.59.10-desktop.1)。

JRN-21/22/23/24=passed。[新增分组资格44008561614](https://github.com/Peiiii/nextclaw/actions/runs/44008561614)于11:12:43–11:27:05首轮success，控制源9932f53de62638707c63bdbe822d1cf6d43ae35e；逐step核对四个平台各四个Node安装/SQLite校验共16项全部success，Mac ARM原外部阻塞已解除。原JRN-09=unverified，Issue保持open。phase=finishing，retrospective_decision=updated-original-owners，retrospective_state=completed（本轮JRN-21至24交付与补验）；原始事故首因调查没有因此完成。

## 2026-11-17 11:27 自动发布范围核对与剩余验收闭合

用户继续追问自动化范围。原release.yml的完整发布入口target=all已覆盖NPM、安装兼容门、Runtime、Desktop、更新渠道/APT及公开复核；NPM不是独立漏项，registry dist-tag latest实际仍0.59.10。原最终all parent43938566446已验证整链成功，无需重复发布产品。

本轮写前HEAD9932f53de/worktree clean，仅补原JRN-24缺失实证。先确认此前容量故障后，desktop-validate43940563847的Mac安装冒烟已在03:39:11–03:44:53取得runner并success，环境条件已改变；11:12:43从原只读资格入口启动44008561614，对已发布nextclaw0.59.10验证，不越过旧run的4次上限。此轮首次即取得全部四个runner：Linux四版本11:14:55完成、Mac ARM11:15:18完成、Intel Mac11:19:55完成、Windows11:27:04完成；run11:27:05 success，共14分22秒。逐step确认Node20.19.0、22.19.0、24、26的实际安装与SQLite校验全部成功，无reused占位或跳过项，原OS/架构标签未变。证据摘要/tmp/issue73-05910-coalesced-accepted.json及Actions原run。

本轮没有产品或流程源码改动、没有新changeset/版本，不增加发布器、权限开关、定时任务或规则。既有失败分类与持续有界恢复owner保持；健康条件下取得全部16组合的真实CI证据，补齐原验收，不为相同风险重复跑其它已通过测试。此前发布7次受控介入仍为历史事实，不能把本次资格首轮通过写成原发布全程零介入。复盘无新增方法缺口：原owner修复已在前轮落地，此轮只更新事实及关闭未验证项；原首次停写/文件缺失原因仍缺现场证据，Issue73最新无新增作者评论，保持开放。

## 2026-11-17 00:23 新反馈返工（scope revision 8历史起点）

反馈：新窗口可工作，旧会话16:00–16:14反复Session journal write failed / Cause Invalid compacted message part boundary，run中止、HTTP500。时区和实际版本尚未证实，客户AI的文件损坏解释待核实，不当作事实。异步请求最小脱敏首次堆栈/实际版本；Issue当前无新作者评论。flow=bugfix，phase=design，retrospective_state=pending。HEAD0f79cfd66/worktree原clean，新增改动仅本轮原resilience测试与设计/日志；主区旧WIP不动。

JRN-21 required red：真实源journal/SQLite/readRunWindow/model projection复现同文错误，24分段大user消息退为16part预览却没有partial标记，assistant对照通过，/tmp/issue73-compact-boundary-before.log。原始legacy assistant尝试未命中，不能算复现；夹具漏prepare的null断言已修正，无产品变更。JRN-22 required not-run：提交后summary异常误锁链路已源码追踪，待原入口红基线。JRN-23 required not-run：正确读取与续聊、冷开、全平台发布。原JRN-09仍unverified，本轮不替代原事故首因证明。正式设计/Review见原design scope8。

00:53验收与Review：JRN-21/22 passed，JRN-23功能部分passed/发布待执行，phase=delivery。用户明确回答版本/堆栈“没有”，不再重复索要。真实native/client/SessionManager红基线/tmp/issue73-summary-boundary-before.log同文SessionJournalWriteError、source提交后summary preview抛错触发ingestion锁；修后两次失败发消息均完成，单次诊断；健康发布清抑制后再失败重新诊断，四组user/assistant冷读一致，真实EACCES/ENOSPC仍拒绝。

最终kernel7文件68项通过（14.66秒），匹配tsc通过；新fixture从describe移出、将本轮压缩数据准备放独立fixture函数后，原native11项再次通过；最终仅参数局部只读重命名后该6项及tsc复验通过，不叠加测试次数。v12/v13实际坏parts/offset派生SQLite升级v14，原journal不变；user/assistant/service部分预览坐标重复投影稳定、尾小文本可见、已知source范围外仍拒绝且诊断不含正文。最初9MB Buffer用toEqual导致JS逐字段比较超5秒，改原生Buffer.equals保留完整字节判定，11秒矩阵恢复通过，未放宽超时门。

真实模型：codex-sub/gpt-6-luna，旧v1 checkpoint+24part/约9.6MB原用户消息，真实native链自动建立有原来源验证的恢复checkpoint；read_file读约37KB文件末尾未知nonce、exec真实shasum -a256、write_file报告，回复/报告均与独立crypto SHA相符。冷关闭重建、换新nonce及内容后重复通过，6次实际工具调用，60.765秒，/tmp/issue73-boundary-live.json及.log。初始fixture遗漏captureCompactionSource被正确拒绝，补接生产SessionManager真实capture后通过，未移除来源保护。认证只经LocalConfigStore内存解析，业务全synthetic，无真实会话/凭据复制；临时联网代码已清除，常规测试无网络凭据依赖。

实现Review闭合：部分标记覆盖所有role，source坐标实际交集与indices同步；part的2K预算按最多16段分配、保留type，metadata独立；旧索引14迁移重放源；摘要owner单独诊断且不影响canonical写入，非法源及真IO仍严格拒绝。维护性0error/3既有warning（utils近400、SQL457/400和readRunWindow45statement既有）；定向lint0error/6既有warning，治理及ratchet通过。治理触发两处既有跨目录/feature深导入已改原公共入口，参数end既有赋值改局部const，无规则/baseline改动。无未关闭finding。

发布材料：0.59.10中英notes/索引/结构化JSON及changeset首次冻结前备齐，planned-path preflight通过，docs i18n通过、实际构建9.27秒；project-pulse仅本轮生成漂移已单独恢复。EXISTING_RELEASE_PATH沿原release.yml/npm-production/NPM_TOKEN，最近成功parent43887007685；无active parent。dry-run确认0.59.9→0.59.10、12项版本变动/9个NPM发布/39包验证闭包，structured notes ready，patch无需官网/X；正式必须target=all含Desktop。本批AUTOMATION_INTERVENTIONS=0（尚未dispatch）。主区7项Bibo WIP完全保持，本worktree所有新改动属本轮。

00:55:11正式target=all parent [43912757861](https://github.com/Peiiii/nextclaw/actions/runs/43912757861)已接管，冻结source8e7849ace2af4722323236af9d397e5c19f75f51，ordinary atomic push同时闭合远程master/任务分支；exact prepare43912639495、docs43912639338。expected_head直接取git，不手填；正式dispatcher后只读observer跟随终态，不人工串联子流程。本批AUTOMATION_INTERVENTIONS=0。预计NPM_READY01:10、全平台01:40–02:00，均为估计；JRN-23正式发布running，原JRN-09仍unverified。最终补强的已知source总数上界四种非法边界回归通过，参数end局部只读改名后治理全过、匹配tsc及所属6项复验通过，不削弱校验；没有未关闭Review finding。

01:10:53 NPM owning job成功；01:15直接读取registry.npmjs.org/nextclaw/latest确认0.59.10及dist integrity，常规npm view本机查询缓慢但不是发布失败。NPM_READY首dispatch至此942秒（15分42秒），time budget: missed。Runtime/Desktop仍待闭合，未宣称全平台完成。docs43912639338 attempt1 success，原deploy:docs:verify再次确认双生产站source8e7849ace2/tree826a2ad0fb998412156a9cea1426bf9dc101e04771ba252244e857060cd3ae4e一致。Issue进度评论6923115912已发送并回读确认Peiiii及本次正文，只按具体操作ID识别自己，不重复索要无留存材料；最终发布后再交付下载入口。本批AUTOMATION_INTERVENTIONS仍0。

01:17发现prepare43912639495已failure：Mac x64在pnpm deploy命中ERR_PNPM_NO_MATCHING_VERSION，@typescript-eslint/parser8.73.0要求types8.73.0，但runner metadata当时最高8.72.2；Mac ARM未获runner cancel。NPM artifact及Windows/Linux已成功。当前精确registry types8.73.0 GET 200，表明条件已改变，不改源锁文件8.56.0或重发产品包。扩展原Release Recovery到prepare工作流，只有确切缺失版本现已可用才failed-only恢复，永久缺失/普通编译错误拒绝；原run_id受控bootstrap仍完整校验。10项真实handler回归、actionlint、维护性0error/0warning通过，无新publisher/版本特判。详见design增量。当前等待部署控制器并从原run恢复，尚未算成功，不冒称全平台可用。

控制增量部署ae5c51c046（合并NPM publisher325f259f3a，保留source8e与版本身份），bootstrap控制器43918220835 success但未发生rerun：实际REST run.name是动态run-name，不是静态workflow名，新增白名单过早返回。已改以run.path固定workflow文件路径分类，并用真实动态title回归，10项仍通过；首次green不计实际恢复成功。期间parent43912757861因Mac ARM64/Node24 cell未获runner而failure；需要同一控制器对原prepare及原parent分别受控恢复，不另dispatch publisher。人工入口触发次数目前1（无变更），后续两入口要如实累计，不能称首轮零干预。

01:30/01:32控制平面3c561a5d649b1f6d8c3f8349e1ef4e215f95bd81部署后，两次受控bootstrap均有实际动作：控制器43919043786在01:30:22.290 notice Resumed run43912639495 attempt2；控制器43919357538在01:32:11.683 notice Resumed run43912757861 attempt2，原API也回读两任务attempt2。只调用原failed-jobs API，无新publisher/NPM重新上传。01:39两Mac Runtime均in_progress，parent仅ARM64/Node24 cell queued。人工恢复入口累计3（首次误拒绝1、实际prepare及parent各1）；这是AUTOMATION_INTERVENTIONS=3，不宣称零干预。NPM latest0.59.10及docs已公开，Runtime/Desktop尚未完整闭合，预计02:00–02:30仍是估计。当前observer session85752仅跟原parent终态；最终还需公开manifest/APT/桌面30资产核验。原JRN-09仍unverified，客户无现场资料，不据本地同文复现关闭Issue。

02:24检查点：原parent attempt3全部16安装组合通过，Runtime于01:52:15成功；Desktop于01:53:25因已确认preflight43923039596首次只读查询HTTP404中断，没有启动本版桌面构建。原02:00–02:30预计无法兑现，尚未完整发布。JRN-24修复原reader的同ID有界读重试、资格矩阵按平台合并为4次runner申请保留16组合；67项相关测试全通过，actionlint通过，diff-only维护性auto为0error/0warning，治理全通过。严格non-feature净增长检查曾拒绝必要新增能力，按项目允许的最小增长以auto复审；未修改规则或baseline，未删除无关实现。产品source8e、NPM发布commit325f及Desktop0.0.311身份不变，不新增changeset。JRN-24真实四平台CI与JRN-23完整发布仍pending；当前提交控制修复后沿原all入口恢复，预计03:00附近，非保证。人工恢复累计仍3，下一次新控制入口恢复将记第4次；单独只读矩阵验收不发布产品。

02:49真实返工：控制40b614e925推主干后，四runner只读资格43928733838与all恢复43928744907分别于02:25:58/02:26:02接管，人工发布恢复累计4。preflight43929698086成功，desktop43929802861已自动派发；Windows两架构/Linux已构建成功，ARM Mac无runner的取消触发旧closure提前退出，Intel Mac仍继续构建，parent失败。原控制器未订阅desktop child，形成真实自动恢复缺口。补充原Recovery订阅desktop-release，沿同一容量annotation门和failed-only API；closure等待整体终态并给控制器120秒恢复窗口，不再因单job取消中止父流程。67项相关测试全过，actionlint、治理、diff检查通过，维护性0error/1既有近预算warning（closure437/500，净增4行）。实现Review确认无新publisher或第二恢复分类owner、失败等待有上限、业务失败不会自动重试、原成功构建保留；待真实child恢复验证。新分组资格的Mac ARM也曾无runner取消，但已有43931740438自动将同run恢复至attempt2，另三平台成功结果保留，无Agent介入；最终16组合尚未全部证明。预计时间需待ARM获得runner后再核定，原03:00不能保证。

03:06订阅验证返工：desktop child18:52:10Z已failure，但新订阅未产生Recovery run；不能把YAML通过当交付证明。移除该无实证的订阅，closure失败终态显式dispatch同一Recovery(run_id)，整个等待期一次请求，恢复仍由原owner按annotations分类并保留成功构建。控制器自己观察新attempt至终态后重判，最多attempt4/每轮90分钟/总300分钟，不依赖事件继续接力。68项实际handler与等待器测试通过（含连续容量失败、到限、后续业务失败拒绝、ack后旧attempt可见性、同ID两轮失败只请求一次、未恢复失败有界退出），actionlint/治理通过；维护性先触发closure31statement，已将官方ack日志统一放回原dispatch owner，等待器不再自行解释receipt，最终检查待记录。03:01实际回读：desktop43929802861 attempt2的ARM已in_progress，其余四平台success；其受控bootstrap43934559343为本批第5次发布恢复介入。独立资格43928733838已由43934393354自动恢复attempt3，先前口头“第二次失败未自动恢复”是观察过早，已更正；资格无Agent介入。Issue原JRN-09不因此关闭。

03:08最终控制增量Review：68项全通过，actionlint/diff/治理通过，diff-only维护性0error/1近预算warning（closure442/500，净增5）。状态观察与容量重试分类仍分别归closure/原Recovery，官方dispatch receipt日志归原GitHub owner；未新增权限框架、publisher、版本例外或放宽平台验证。controller并发仍按原run ID串行，旧事件按attempt门拒绝，后续事件可到达但不再作为重试持续执行前提。当前desktop ARM构建和资格ARM排队中，尚无完整发布声明。

03:22公开核验与最后身份门返工：desktop43929802861 attempt2已全部success（五平台构建/安装冒烟、Release、channel、APT、Pages），公开v0.59.10-desktop.1非Draft/非prerelease、target325f259f3a25aa1de6d3945a0619414c12a3ec67；原资产owner精确30名及非空检查通过，Windows x64 exe200550168字节。裸公开Desktop/NPM Runtime stable manifest均0.59.10且指向同版notes，Runtime hostKind=npm-runtime-bundle；APT0.0.311；notes JSON与registry latest0.59.10。主线4dc329261a已部署持续恢复owner；真实43937087512自动将资格run恢复attempt4并继续观察，前三平台成功，ARM尚queued，未冒称新矩阵全过。最终all恢复43937756541（第6次发布恢复介入）在NPM recovery误把scripts/dev/node/project-node-version-contract.test.mjs当未发布runtime而拒绝，未重新publish。修原preflight分类，仅允许scripts/dev下.test.mjs，执行文件/包源码/锁仍拒绝；35项相关回归、真实325f→4dc的git diff解析通过，维护性0error/0warning。首次尝试以SHA作dispatch ref遭422无run创建，已改回master+实际expected_head，无产物动作，不增发布身份。接下来从修后master再走唯一all恢复，保留已发布产物；第7次介入待dispatch。

03:32收尾证据：最终all parent success含NPM recovery、兼容证据复用/unsupported guard、Runtime与Desktop完整校验；仅复用0.59.10，不重复NPM publish。本批从首次00:55:11到最终03:28:00共152分49秒；NPM_READY仍942秒，60秒目标missed；发布恢复介入累计7，另一次ref填写错误HTTP422没有创建run，不宣称首轮零干预。Desktop child43929802861于03:16:17终态success，全部11类job含五平台构建/安装冒烟和公开投影；30精确非空资产、Windows200550168字节、公开manifest/APT/notes/registry证据见前。Issue评论[6926821632](https://github.com/Peiiii/nextclaw/issues/73#issuecomment-6926821632)已发送并回读验证Peiiii/全文/安装链接，未收到新的作者归档。

新资格43928733838最终attempt4 failure，Mac ARM job133544607335 runner_name为空，实际annotation为The job was not acquired by Runner of type hosted及macOS arm64容量限制；另外三平台各4个Node均success。原Recovery43937087512在4dc控制源下自行恢复attempt4并观察到终态，于03:29:00结束，未越过4次上限；controller success仅表示恢复执行结束，不是目标资格通过。新增矩阵完整CI仍为真实外部阻塞，未降平台/Node门、改OS/架构标签、改用付费runner或另dispatch躲避上限。已取得可用产品与原16组合证据，故产品交付完成；不将新自动化验证标成完成。

方法改进已直接落原owner：source完整/派生局部视图和坐标合同、摘要错误与写盘错误隔离及真实未知结果/cold验收；发布的官方ack ID、有界404等待、4runner保留16cells、单一恢复分类及持续有界观察、开发测试与runtime身份边界。68项发布关联回归通过；新增永久404回归真实等待后证明5次读取明确失败，所属18项通过（20.05秒），不重复累加数量；最终diff-only维护性0error/0warning。没有新增AGENTS/Skill规则或第二publisher。主工作区7项Bibo WIP逐项仍在，待最终提交后按原mainline owner对账；新增CI容量阻塞与原首因缺现场证据均不转成用户手工修文件待办。

## 23:16 全平台交付与发布恢复验收完成

当前交付子目标phase=delivery→retrospective，retrospective_state=completed；parent原JRN-09仍unverified，Issue保持open，不能称最初事故全部解决。JRN-16/17的结果可读性与偏移修复验证继续有效；JRN-18=passed，JRN-19=passed，JRN-20=passed。下方running/估计均为历史检查点。

最终唯一all恢复parent43887007685 success，22:33:41–23:12:50（39分9秒），Desktop child43888006998 success（22:39:21–23:12:34），11个job全部success，五平台真实构建及安装冒烟、发布资产/公开Release/更新渠道/APT完整闭合。公开v0.59.9-desktop.1为非Draft、非prerelease，30个非空资产，target精确0828055e5c6068d09a49a660826e6b8a35ee4295，Desktop0.0.310；Windows x64 exe200566524字节。NPM latest0.59.9、Desktop与NPM-runtime两公开stable manifest latestVersion0.59.9且notes URL为本版，APT实际Package nextclaw-desktop/Version0.0.310；裸公开URL复验通过（早先23:09仍见旧缓存，未冒称当时已更新）。双站docs再次由原verify脚本确认77558dd4b及tree hash一致，结构化公开notes version0.59.9。

发布首dispatch21:23:59至最终23:12:50总108分51秒；NPM_READY21:36:32，首dispatch至此753秒，time budget: missed（60秒目标）。NPM job21:24:50–21:36:32=702秒，其中Publish prepared batch and close Git state21:25:45–21:36:15=630秒，为该job最慢步骤；未读取成功job全日志，不能再细分为registry或artifact等待。最终Intel Mac job21分25秒（22:39:32–23:00:57），Build Desktop macOS步骤11分54秒，随后发布渠道/APT约12分钟。没有因超时降验收。人工恢复4、自动容量恢复1；另有self-listen部署错误与jobs可见性边界的实现返工，不宣称首次零干预完成。

复盘已落原owner：产品结果保留/轮次及旧索引/UI语义回归避免固定报告冒充读取成功；原发布控制器仅对明确平台容量/连接超时自动恢复，真实43883089570已证明不用Agent手动续跑；原github dispatch owner改官方returned ID并统一queued状态读取，preflight43887936600与Desktop43888006998实链均成功。32项发布关联/closure回归、9项恢复分类回归、actionlint、diff检查通过，维护性无error，closure近预算1个warning且净减。没有再加AGENTS/Skill规则、版本特判、第二publisher或放宽门禁。若确定性失败或达到恢复上限，仍明确失败，不承诺任意外部故障无限自愈。

Issue评论[6920421283](https://github.com/Peiiii/nextclaw/issues/73#issuecomment-6920421283)已发送并回读确认author Peiiii/正文/安装链接，说明真实nonce+SHA冷开验证、自动索引升级及原首次停写首因仍未知。最新10条评论无新作者归档；不重复索要已无法找回的旧hash/首异常。实际本机用户体验仍待作者升级确认，原journal缺失/停写的现场触发仍缺脱敏归档，不能用本轮发布替代原首因验收。

### 当前发布检查点：22:42

控制平面cbe23697be229ef0fa2dc9444faf3fc662315f3c，唯一当前all恢复parent [43887007685](https://github.com/Peiiii/nextclaw/actions/runs/43887007685)，22:33:41开始；NPM recovery22:36:01、Runtime recovery22:38:07通过，复用既有0.59.9身份，未生成0.59.10。精确ID预检43887936600已success；原parent自动派发Desktop child [43888006998](https://github.com/Peiiii/nextclaw/actions/runs/43888006998)于22:39:21开始，目标仍原Draft v0.59.9-desktop.1 / 0828055e5c6068d09a49a660826e6b8a35ee4295 / Desktop0.0.310。当前child in_progress，未宣称公开可下载。JRN-20的dispatch/queued查询实链已通过，完整交付JRN-18仍running；原JRN-09仍unverified。observer session72855只读父终态；全平台估计23:10附近，非保证。人工恢复累计4（docs failed-only1、原parent failed-only1、部署两次已确认控制缺口后的all恢复各1），自动runner恢复另有真实成功证据，不计人工。旧43884004514排队数据与cancel接口不一致，未重复盲取消、其只读预检不会发布资产。

## 发布恢复返工（2026-11-16）

用户追问全自动流程并要求修好，扩展到原发布owner的瞬态故障恢复。实现仅release-recovery.yml终态订阅/分类/有界failed-job rerun，仍调用同一publisher，既有产品验收保持有效。JRN-19 required passed（已证明runner容量故障实际自动恢复；docs分类为隔离API回归，未注入生产超时）：脚本直接执行平台真实failure形状、确定性失败拒绝、来源/陈旧/取消/到限门及docs超时/内容不一致分离，9项通过；actionlint、diff --check通过，diff维护性0error/0warning。实现Review检查事件权限、同仓库master来源、当前attempt对账、单run互斥与成功checkpoint复用，无未关闭finding。无TS改动；不另发产品changeset。JRN-18及原JRN-09仍未完成。

22:11:19.510真实自动恢复证据：默认分支a35e1db95c209859ed7d78f16e467ea3aa50e908的workflow_run [43883089570](https://github.com/Peiiii/nextclaw/actions/runs/43883089570) success，notice明确Resumed run 43875370755, attempt 3; successful checkpoints retained。原attempt2仅Node24再次未获runner，Node26已22:07:10通过；控制器未重发NPM/未另dispatch，自动attempt3 Node24在22:12:10通过，16cell及unsupported全部成功，原Runtime进入in_progress。人工干预仍2（docs1、早先parent1），此次控制器自动恢复不计人工。新控制器实施期间的非法self-listen配置已如实记录并纠正，不能称首次实现就成功；当前全平台预计22:40–23:00，待Desktop及公开渠道实际核验。

## 2026-11-16 20:39 结果不可读与轮次错误返工（当前 scope revision 6）

用户提供客户AI原话：每次回显变“已归档”，抓Issue、算SHA256、读11-14反馈不能获得实际内容；随后报告Invalid assistant model round part offsets，并明确要求审计今天改动。目标仍是可实际完成任务且经验证后全平台发布，授权保持；原.59.1首因JRN-09不降标准。flow=bugfix，phase=delivery，retrospective_state=pending，单代理。写前HEAD952d0b9201b567ffb8cf40c5b76621318cfcc6ff/worktree干净；全部新改动属本轮，主工作区WIP不动；origin/master另有独立star-history指标6986669e5f，已合并保留。正式设计/Review见原设计scope revision 6节。

修前证据：/tmp/issue73-observation-before.log：原native测试只加下一轮模型输入中的43KB结果尾标识断言即失败，原工具确已返回；/tmp/issue73-offsets-before.log：大早期body+多轮tail裁剪产生0边界，同文Invalid；/tmp/issue73-empty-round-before.log：完整压缩后活动占位parts=[]仍带旧正offset，同文Invalid。前次固定模型无条件写固定报告，真实模型也只写固定marker，都不能证明AI读到了工具返回值；此前“实际可用”结论超出证据，本轮收回这一扩张。

今天改动审计：64KiB事件提前套UI descriptor、2K共享预览预算、裁剪>=0及空占位继承旧offset来自既有6e7a43a6ad（已在0.59.7）；今天7dfa9fa56移除权限锁但保留上述缺陷，又给preview工具part无条件payloadDeferred:true；前端toUiParts过滤带该flag的工具，扩大了有内容却被隐藏的问题。5701310dc问答授权移除与本次结果截断无直接关联；当前远端后续只有指标SVG变动，无其它产品源码漂移。不能归咎客户环境或把旧实现当作与今天修复无关。

选定修复：正常工具结果在既有8MiB actor工作预算内保持完整，不再用64KiB显示预览替代模型输入；只对真正超预算/旧历史做有来源的裁剪，保留近期结果，每part独立预览、小结果优先于大参数预览。保留数量/part预算、上下文preflight及真实写失败保护。修正裁剪>0/空占位[]，协议元数据offsets单独保存；converter仅兼容已保存的一个空首轮0，仍拒绝其它非法值。去掉kernel无条件deferred，UI兼容旧flag但有真实内容的卡片；真无payload占位仍延迟加载。

| ID | Required | 当前状态 | 判定 |
| --- | --- | --- | --- |
| JRN-09 | true | unverified | 原0.59.1首因仍缺现场归档，不因本轮可复现回归替代 |
| JRN-16 | true | passed | 实际模型读未知尾nonce/真实shasum stdout，引用并写入报告；冷重开换新内容通过；固定连续大结果与255消息压力场景核对真实值 |
| JRN-17 | true | passed | 裁剪0/完整压缩空占位双次续聊、旧首0及其它非法拒绝、v12坏派生索引自动重建且源字节不变、真实UI卡片展开显示通过 |
| JRN-18 | true | running | 0.59.9全平台parent43875370755，冻结77558dd4b15837cceeb1cdb47203192ec092d20a，exact prepare43875336507；all内容门已备齐，包含Desktop |

21:02真实模型新验收：当前源码native/client/SessionManager/journal，codex-sub/gpt-6-luna；read_file读约37KB真实synthetic markdown末尾不可预知nonce，exec实际执行shasum -a256，write_file写报告。最终回复及报告同时精确包含nonce与独立node.crypto计算的真实SHA。冷重开前改文件并生成新nonce，新请求必须重新读、重新算，再次精确通过；6次实际工具调用，两组nonce/hash不同，不能仅复用旧上下文。28.37秒，/tmp/issue73-live-observation.json及.log；只在内存通过LocalConfigStore解析现有认证，未复制配置、未回显凭据，业务数据全隔离。临时联网测试已移出交付源码，常规CI不需要凭据。

两轮完整压缩后继续追加回复的回归已通过；新版native多次大结果+255旧消息的数量压力场景能看到各实际尾值。UI真实ChatMessageList DOM中，旧deferred但有SHA结果的卡片可展开并显示原值（初始fixture误点不存在的全局摘要，改为真实命令卡按钮后通过；未把fixture错误当产品失败）。仍在收尾，无发布完成声明。本节优先于下方已交付scope5状态，parent-goal仍未完成。

21:22 AI验收与实现Review收尾：kernel真实native/actor/compaction/存储故障4文件34项、projection recovery/page2文件18项、runtime converter/utils24项、UI adapter及真实列表DOM36项均通过，结果有交叉不叠加宣传；额外journal26项为原缓存升级位置的早期验证，迁入正确owner后不重复计数。kernel/runtime/UI/server匹配tsc通过。UI首次tsc发现新增测试缺timestamp，补齐后tsc与DOM复验通过；不把Vitest转译通过当类型检查通过。定向lint无error、维护性0error/3warning（actor586/600，UI adapter369/400，列表测试896/900），治理/ratchet通过。

Review finding已闭合：缓存升级草稿初放在已有977行journal总测试，转入已有projection recovery测试owner（约110行），原总测试完整恢复，无搬动无关存量。审查覆盖8MiB/1024part上限、近期结果保留与旧来源可读、空首轮兼容不吞其它损坏、空占位清offsets、旧派生缓存自动重建、deferred占位与有内容卡片区分；无未关闭finding，不扩大到新的权限/日志框架。其它非法轮次现在仅输出parts数、offset数、非法下标及稳定code，回归确认无正文泄露。

发布准备：双语说明、索引、结构化0.59.9 JSON、changeset及chat guide均在首次all冻结前备齐；docs构建10.94秒通过，模型/迁移测试临时联网代码已清除。旧docs生成器造成的project-pulse临时漂移仅撤销本轮项。原EXISTING_RELEASE_PATH不变，最近成功parent43835025509；dry-run确认0.59.8→0.59.9、16项版本变动/13个NPM包/40包验证闭包，structured notes ready，patch不要求官网/X宣传。JRN-18尚未运行，AUTOMATION_INTERVENTIONS=0（本批尚未dispatch），原JRN-09仍unverified。

对外已发并回读评论6917588820，承认0.59.8仍不充分并说明已复现的实际结果/坐标/旧flag问题；没有公开客户私密正文，未宣称0.59.9已发布。继续跟进授权沿用，不重复请用户确认。

21:24 source冻结与正式dispatch完成：产品提交a60572e7d后合并独立指标提交，最终source77558dd4b15837cceeb1cdb47203192ec092d20a，工作区干净、ordinary atomic push到master及任务分支。原release.yml target=all父流程[43875370755](https://github.com/Peiiii/nextclaw/actions/runs/43875370755)接管，exact-SHA prepare43875336507；expected_head由git实际读取，没有手填或复用旧source。本批AUTOMATION_INTERVENTIONS=0。预期首检查点NPM_READY约21:45、全平台22:20–22:40，均为估计。仅父终态observer只读跟随，任何真实失败从原owner checkpoint恢复，不手工拼发布阶段。原JRN-09仍unverified，所有发布完成点不能替代原首因门。

21:36:32 NPM owning job成功，registry随后确认nextclaw@latest=0.59.9；父流程继续Runtime/Desktop，尚未宣称全平台完成。文档43875336211的build/global/domestic均成功，但verify runner连接docs.nextclaw.net四次超时（ConnectTimeoutError，非版本或内容不一致）。原deploy:docs:verify --expected-commit在本机核验双生产域名同source77558dd4b及tree hash7a5f92cdbc9119d3d9a130be7f7fffec336a928f22c0426544fff5408bbd4e0b通过；仅对原docs run执行--failed恢复，不重复部署或发布NPM，attempt 2的verify已success，整run成功。本批产品父流程干预0，含文档完整交付AUTOMATION_INTERVENTIONS=1，原因是云端连通性；不把本次恢复宣称零人工干预。最新Issue回读仍9条，无新作者归档，原首因证据缺口未改变。

21:53:15父流程attempt 1失败：14/16安装cell已success，余下macos-15 arm64 Node24与26从未获配runner（runner_name为空），GitHub各job annotation明确“The job was not acquired by Runner of type hosted even after multiple attempts”及macOS arm64 capacity constraints；不是安装或产品用例失败。取消使矩阵结果abandoned，Runtime/Desktop被正确跳过，summary拒绝完整成功。21:56仅--failed恢复原parent，成功NPM与14个cell不重复执行；产品父流程恢复1次，含docs累计AUTOMATION_INTERVENTIONS=2，均外部基础设施。后续仍需16cell及Runtime/Desktop实际通过，不因容量跳过平台或放宽门槛。

## 2026-11-16 16:05 用户追报：工具调用可用性回归

用户要求解释破坏可用性的限制、读取GitHub最新信息并解决。原发布授权保持，单代理；使用development-lifecycle的bugfix路径。写前HEAD=69cd190eec802b773695b616359efb2887ae6bdf、工作区干净，首次写入仅本任务两个复现测试；主工作区Bibo WIP不动。当前scope-revision=5，phase=delivery，retrospective_state=pending；设计及方案Review见原设计新增章节。

原始反馈：作者评论[6910822183](https://github.com/Peiiii/nextclaw/issues/73#issuecomment-6910822183)说明更新后所有窗口几乎无法操作工具，不能整理反馈材料，明确报archive history限制；[6910834514](https://github.com/Peiiii/nextclaw/issues/73#issuecomment-6910834514)说明新窗口持续报contentItems.filter异常。这是新增直接证据，不能继续要求作者依赖故障工具取证。

16:11真实native组合的固定模型流双场景均失败：归档会话两次工具调用均未分派；新会话大诊断结果后RunError为`contentItems.filter is not a function`。descriptor→model独立复现同一异常。修前日志`/tmp/issue73-tool-before.log`、`/tmp/issue73-contentitems-before.log`。最初单一超长字符串在normalizer下未触发，换40段正常诊断数组后才命中；不把未触发尝试当复现。

| ID | Required | 当前状态 | 判定 |
| --- | --- | --- | --- |
| JRN-09 | true | unverified | 原0.59.1首次journal异常仍未知，保持Issue打开 |
| JRN-13 | true | passed | 移除runtime归档白名单/读预算与通用再次授权；真实native及实际模型read_file/write_file、冷开再次执行通过，旧确认数据可读 |
| JRN-14 | true | passed | preview保留工具协议、consumer兼容旧异常字段、旧checkpoint文案精确更新；原失败入口转绿，真实持久化和冷开续用通过，原正文完整 |
| JRN-15 | true | passed | target=all父流程43835025509最终success；13包NPM、16个OS×Node安装cell/unsupported guard、4个Runtime包、5平台Desktop/30资产、双类公开manifest/APT/双站说明均闭合；首次材料缺失恢复1次 |

本节优先于下方scope revision 4历史状态；未受影响的JRN-10至12证据继续有效，存储保护回归将定向复验。

16:43验收：kernel 6文件49项（含真实文件权限恢复、队列、用户问答、native工具及冷读）、runtime converter/utils 21项、executor 7项通过，范围不把后续重复的13项native复验累加。kernel/runtime/runtime-next三个匹配tsc通过；targeted ESLint无error（原summary/offset/runtime函数预算warning保留）；治理及ratchet通过。最终diff维护性0error/2warning，原runtime文件超预算但净减2、compaction utils近预算但仅+1；不为通过预算迁移无关逻辑。实现Review发现image有效项过滤在两个consumer重复，已归回原image service并复验；无未关闭finding。

真实模型：当前源码native→AgentRunClient→SessionManager→journal，codex-sub/gpt-6-luna，从旧版只读恢复checkpoint实际发起read_file/write_file并回复REAL_TOOL_CHAIN_OK；关闭store/actor后删除synthetic报告，以明确新请求冷开再次读取大诊断文件并重建报告。4次工具执行、2条user和4个结果冷历史一致，17.98秒。只在内存用LocalConfigStore解析现有认证，未复制配置/凭据，全部业务文件为临时synthetic数据。摘要`/tmp/issue73-real-tools.json`，日志`/tmp/issue73-real-tools.log`；临时网络测试/输入观察已从交付源码移除，固定回归不需账号。早期极简fixture使用巨量重复assistant filler且未注入正常执行上下文，模型回复未按marker，未记为通过；最终使用实际旧checkpoint和原production执行policy完成本节验收，未冒称原机/GUI复现。

JRN-13=passed，JRN-14=passed；JRN-15仍not-run等待正式全平台发布，JRN-09仍unverified。真实正常图像/畸形数组混合、旧contentItems字符串、null及object均有consumer回归。旧checkpoint精确文案替换不改原数据，已追加兼容回归。

对外跟进：[评论6911570459](https://github.com/Peiiii/nextclaw/issues/73#issuecomment-6911570459)已发送并回读作者/正文，明确承认回归、无需作者依赖故障工具补材料、修复尚未发布。作者追加确认版本为0.59.7（6910901714）。仅按本次操作ID识别自身评论，未屏蔽同账号其它协作。

EXISTING_RELEASE_PATH：原release.yml/npm-production/NPM_TOKEN；最近成功parent43679498232/source6194c7976bbfd6de36ff672c372f4dbb704cff4f。本次patch目标0.59.8，dry-run计划16项版本变化、13项NPM发布、40包构建闭包；target=all，禁止拆为Agent逐步发包/桌面。正式dispatch后由owner等待exact-SHA prepare，Agent只读父终态/失败。结构化笔记在owner接管发布后补齐；当前AUTOMATION_INTERVENTIONS=0（尚未dispatch）。

16:45收尾复审：新普通问答还会附带recovery checkpoint标记，虽然工具已不因此拒绝，该新标记仍属于无必要的统一授权机制，已删除。旧已保存问答及显式确认消息的兼容读取保留。新增真实UserQuestionManager回归证明归档会话正常提问、普通PDF回答可完成，消息无“确认续做”及授权checkpoint；原RequestManager旧确认兼容同测，2文件20项通过，kernel tsc/定向lint通过、两文件维护性0error/0warning。不是移除必要业务澄清，而是不再把它变成通用授权门。补充设计/实现Review均passed。

16:46对修复5701310dcb33c8cd18eafd40f7d8c9bf6c7946b6 dispatch首个target=all父流程43834048597；08:51:00Z在发布任何NPM包前被ensureProductReleaseArtifacts拒绝，错误明确缺nextclaw-v0.59.8.json。原因是Agent把product可后补内容的时序套在all的强内容门；不是产品修复失败，不绕过门禁。本轮不能宣称零干预。

已按既有路径补齐中英文页面/索引/结构化JSON（9792e004299ef6862fdccd25b719c792d856709b）、本地双语docs构建通过8秒、hasStructuredReleaseNotes=true、surface review patch ready；构建引起的project-pulse临时漂移已仅撤销本轮生成项。16:54新父流程43835025509冻结该SHA，target=all，exact-SHA prepare43834946475；旧失败source的无用prepare43833947439请求取消，不复用错误identity。AUTOMATION_INTERVENTIONS=1（同根因：all首次冻结缺内容→补齐后由原owner重新接管，未重复publish、未新增版本/发布器）。原产品源码/验收结论不变。当前等待父终态，JRN-15 pending，JRN-09仍unverified。

17:10:05 NPM_READY：同父publish stable NPM batch成功，08:55:04Z→09:10:05Z，15分01秒，time budget:missed（60秒目标）。公开nextclaw@latest=0.59.8，release commit/tag=9d974e86327d1726f9b23d33848677d989a00876；kernel0.19.9、ncp-agent-runtime0.4.29、runtime-next0.1.32、Desktop私有0.0.309。发布13个NPM包、版本变化16项，仍不代表Runtime/Desktop完成。父流程当前继续安装矩阵和Runtime channel，Desktop待后续owner。只读父终态observer session=1511，无手工逐步publisher。

两处docs于17:06完整核验commit9792e004299ef6862fdccd25b719c792d856709b、tree7a83bfbc475b19f655657a6687dc3be4b6f00bfe6b314cfefc87134c1cedb63f；公开structured JSON HTTP200/version0.59.8。首次传播期间domestic commit mismatch不判成部署失败，待对应docs run43834946111成功后同verify入口通过。fetch --tags遇三个既有历史tag冲突，仅保留原标签未强制覆盖；本次13个新tag和master已正常取得，exact nextclaw tag及源版本读取成功，不把无关旧tag冲突当作本次发布失败。

17:37用户提醒有新信息，已读取作者[6912473634](https://github.com/Peiiii/nextclaw/issues/73#issuecomment-6912473634)：bundle来自官方Windows Desktop；旧SHA、首个底层异常、工具序列均未留存且已无法回溯，不再重复索取。作者基于现有文件和当时检测窗口的记忆确认一个jsonl重启后不存在，另一个仍存在但mtime停在旧消息。此为新事实报告，不等于已有审计证据证明应用主动删除，也不证明两个会话曾有同一规模；原20,963,430字节不能自动套到缺文件的那个会话。

已发送并回读[6912798389](https://github.com/Peiiii/nextclaw/issues/73#issuecomment-6912798389)：只请求现有故障时间窗脱敏归档ZIP及脱敏日志目录，保留时间戳/组件/stack/一致A/B映射，不需要凭据、正文、完整ID或再覆盖旧版；说明NPM/Runtime已发、Desktop仍运行。已有持续跟进授权，不重复请用户批准。

旧正式tag源码的进一步边界核对：普通createSession先await importSessionSnapshot；后者先write metadata，再writeFile(jsonl，即使messages为空)，完成投影/catalog后才返回。因此“普通首次创建写文件失败却直接正常开始回答”不能仅靠现有证据成立。getOrCreateAgentRunSession另有catalog已有summary分支，不重新创建原文件；缓存/数据目录与文件缺失时点需现场日志核对。journal store显式unlink在deleteSession；offline维护有backup/marker并rename切换、启动restore回原source，不把其rm(marker/pending/projection)误说成删除journal。尚无直接证据命中删除/迁移或首次创建首因；不改数据、不追加未经复现的产品修复，JRN-09保持unverified，下一输入是作者可提供的现有归档。

17:17:56同父Runtime channel成功（17:14:27开始，3分29秒）；nextclaw@0.59.8 GitHub Release已非Draft/非Prerelease，4个OS runtime ZIP均非空。Desktop parent job17:17:58开始，当前继续由原五平台child闭环。

## 0.59.8 全平台交付与本批复盘（2026-11-16 17:52）

父流程[43835025509](https://github.com/Peiiii/nextclaw/actions/runs/43835025509)最终success，08:54:08Z→09:49:03Z，共54分55秒。NPM job15分01秒（60秒目标missed），Runtime3分29秒；Desktop parent17:17:58→17:48:54共30分56秒，为最慢阶段。只按父终态和必要异常查询，未重读成功job日志。Desktop child[43838681279](https://github.com/Peiiii/nextclaw/actions/runs/43838681279)全部success：五平台构建/安装冒烟、资产、公开、channel、APT、Pages。darwin-x64构建17:19:35→17:41:52是矩阵最慢项（22分17秒），其后资产与投影闭环；不把硬timeout当预期时长。

公开核验：[v0.59.8-desktop.1](https://github.com/Peiiii/nextclaw/releases/tag/v0.59.8-desktop.1)非Draft/非Prerelease，target9d974e86327d1726f9b23d33848677d989a00876，30资产全部非空，Windows x64 installer 200,518,553字节。公开win32-x64 Desktop/NPM Runtime两类stable manifest均0.59.8、同版releaseNotesUrl；NPM hostKind=npm-runtime-bundle；APT Packages=0.0.309。原有launcher floor按owner保持，未为补丁提高兼容门槛。文档双站commit/tree及结构化JSON200证明见上。

复盘决定（本批已交付子目标）：updated-original-owners。旧测试把拒绝工具当成成功，未证明用户在归档后仍能完成任务；现改为真实native/client/journal下实际工具读写、大结果、旧字段/旧检查点兼容、冷开继续的回归。修正落在原runtime执行器、descriptor producer、image consumer及恢复提示/问答owner，无新增权限框架或“解锁”开关。原all内容门已有效阻止不完整发布，本次Agent混用product与all准备顺序已纠正；既有合同足够，不增加平行AGENTS/Skill规则或一次性检查器。AUTOMATION_INTERVENTIONS=1，不宣称零人工。

本批JRN-13/14/15交付及复盘completed；parent-goal仍有JRN-09 unverified，retrospective_state=pending（整体），parent_status=rework-awaiting-source-evidence。作者新回复已改变缺文件分支的取证重点；17:47复查暂无归档附件，未要求已不可恢复的证据、未将当前hash冒充旧hash。收到现有归档后继续调查；不因0.59.8全平台成功关闭Issue，也不声称已在作者原机验收。

交接收尾：[评论6913100320](https://github.com/Peiiii/nextclaw/issues/73#issuecomment-6913100320)已发送并回读作者Peiiii/正文/下载链接一致，给出公开Windows x64 installer及全平台Release，说明无需删除或手改原会话、原机尚待反馈及原首因未确认。仅用本次精确评论ID识别自身，不排除同账号其它Agent。任务分支已安全合并publisher版本记录及独立code-volume自动指标提交dd704e4594，普通atomic push回master，未覆盖其它工作。remote master范围branch closure通过；主工作区7项Bibo WIP保持原状，mainline reconcile=LOCAL_WORKTREE_RETRYING，既有worker95867接管，无用户手工待办。默认branch closure读到旧本地master曾报差异，改用真实目标origin/master按同一脚本验证通过；未重置活跃主工作区。

## 迭代完成说明

2026-11-16 10:24恢复JRN-09调查。用户要求具体说明下一步并继续解决，原目标和发布授权保持；当前仅调查，不因新增实验自动再发产品版本。写前HEAD=a8c183162b9f7df91a6c2a94f8a5c78466dbf657、工作区干净；本轮归属原分支与worktree。已读取原Issue全部条件，冻结失败判据为首次真实异常→journal停止而live继续→冷读缺失；不把任意磁盘注入算原事故复现。

已取得NextClaw0.59.1/core0.18.7/kernel0.19.3及隔离依赖207包；原Windows正式bundle含同名dist-BSD8HAiL.mjs，SHA256=c29d4429a41a103969f57499f06dea372750d0736be79ed9c397b5fde82f7e7d。该包throwIfFailed实际throw行242888，Issue记242851，相差37行；版本tag同为d022fb20a82478c63c90366268bd5ad4ba06f9b2，但不能仅凭文件名宣称原机二进制相同。若需现场补充，chunk hash/实际bundle来源是明确缺口之一。

10:51旧NPM代码在Mac/Node24.18.1预实验：2会话各20,730,934字节、3239记录、1106消息，3轮压缩后11,544个事件，无人为故障注入；冷读各1112条，3个stream回复parts hash一致，无存储错误。第一版固定摘要不符合旧版完整协议，压缩阶段明确拒绝；修正fixture协议后才取得上述结果，不能把fixture失败说成原事故。旧JSON writer本来就stringify后parse校验；0.59.1 catalog也已剔除未绑定deleted_at参数，故本机历史deleted_at日志不能直接解释本事故。

本机无法执行Win native sharp，已保留该环境失败，不改Windows发布物借用Mac native模块。下一步沿原windows-update-smoke的显式诊断分支在Windows runner/Node24.18.1运行发布bundle；原artifact不改，仅副本加观察导出，目标规模调到20,963,430字节，另测截断tool参数。11:15检查实际结果；JRN-09仍未复现/未通过。

11:16本轮结果：诊断提交89f44f10c83ca512459a9cd8f3d99e7585c06e0f，Windows [43796073500](https://github.com/Peiiii/nextclaw/actions/runs/43796073500)于11:07:17成功结束。正常文本与截断工具参数两组，各2会话，seed精确20,963,430字节/3239记录/1106消息、3轮真实compaction owner后分别11,544与11,574个事件；首错探针无异常，cold各1112条且所有完成回复parts hash与live一致。20.210秒、22.165秒为各实验执行时间，不含runner准备下载。Mac/旧NPM/Node24同一tool参数场景也通过。永久[证据摘要](artifacts/2026-11-16-v0591-windows-reproduction.json)保留source hash、操作条件、全部cold hash与未对齐条件；没有保存用户内容或认证信息。

边界：此为GitHub Windows runner，不是反馈者Win11机器；未取得原消息/工具payload，未重建85,857实际token占用，也未对齐2273条压缩计数。大历史的额外源记录是无副作用合成metadata，不能冒充原真实工具分布。结果证明这两组合法字符串/截断参数实验未触发首因，不能证明原事故不存在或已经修复。原机JRN-09仍not-run（未命中原触发），没有新增产品修复或版本发布。

另已取得nextclaw@0.59.1的NPM Runtime Windows zip，该分发物不含同名BSD8HAiL chunk，未把它混作已测试的Desktop bundle。现有公开产物排查和无注入实验已完成；下一步需实际chunk SHA/来源、首个非锁存异常、最后一次操作类型、重启后原jsonl是否保留等具体证据。已向用户提交可直接发布的AI署名请求，等待对外联系作者授权；未发送Issue评论。仅此依赖阻止后续定向回放，父目标仍未完成。

11:23补齐冷读判定：首轮只检查原消息首尾哨兵、总数及所有新回复，现改为1106条原消息parts逐条按ID/hash核对，避免抽样漏失。未改旧runtime实现。提交01553484e62fee828c72f7d5ae31b3bf494682a1的Windows [43797732846](https://github.com/Peiiii/nextclaw/actions/runs/43797732846)于11:22:59成功结束，两种场景、每会话1106条全部一致，无first-error；实验各14.192秒/14.962秒。证据摘要已更新并保留初次run链接；原事故JRN-09改为unverified，表示已实验但未命中，不再用not-run掩盖已做工作。

本轮仅新增可重复诊断入口、实验与事实记录；无产品源码变化、无changeset、无新版本发布。默认Windows update smoke入口保持原行为，新增场景只有显式dispatch运行；权限contents:read。actionlint、node --check、定向ESLint、新代码治理与diff维护性检查均通过（0error/0warning）。当前原workflow支持单模块Windows实验，无需重建桌面安装包或重新发布来取得这份证据。阶段仍为原事故调查，复盘/parent完成门保持开放；下一动作是经授权索取上述精确材料后定向回放，不再把这些阴性实验称为原事故已复现。

2026-11-16用户明确答复“允许发送并继续跟进”后，已按批准原文发送[现场材料请求](https://github.com/Peiiii/nextclaw/issues/73#issuecomment-6907351622)，以🤖[墨爪]署名；发布前读取评论为空，发布后回读正文与批准文本一致。写入receipt comment_id=6907351622，已验证发布账号Peiiii/user_id=42300463；恢复时只按该明确comment ID及正文判断本次自身输出，不屏蔽同账号或同前缀的其它Agent消息。此授权覆盖本Issue材料收集与后续跟进，不再重复请求相同许可。

请求内容是实际chunk SHA256/来源、首个非锁存错误、最后操作/工具类型，以及重启后原jsonl存在与大小变化；没有要求公开凭据、正文或完整私密文件。当前已解除对外联系授权缺口，等待作者提供可定向回放的材料；原事故JRN-09仍unverified，Issue保持open。作者回复时先按新证据定位第一个失败边界，再决定是否需要代码修改和适用发布，不把发出评论本身当作调查完成。

2026-11-15用户纠偏后已重开，整体未完成。用户明确指出日志缺口必须修、未查明首次触发不能当完整解决，且一刀切停止运行可能使产品更不可用。Issue #73已重新打开，未发送评论。0.59.6/kernel0.19.7/Desktop0.0.307已发布及其CI成功仍是历史事实，不能替代当前开放目标。原反馈机器的JSON触发仍未证实，没有原journal与完整日志；不宣称恢复从未落盘内容。

flow=bugfix；task-id=dt-73b14f26；phase=task-understanding；retrospective_state=pending；scope-revision=4。本次返工仍复用原worktree/分支，写前HEAD=b684c1ddb38cdac301c4203510d76b3a12038502、工作区干净；全部当前改动属于本任务，主工作区WIP不动。JRN-10至12的修复和0.59.7全平台发布已完成，原机首因JRN-09仍等待现场材料，parent-goal未完成。旧required表是0.59.6已证明的历史范围；以下当前表优先，发布passed不替代原事故根因验收。

| ID | Required | 当前状态 | 证据与缺口 |
| --- | --- | --- | --- |
| JRN-06 | true | passed（0.59.7交付子目标） | parent43679498232成功；NPM22包、16个OS×Node安装cell、unsupported guard、Runtime和Desktop闭合。30项非空公开Desktop资产，双类stable manifest0.59.7、APT0.0.308、双站文档同源验证通过 |
| JRN-09 | true | unverified | 正式0.59.1 Windows/Node24.18.1双会话、精确规模、3轮压缩、高频文本及截断tool参数实验均未命中原事故；1106条原消息parts与新回复cold hash一致。用户已授权联系作者，请求评论6907351622已发布并回读；当前等待原机payload线索、首个异常与实际chunk hash，Issue保持open |
| JRN-10 | true | passed | 真实FileLogSink写入/query保留cause、code/errno/syscall/path/dest、Aggregate清理异常；transaction记录stage/seq/offset/rollback。真实日志目录不可写及默认初始化失败不再抛回业务，stderr有界保留首因、恢复后重新写文件；错误图总预算防指数放大。core 13项、tsc及build通过 |
| JRN-11 | true | passed | 修前真实canonical写入成功后catalog故障或metadata读取/解析失败仍锁actor；修后独立降级，一次诊断、后续发消息与冷开通过。metadata保存后catalog错误同样隔离。冷catalog重建遇坏metadata保留原文件与parse cause，健康会话仍可启动；terminal catalog故障不会冷开伪造中断 |
| JRN-12 | true | passed | 实际chmod制造EACCES，连续两次故障/恢复，同actor可继续消息并冷读；持续故障明确拒绝且保留原队列。真实native/client/SessionManager证明旧runtime清理未完成不会启动新运行，原queued输入先执行、新输入随后回复；已执行请求不重放；未确认启动不暗中重试；并发发送共享恢复、steering保留、dispose不复活 |

本次具体根因：0.59.6 gate把canonical提交后的派生catalog/preview失败误判为源journal写失败；永久failedWrites与actor故障锁无同进程恢复，failPersistence还清空已接收输入。更早日志的Error→stack字符串和三字段序列化丢失cause/code，日志sink异常又可反向打断业务。修复直接收窄提交边界、保留原Error、由原owner核对并实际提交恢复写后解锁，而非吞掉真实写失败。**这证明了可用性退化与诊断缺陷，不证明反馈者首次异常就是其中某一个。**

复现证据：修前日志落盘、catalog后提交失败、preview权限失败、metadata-catalog、日志sink权限及启动失败分别有red baseline；本机历史service/crash归档发现13,422次Unknown named parameter deleted_at及projection meta rename ENOENT（含双日志重复计数），只作“链路异常不等于源IO”的证据，不能当11月Windows事故现场。

12:49验证：Node22原9文件矩阵94/97通过，3项在多进程IO争用时超5秒并连带临时目录清理失败；同三个文件在maxWorkers=1下41项全部通过，未改timeout门槛。最终native集成7项含两轮真实权限恢复通过；core13项通过；Node24.18.1三个文件24项及二轮权限用例复验通过。core/kernel/service tsc、core/kernel实际构建、targeted ESLint通过（2个既有journal warning）；diff maintainability为0error/6warning，治理通过。次数有交叠，不相加冒充覆盖。

真实模型验证：当前源码native→AgentRunClient→SessionManager→journal，使用隔离synthetic目录；实际文件不可写先拒绝，恢复权限后返回STORAGE_RETRY_OK，关闭并冷开后历史仍在，第二轮返回COLD_STORAGE_OK，冷历史4条。model=codex-sub/gpt-5.6-luna，认证只经LocalConfigStore在内存解析，未复制、回显或修改真实配置/会话。临时网络测试已移除，固定回归不依赖凭据；未声称验证原机或GUI点击。结果摘要`/tmp/issue73-recovery-live.json`，源码回归为原native failure integration及coordinator测试。

当前交付门：JRN-09仍未满足；不关闭Issue，不把新版本或这些局部通过写成原事故完整解决。core/kernel/nextclaw patch changeset已准备，尚未正式发布；原队列仅当前进程内保留，不承诺退出后未执行输入可恢复。原流程已有真实复现、父目标及风险验证规则，本次未正确执行验收门是事实，先修产品并保留失败回归，不追加重复AGENTS/Skill规则来代替交付。

12:55实现Review：发现原地恢复绕过冷创建的bounded context完整性检查，已收敛为同一个prepareRunMessages；缺原来源时仍明确拒绝恢复，不让缺失上下文直接进入工具执行。原actor/queue/native/context四文件27项及新增guard所属文件9项通过；Node24最终三个触达文件22项通过。core/kernel/service类型检查、最后kernel构建及定向lint均通过。diff自动检查0error/6warning（journal469/400净减，SessionManager652/600净减，request近600、SessionRun近600及两组必要回归增长）；主观复核接受已有owner与显式生命周期，无未关闭实现finding，范围仅JRN-10至12。Changesets计划nextclaw0.59.7/core0.18.10/kernel0.19.8/Desktop0.0.308及其依赖闭包，当前全部待发布，不修改已发布版本。

以下段落及0.59.6验收表为历史记录；其中清空队列和强制重启的旧方案已由scope revision 4替代，不能用于当前验收。

13:02后续边界与交付决定：数据home本身尚未创建且父目录不可访问时，默认FileLogSink仍会经getDataPath提前mkdir，真实chmod复现初始化抛EACCES。已在原core path owner分离纯resolveDataPath，原getDataPath仍确保目录；默认logger只解析路径，日志IO由原捕获边界承担。core日志/路径3文件15项、tsc/build、定向lint通过（helpers既有深度warning），diff维护性与治理0error。原request/commands/product-activity/compaction相邻4文件33项通过。

JRN-10至12的已证明回归修复应发布，避免继续保留0.59.6的错误锁死行为；该发布只关闭对应交付子目标，JRN-09仍开放，不能称parent-goal完成。产品版本计划0.59.7，全平台沿唯一release.yml target=all；文档与结构化说明明确原机首次触发仍调查，同时纠正0.59.6笔记的完整解决表述。ed1e4345075d25ca2ed0f5daa2cf70d5dbc94f92已推任务分支；旧源码Windows focused43678903973在新增home边界修复后已过时，主动取消，最终包装/真实安装由冻结新版的原发布owner单次构建验收，不另跑一套平行桌面产物。尚未dispatch正式发布，原主工作区7项Bibo WIP逐项保持。

EXISTING_RELEASE_PATH：release.yml的npm-production/NPM_TOKEN原认证路径，最近真实成功parent43606811807（source518cb1434aac8291db3782a2d593f01b636d8f79），未迁移认证或改workflow。正式队列审计无active parent；25项版本变更、22个实际NPM发布包、41个构建闭包的dry-run通过，v0.59.7结构化说明ready；双语文档完整构建通过，README与release health通过。Docs构建的project-pulse生成漂移已单独恢复，未混入提交。JRN-10至12实现Review无未关闭finding，JRN-09仍是开放调查Required。

### 0.59.7已发布，原机首次触发仍开放（2026-11-15 13:55）

正式父流程[43679498232](https://github.com/Peiiii/nextclaw/actions/runs/43679498232)从13:04:43到13:48:48成功，共44分05秒；source6194c7976bbfd6de36ff672c372f4dbb704cff4f，release commit4e75336a7d4241fde7b327ad8df399a79ca93a4d，feedback proof target=all。NPM publish job成功终态13:18:59，可作NPM_READY上界（从dispatch算14分16秒，非内部精确事件时间）；该job13分25秒，含准备产物等待，60秒目标未达。Runtime job13:23:27–13:26:17；Desktop job13:26:19–13:48:41，共22分22秒，是最终关键路径。仅读终态结构化job摘要，不读成功job日志；没有用等待时间推断未知的构建内部原因。

`AUTOMATION_INTERVENTIONS=0`：正式owning dispatch之后未手工恢复、重跑、补资产或另起publisher。一次target=all自动闭合22包、16个安装cell、Runtime与Desktop。此前开发期取消的过时Windows qualification不是正式发布阶段干预，已单列留痕；不能把它写成没有发生。耗时目标未达如实记录，现有owner已自动闭合，没有证据支持为本次改变发布框架或跳过构建验证。

[Desktop v0.59.7-desktop.1](https://github.com/Peiiii/nextclaw/releases/tag/v0.59.7-desktop.1)已公开、非prerelease，30项资产全部非空，target/tag均指向4e75336a7d4241fde7b327ad8df399a79ca93a4d。公开NPM Runtime与Desktop win32-x64 stable manifest均latestVersion0.59.7、notes URL为本版；APT Version0.0.308；Docs双站verify为source6194c7976bbfd6de36ff672c372f4dbb704cff4f、tree83b86e6cdc5af326d246ab34d1dcb24b8989c3eafaeb788ae017ee08aaa0eed8。22个精确registry版本均200并带integrity，CLI latest0.59.7，core0.18.10、kernel0.19.8。其它平台完整合同消费成功parent，不重复读成功job日志。

分支闭合检查通过，remote master已含产品与全部发布记录，无release-only遗漏。任务分支安全快进到release commit；原主工作区7项Bibo WIP原样保留，reconcile返回LOCAL_WORKTREE_RETRYING，由单例worker95867继续，未stash/reset/rebase，也不是用户待办。全量fetch遇3个无关历史tag同名冲突，未覆盖它们；本版两枚精确tag已取得并通过闭合检查。

发布后仅测试可移植性收尾：POSIX chmod用例显式跳过Windows/root（其权限语义不同），原注入ENOSPC/terminal/catalog跨平台集成仍运行。该用例本地复验通过，未改变shipped运行逻辑，不追加changeset。当前JRN-09缺原journal/完整故障时间窗日志，Issue仍open；已准备索取脱敏材料的评论，因当前会话要求对外消息须明确授权而尚未发送。

本次纠偏的复盘落点为原canonical commit边界、SessionRun/SessionPendingInputs恢复生命周期、core logging/path owner及其红→绿回归；旧公开0.59.6“完整解决”表述已纠正。`retrospective_decision=updated-original-owners`（仅已确认缺陷）；没有新增AGENTS/Skill或一次性检查器。现有方法本已要求真实复现和parent完成门，前次未正确执行，不能靠重复规则冒充优化。`parent_status=rework-awaiting-source-evidence`，retrospective_state仍pending，不能把本次发布当作全部完成。

已复现并修复的机制：普通事件原先先提交 actor 再后台持久化；故障不终止运行，后续锁存报错遮蔽首个 cause 并刷屏。现在全部 durable 事件经过同一 ingestion gate，首个错误只记录/通知一次，活动 runtime observer 随 run 生命周期监听故障并取消真实 controller、清空待运行输入；正常错误收尾不再递归写故障盘。observer 使用原 persisted source 发布 UI 投影，避免 clone 二次写入。另用真实 chmod 复现 loader 将 EACCES 返回 null，改为仅 ENOENT 表示缺失。原机最初的 IO/JSON 触发根因未完全定位，没有原文件；不宣称找回从未落盘的内容。

## 测试/验证/验收方式

active-contract: JRN-20261114；scope-revision: 4；parent-goal: 定位首次故障，修复不可靠续跑与可用性退化，完善可定位首因的日志，保留已持久历史及未执行输入，恢复存储后同进程续聊；充分验证后通过现有自动父流程发布新版本。下表为0.59.6历史验收，仅复用仍有效证据，当前结果见顶部JRN-09至12。

| ID | Required | Status | 当前合同与证据 |
| --- | --- | --- | --- |
| JRN-01 | true | passed | 真实 journal/coordinator/actor 文件访问失败后 live 多1条、cold保留原1条；50事件50日志；修前2项回归失败。原机JSON触发未复现 |
| JRN-02 | true | passed | 真实 native→actor→coordinator→journal→实际 AgentRunClient：timer/terminal 写失败停止 controller、清空队列、明确拒绝再发、一次诊断与 RunError；healthy session 可继续 |
| JRN-03 | true | passed | 两种故障后冷开仍发现 broken/healthy 并可正常续聊；BigInt 序列化失败实际回滚保留原字节；EACCES 修前返回 null、修后明确抛错且原文件不变；既有 torn-tail 保留回归通过 |
| JRN-04 | true | passed | >20 MiB/1106 条历史、三轮真实 compaction owner、高频 Unicode 写入冷回放逐值一致；文本/推理/tool args 合并、取消/stale、队列/steering/压缩相邻回归有效 |
| JRN-05 | true | passed | Node22.23.2 10 文件83项回归；Node24.18.1 3文件18项故障/压力测试；kernel/server/Desktop tsc、kernel实际构建、定向lint/治理、实现Review；双语说明与changeset准备完成 |
| JRN-06 | true | passed | 父流程43606811807最终success；16个OS×Node安装cell、unsupported guard、4平台Runtime及真实更新、5平台Desktop/安装/30资产/签名清单/APT闭合；公开0.59.6双类清单与0.0.307 APT、双站notes均200；主线闭合与复盘完成 |
| JRN-07 | true | passed | Node20.18.1隔离bundle实际写入/冷开通过；Windows focused43605577362在精确源518cb1434aac8291db3782a2d593f01b636d8f79通过完整旧版本升级、旧壳回开原消息、桌面与Portable检查 |
| JRN-08 | true | passed | prepare未结束时原Runtime selector返回null导致parent失败；现只等待同source active run且保留失败门，纯selector/编排回归证明 |

复现策略 reproduce：先在真实 journal/coordinator/actor 边界注入可控磁盘访问故障；再补损坏记录、元数据及压力矩阵。JSON 文本包含引号/括号不等于 journal JSON 损坏，须按实际序列化/解析链取证。

北京时间21:09已取得首个失败基线：`/tmp/issue73-reproduction.log`。原始持久文件字节不变，actor新增`must-not-be-memory-only`但冷回放没有它；50次事件日志50条，后续仅含锁存stack。当前修复方案已冻结于[设计](../../designs/2026-11-14-session-journal-write-failure.design.md)，方案Review passed。失败锁存为每session内存Map；尚无证据证明原机JSON损坏或本实现主动删除其journal。

读取故障基线 `/tmp/issue73-read-before.log`：真实 chmod 后存在的 journal 被当成 null；修后同入口 EACCES、文件原字节与冷读保留。整体结果 `/tmp/issue73-final-regression.log`、`/tmp/issue73-node24.log`；范围有重叠不累加测试数。Node24 首次命令定位到了错误的 root Vitest 入口，改用本 package 的实际 Vitest 后18项真实通过；没有把启动失败当产品失败或通过。

真实模型验收 `/tmp/issue73-live.json`：`codex-sub/gpt-5.6-luna`，两次消息分别返回 `JRN73_NORMAL_MESSAGE_OK` 与 `JRN73_AFTER_RESTART_OK`，中间关闭并冷启动 store/coordinator/actor；冷历史4条，耗时6797ms。通过当前配置 owner 仅在内存解析现有认证，使用隔离 synthetic journal，不复制凭据、不改默认模型/原用户历史。临时 live test 已移除，未混入 CI 的普通测试集合。未直接验证反馈者原机或桌面界面点击。

## 发布/部署方式

最终以原`release.yml target=all`、现有npm-production/NPM_TOKEN发布0.59.6；[父流程43606811807](https://github.com/Peiiii/nextclaw/actions/runs/43606811807)与feedback proof确认version0.59.6、target=all、release SHA`a76efe324edc1b3c51014ac5f23d2c034fd8f444`。产品tag`nextclaw@0.59.6`与Desktop tag`v0.59.6-desktop.1`均指向此SHA；[Desktop Release](https://github.com/Peiiii/nextclaw/releases/tag/v0.59.6-desktop.1)已公开，30项精确资产合同与全部上传非空检查通过。首次计划0.59.5/kernel0.19.7/Desktop0.0.306在发布期间发现兼容和准备竞态，历史经过如下；未把中间NPM完成当作父目标完成。

修复提交`02cc054440a66cde127b01375afe2ace13ad79f0`已普通atomic push至master与任务分支；最初父流程[43602716658](https://github.com/Peiiii/nextclaw/actions/runs/43602716658)冻结此source。Actions拥有prepare/安装矩阵/Runtime/Desktop/公开投影，Agent只做父终态检查和失败附近诊断，未逐step监控或调用gh run watch。

触发纠偏：首次43602685331错误手填 expected_head，被发布前 identity gate 拦截，已请求取消；未执行NPM发布。实际提交号由 `git rev-parse HEAD` 读取后重新触发同一源身份的有效parent。`AUTOMATION_INTERVENTIONS=1`（Agent触发参数错误→修正为实际SHA；流水线本身尚无人工恢复）。不为这次偶发手填疏漏新增规则或第二套publisher。

发布期间独立 `desktop-validate` 43602675948 Windows 旧壳回开验收失败；当前 candidate 首次冷开已找回同一条原始消息，随后0.44旧壳加载该runtime首次请求为空。修复前的上一次43595521551在完全相同脚本位置失败，证明不是本次产品补丁新引入。当前history API明确以 `preparation=queued/preparing` 返回暂空page，原smoke却只请求一次；在既有Windows smoke owner增加只对这些显式状态有界等待，failed/cancelled/超时及真实消息缺失仍报错。Windows focused路径复验中；不以本地16项closure回归替代真实Windows结果，不修改已冻结的产品代码或重复发布NPM。

双站 `pnpm deploy:docs:verify -- --expected-commit 02cc054440a66cde127b01375afe2ace13ad79f0` 已通过，同一tree `fab0a3babad75e91c5f84900304139448c8aa55723121e901f7b358c0db36159`。无cache-bust的国内CDN旧响应只作传播观察，不判为部署失败。

后续事实：0.59.5/kernel0.19.7已发布NPM，release commit为52f3bf90fcb20018f9461efd349f087a4aa5892a。parent43602716658在Runtime gate失败，因为精确源prepare43602675942当时未结束、随后成功；没有Runtime/公开Desktop完成证明。Windows focused43604136341新诊断明确 preparation=failed，缺`@libsql/win32-x64-msvc`，等待假设不充分，保留有效有界等待并修真正的native resource owner。新增目标nextclaw0.59.6/kernel仍0.19.7/Desktop0.0.307；非重复发布0.59.5。原0.59.5 Desktop draft无资产且未公开，发布新identity前安全撤掉未完成草稿，NPM与产品tag不动。

兼容修复定向21项回归通过；真实Node20.18.1隔离打包的SQLite owner在缺binding时MODULE_NOT_FOUND，复制原native resource owner产物后真实写入、关闭、冷开读取`JRN73_NODE20_HISTORY`成功，证据`/tmp/issue73-libsql-{before,after}.log`。Windows实际复验仍待完成；无发布后源码变更的伪验收。新增脚本diff维护性0error/2warning（既有目录16文件、资产owner401/500），边界复核接受必要的native合同检查，未新增文件或重复owner。

北京时间22:48，Windows focused [43605577362](https://github.com/Peiiii/nextclaw/actions/runs/43605577362)成功；仅读终态，不读取成功job日志。随后对精确主干518cb1434aac8291db3782a2d593f01b636d8f79触发最终父流程 [43606811807](https://github.com/Peiiii/nextclaw/actions/runs/43606811807)，target=all；expected_head直接从git读取，不再手填。0.59.6的source已在22:44推主干预构建；发布与全平台终态待Actions闭合。`AUTOMATION_INTERVENTIONS=3`：触发SHA填写错误→实际SHA；prepare竞态→同source active等待；旧壳native缺资源→binding资产合同+显式history preparation诊断/等待。未覆盖已发布0.59.5 NPM，也未用第二条publisher绕过验证。

北京时间23:02已核验nextclaw@latest=0.59.6。父流程第一次attempt在darwin-x64/Node20.19.0的setup-node下载前DNS失败（api.github.com、nodejs.org均ENOTFOUND），其余成功cell与NPM保留；23:12沿同run failed-jobs endpoint恢复，只重跑失败cell及依赖阶段。国内Docs Deploy43606432131的OSS archive从22:45:55停滞至23:12仍未结束，23:13取消后只重跑deploy-domestic job132482223042及依赖verify，复用已成功build/global，不触发第二次产品发布。`AUTOMATION_INTERVENTIONS=5`（追加DNS failed-only重试、OSS停滞job重试）；完成时间预计延至23:30–23:50，当前未宣布全平台完成。

Docs重试于23:19成功，23:25独立双站verify通过：commit518cb1434aac8291db3782a2d593f01b636d8f79、tree2ff3a11b303aa98645318511a4aa1b661b62264bc4c54d872276fb896496e58f；两站0.59.6结构化notes均200且version一致。旧OSS job取消后日志显示166.049MiB/1289文件，26分钟上传60.942MiB/432对象、平均约30KiB/s，实际仍缓慢推进，修正“完全停滞”的阶段性判断。新runner重试约6分钟成功，现有不可变artifact与OIDC路径不变，无证据需要为这次网络波动扩大基础设施改造。

## 用户/产品视角的验收步骤

新版本入口与全平台自动验收已闭合。正常对话可落盘并在冷重启后读取；写失败时明确报错并停止当前运行，排队输入清空，后续发送明确拒绝；修正文件访问后退出并重新打开实例可续聊，已保存历史保持，其它会话可继续工作。CLI使用`npm install -g nextclaw@latest`，Desktop可下载v0.59.6-desktop.1。参见双语chat guide新增“会话记录无法保存时”。

## 可维护性总结汇总

复用原 ingestion/coordinator/SessionRun/日志与恢复 owner，不新增第二套持久化、备用日志或绕过报错的写路径。首次维护性发现2项文件预算error：故障订阅移回活动runtime observer、原SessionPendingInputs类与类型原样移到独立队列模块并保留原类型出口，避免错误owner与继续混放。最终12文件diff检查0error/3warning：AgentRunRequest597/600（净+3必要路径）、SessionRun510/600（净-118）、journal store473/400（净0）；主观复核接受现有边界，不为预算压行或隐藏逻辑，无未关闭finding。定向ESLint0error/2个store既有warning。新路径preflight、新代码治理与ratchet通过，AGENTS/Skill/命令/baseline未改。

### 红区触达与减债记录

- `session-run.manager.ts`：从628降至510，队列原有状态owner独立成模块，actor保留运行/持久确认/故障终止职责；原队列/steering回归和native集成复验通过。
- `ncp-agent-session-journal.store.ts`：无净增长；只区分真实回滚写失败与显式拒绝并改回根公共type import。未为一次写故障扩展存储架构。

## NPM 包发布记录

2026-11-15本次0.59.7批次：22个精确版本已发布且registry均含integrity：`@nextclaw/core@0.18.10`、`@nextclaw/kernel@0.19.8`、`nextclaw@0.59.7`、`@nextclaw/client-sdk@0.12.20`、`@nextclaw/companion@0.2.77`、`@nextclaw/harness@0.2.34`、`@nextclaw/mcp@0.3.60`、`@nextclaw/ncp-mcp@0.2.60`、`@nextclaw/nextclaw-narp-runtime-opencode@0.2.60`、`@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.60`、`@nextclaw/remote@0.3.77`、`@nextclaw/runtime@0.4.59`、`@nextclaw/server@0.23.20`、`@nextclaw/service@0.7.14`、`@nextclaw/ui@0.27.11`；以及`@nextclaw/channel-extension-dingtalk`、`@nextclaw/channel-extension-discord`、`@nextclaw/channel-extension-email`、`@nextclaw/channel-extension-slack`、`@nextclaw/channel-extension-telegram`、`@nextclaw/channel-extension-wecom`、`@nextclaw/channel-extension-whatsapp`各`0.2.59`。Desktop私有版本0.0.308。以下为0.59.6历史记录。

首次stable批次已发布9包：`@nextclaw/companion@0.2.76`、`@nextclaw/client-sdk@0.12.19`、`@nextclaw/harness@0.2.33`、`@nextclaw/kernel@0.19.7`、`@nextclaw/remote@0.3.76`、`@nextclaw/server@0.23.19`、`@nextclaw/service@0.7.13`、`@nextclaw/ui@0.27.10`、`nextclaw@0.59.5`。兼容修复新增`nextclaw@0.59.6`，其余8包不重复发布；当前9个精确版本registry元数据均200且含integrity，nextclaw latest=0.59.6。Desktop私有版本0.0.307，三个Changesets版本变动中实际NPM仅nextclaw一个。

## 最终交付与复盘

最终父流程从22:48:51到23:45:55，共57分04秒；NPM_READY为22:59:33，耗时10分42秒。Runtime闭合23:18:26，Desktop job从23:18:29至23:45:47（27分18秒），是最终critical path；DNS失败cell的failed-only恢复还延长了上游等待。Docs并行恢复后23:19成功。全部required acceptance ID passed，无以版本/tag代替父目标验收。

公开核验：Desktop与NPM Runtime的win32-x64 stable manifest均200/latestVersion0.59.6并指向同版notes，NPM hostKind=npm-runtime-bundle；APT Packages为0.0.307；双站同源518cb1434aac8291db3782a2d593f01b636d8f79及tree2ff3a11b303aa98645318511a4aa1b661b62264bc4c54d872276fb896496e58f。其它平台完整合同由成功父流程证明，没有重读成功job日志或重复全矩阵。

`release:check:branch-closure`通过，远程master包含发布源码、版本记录与release commit，无release-only遗漏。首次本地检查因尚未fetch新tag而未能解析ref，补取两枚精确tag后真实通过，不当成产品失败。`release:reconcile:mainline`返回LOCAL_WORKTREE_RETRYING，原主工作区的Bibo WIP逐项保持，由既有单例worker60750接管，未reset/stash/rebase活跃工作区；这不是用户待办。

复盘落点已执行并验证：原ingestion/actor/runtime observer修复不可靠续跑与诊断，保留真实故障与压力回归；原native资源和bundle资产合同纳入libSQL binding及缺二进制拒绝，Node20/Windows旧壳实际验证；原Runtime selector等待精确source active prepare，保留错误source/失败状态门。未新增全局规则、第二套publisher或数据库fallback；单次SHA手填疏漏当下修正，临时DNS/跨境低速按现有失败job恢复，不把偶发环境事件泛化成新框架。`AUTOMATION_INTERVENTIONS=5`，本批不能宣称零人工干预。

发布恢复实施纠错：首版0a8d0488a内联release.yml，actionlint通过但GitHub在c0b0efb5dd拒绝“Workflow release cannot listen to itself”，两个push检查未运行job；没有触发重复发包。改由release-recovery.yml接收事件，release.yml恢复原生产配置。planned-path preflight、9项脚本直接执行回归、两workflow actionlint通过；实际触发仍待验收，明确保留失败记录。

22:19:40原parent attempt3在Desktop失败：preflight43884004514确已创建、queued且jobs=[]、displayTitle仅desktop-release-preflight，旧脚本按dispatch标题轮询3分钟没有匹配而退出；恢复控制器正确拒绝未分类错误，没有掩盖。JRN-20 required running，修原desktop-release-github dispatch使用官方return_run_details直接取得workflow_run_id，preflight/build两消费者按精确ID等待，删除93行旧preflight标题扫描及closure扫描。官方依据https://github.blog/changelog/2026-02-19-workflow-dispatch-api-now-returns-run-ids/ 。31项定向回归通过，maintainability 0error/0warning；缺ID明确失败，不盲重发。仍需新控制平面沿原all recovery消费已发布0.59.9和原Draft0828055e5c，不重发NPM/Runtime；待真实验证。

22:30控制平面b3950fcf85的all恢复43885440374：NPM/Runtime recovery成功（没有新版本），Desktop获得准确preflight43886363977，但gh run view带jobs在run创建初期请求jobs接口404，CLI提前退出；该preflight随后success。已将状态查询归原github owner，排队四状态不取尚不存在的jobs，活动/终态仍保留jobs失败诊断。32项回归通过，维护性0error/既有closure near-budget warning；无TS变化，Review无未关闭finding。JRN-20仍running，需新控制平面完整恢复后才passed；不把API派发成功当全平台交付。
