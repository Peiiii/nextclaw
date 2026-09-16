# 外部持续协作交付（2026-09-13）

## 迭代完成说明

实现独立 `@nextclaw/collaboration` 包及同源 NextClaw CLI 装配。GitHub、Linear、官方讨论映射到稳定 Codex 任务，支持原平台提前状态、后续对话、quiet、暂停/恢复/取消；身份以签名 Agent 区分，同平台账号可有多个 Agent。一个本地进程和 SQLite，无新增云平台、broker 或管理面板。

设计与原用户链路、接入新平台流程、黄金验收统一在 [设计合同](../../designs/2026-09-13-external-collaboration.design.md)。同步完善 understanding/design/review skills：用户链路是设计输入，交付必须给出不超过三条优先验收，不能以抽验缩减完整验证范围。

实测发现并修复：安装后 symlink 入口不执行；自身评论改变 Issue updatedAt 导致重复任务；关闭/重开误清用户暂停；旧官方事件只通知对方角色导致 Agent 对 Agent 无事件；官方 operationId 不允许冒号且有长度限制；签名恢复必须校验作者/正文/作用域；网络丢写响应不能盲目重发。对应回归测试与真实平台复验均记录如下。

## 测试/验证/验收方式

- 定向自动测试 16 项：事务回滚、单宿主租约、去重、同任务、提前状态、quiet、账号变化阻断、未授权控制、同账号签名、伪造/跨作用域、循环上限、暂停/恢复、关闭/重开、取消、长回复签名、丢接受/输出响应、官方 ID 与对方角色事件缺口。
- 独立包 `tsc`、NextClaw `tsc` 与产品 build；中英文命令目录两项测试；diff-only maintainability 0 errors；全部 new-code governance 与 skill progressive-loading 通过。最终发布安装复验另记下节。
- GitHub [#62](https://github.com/Peiiii/nextclaw/issues/62)：`01a098fa-3761-7e00-a375-f4444fbd3ce0` 保留 BLUE-47；同账号 acceptance 签名评论触发续接；暂停时保留后续问题，恢复后仍回复 BLUE-47。初版一次自身 updatedAt 重复执行已修正，使用 #63 干净新建复验。
- GitHub [#63](https://github.com/Peiiii/nextclaw/issues/63)：新建带标签自动绑定 `01a09932-eed9-7862-b23f-7c66ad35fdc3`，一次 READY_BLUE_93；状态 comment `5651344336`；后续无关通知为 COLLABORATION_QUIET，没有结果评论或新任务。
- Linear [NC-179](https://linear.app/dimstack/issue/NC-179)：`01a098fc-e0b7-7490-847f-9513e80b9a3e` 连续记住 GREEN-82。状态 `53b53811-f92b-4e99-b8d1-be114ebe00ac` 于 04:18:55Z 先显示“已开始处理”，结果 `c4cb83a1-5fc3-4fc7-9ed0-3ca9d1adc63c` 于 04:20:07Z 出现。实际暂停/宿主重启/恢复成功。
- 官方测试主题 `5ca667f7-58dc-4587-b89f-7b4138d90f1a`：原任务 `01a08c21-79c5-7cc0-b33e-3e32fd401290` 收到新签名输入并返回 OFFICIAL_CONTINUED；结果 post `c3ee7d1fdef9a4b87cf8354ed3dd6c447b98598c88ed8d0687e849f7c7a2a545`。另一个 support 绑定原样导入且未唤醒实际修复。旧 PID 已停止、config 备份退役，历史 start/status/stop/restart 转到新共享宿主。
- 实际 Codex `01a09940-f0af-7041-b247-9d3fe47bda05`：查询 running → interrupt → cancelled；探针已归档。
- 干净独立安装到 `/tmp/collaboration-clean-install`，仅公开包导入，外部 local-alert 模块 install/connect，普通命令消费者完成三次输入且同一绑定；HTTP 无认证 401，有效输入 202，重复事件只入库一次。首轮测试夹具遗漏必填 resourceId 被正确拒绝，补齐后通过。
- 2026-09-13 05:38Z 快照：三来源扫描无错误、五个绑定保留、pending=0、未确认输出=0。未对用户真实账号实施撤权；撤权/账号漂移由协议测试证明阻断，实际 CLI 身份与写入由上述实机证明。

## 发布/部署方式

复用 `release.yml target=product`：NPM → stable runtime → 文档/内容闭环；不发布 desktop。既有成功生产路径：Actions [34541952826](https://github.com/Peiiii/nextclaw/actions/runs/34541952826)，`npm-production` environment。readme 同步、release health 和 product dry-run 已完成。dry-run 计划 nextclaw 0.53.0 → 0.54.0，随既有 Changesets 依赖闭包发布；本批发布状态待下节补录。首轮 prewarm 34741078725 与 Docs 34741078384 失败：包缺少仓库显式 `private:false`，新指南缺少导航登记；已修正并通过 release:check:groups、文档完整构建与导航 tsc。未发生 npm publish。第二轮 prewarm 34741431222 在所有构建之后发现独立 tsc/lint checkpoint 缺失：新增包补齐 lint；发布步骤不再根据 build 命令文本猜测完整类型检查已完成，尊重显式 tsc script（构建 tsconfig 可能排除测试）。13 项发布合同测试及实际单包 scheduler build/tsc/lint 全链路通过。AUTOMATION_INTERVENTIONS: 4（公开标记、导航、lint 声明、类型检查推断四个根因；均在原 owner 修复，无新发布分支）。

本地宿主复用已有 gh/Linear 登录、官方凭据文件引用。默认 30 秒轮询，电脑须在线；`start` 不安装开机服务，可由已有系统服务托管 `run`。状态目录只存本地，不进入 Git。正式宿主 PID 33551 已从 NPM 全局安装的 `@nextclaw/collaboration@0.1.1` 运行，进程入口位于 Node 22.23.2 全局包目录，不依赖开发 worktree。

## 用户/产品视角的验收步骤

1. 在本仓库或 Linear NC 新建 Issue，加 `agent:mozhao`，要求记住一个暗号；看到提前状态及回复。
2. 在原 Issue 追问暗号，确认 Codex 任务 ID 不变。
3. `/agent pause` 后发问题，再 `/agent resume`，确认暂停不执行、恢复继续原任务。

入口、前提、参数与异常恢复见 [中文用户指南](../../../apps/docs/zh/guide/collaboration.md)。用户无需执行测试脚本或再配置已有凭据。

## 可维护性总结汇总

新增一个包隔离真实平台传输差异，协调器独占事件/绑定/执行语义，输出 owner 独占回写。未迁移自定义 argv 旧配置保留兼容实现；本次实际迁移配置只走新 owner。没有增加平台专属协调器、消息 broker、常驻模型轮询或面板。

自动检查发现函数过长、目录预算、类方法与跨目录别名规则；按职责拆 CLI 注册函数、输出 owner、legacy worker 注册，采用普通 ESM 相对导入（显式声明无构建别名），未引入包私有导入。最终主观 Review：新增抽象都有真实消费者，状态归属清楚，未把复杂度藏入重复 wrapper。原大文件近预算仅保留 warning，不增加新硬违规。完整回归覆盖语义变动，不以 lint 替代真实链路。

## NPM 包发布记录

- `@nextclaw/collaboration@0.1.1` 与 `nextclaw@0.54.0` 已稳定发布，registry latest 核对通过。NPM 发布提交 `68413e2ad`，准备来源 `65b4df347`，预构建 [34741999323](https://github.com/Peiiii/nextclaw/actions/runs/34741999323) 成功。
- 正式发布 [34743043117](https://github.com/Peiiii/nextclaw/actions/runs/34743043117) 最终 success：四平台 Runtime、Node 20/22/24/26 安装矩阵、过旧 Node 提示、上一稳定版升级均通过。首次 Windows Node 24 公网 npm install 超时，仅重跑失败 job 后通过，没有再次发布 NPM。AUTOMATION_INTERVENTIONS: 5（前述四个根因，加安装超时的精确重跑）。
- 发布从 06:33:35Z 至 07:01 左右约 28 分钟，包含 Windows 重跑。NPM job 636 秒，Runtime/升级 job 217 秒；最慢为 NPM job。`time budget: missed`。已修复准备阶段类型检查推断；本次没有用跳过完整性或安装门换取速度，网络安装超时保留为本批性能证据，不扩展新的发布系统。
- 本机从独立缓存安装两个精确 NPM 包。下载得到 0.54.0 后，更新过的 launcher 在下一进程激活了新 bundle；随后冗余 `--apply` 报没有待应用版本，因此不把该命令记为成功。最终 `nextclaw --version`、实际 current pointer 和 `update --check --json` 均为 0.54.0 / up-to-date / 无错误；正式 `nextclaw collaboration status` 读出三个连接、五个原绑定及在运行的独立宿主。
- 正式包续聊输入 [5651739045](https://github.com/Peiiii/nextclaw/issues/63#issuecomment-5651739045) 得到 [5651744050](https://github.com/Peiiii/nextclaw/issues/63#issuecomment-5651744050) 的 BLUE-93，仍为原 Codex 任务 `01a09932-eed9-7862-b23f-7c66ad35fdc3`。最终快照三个来源无错误，pending=0，未知输出=0。
- [双语 GitHub Release](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.54.0) 已更新。[中文说明](https://docs.nextclaw.io/zh/notes/2026-09-13-nextclaw-v0-54-0)、英文说明与结构化 JSON 线上 200，JSON 版本 0.54.0 且 CORS 正常；Docs [34743632271](https://github.com/Peiiii/nextclaw/actions/runs/34743632271) 成功。最后按正式 CLI help 修正文档 trust 的账号位置参数，未改变协议或实现。
- 范围内交付完成；桌面安装包按用户要求暂缓。可选 X 宣传未执行，release surface 保留 CONTENT_PENDING，不声称完整营销传播完成。周额度最后核对剩余 80%，未使用重置额度。
- 主线通过 `release:reconcile:mainline` 回流，源区草稿经审计迁移且无遗留；最终文档收尾提交继续使用同一回流 owner。

### 用户验收返工 checkpoint（2026-09-13 15:36 CST）

#64 实测触发三项返工：连通测试被 quiet、需要原消息 reaction、模型与宿主前缀叠加。工作树已修正提示词、增加可选 acknowledge（GitHub eyes）、在单输出 owner 清理前导规则/身份标识再签名。19 项测试、包 tsc/lint、diff-only maintainability 0 errors；真实 #65 对同样测试输入自动 eyes 并正常回复，#64 新评论 5651956235 自动 eyes。旧评论 5651924841/5651928624 已原位清理并重新签名，#64 原 Issue 补历史接收反馈。

本机监听已临时切到本 worktree 修正版，PID 27394，绑定保留；不是正式发布安装。修改尚未提交/发布，changeset collaboration-receipts-and-replies.md 已准备。周额度最新 used 22%（剩余 78%）到达用户硬边界，停止后续发布；不能将本地修复标为稳定发布完成。恢复入口：本段、设计中返工小节、git diff、/tmp/collaboration-receipt-* 验证日志；下一步提交并按 exact-SHA prepare/product 发布、切回正式安装包、原 Issue 复验后关闭 COL-010/COL-011/COL-015。不要重做已验证且未变的全平台功能；不要使用重置额度或越过 78% 下限。

用户随后明确授权继续完成发布收尾，允许本次必要闭环越过此前 78% 暂停点；不扩大功能或重复既有测试。最终定向测试 19 项、两个相关包 tsc、文档构建和 i18n 均通过，diff-only Review 0 errors / 0 warnings。设计 Review 与实现 Review 均无开放 findings。EXISTING_RELEASE_PATH: release.yml / npm-production，既有成功 34743043117。沿原发布 owner 完成 patch，不发布桌面或额外宣传。

后续用户要求显示标识更短且框架不耦合名称：采用可选 presentation 配置，公共回写默认纯正文，prefix/stripPrefixes 由接入方指定。签名中的可选 displayPrefix 经过验证后用于控制文本读取，身份不依赖显示字串。21 项测试、双方包 tsc、命令目录两项测试、lint 和文档构建通过；Review 0 errors（既有大文件 warning）。本机三个连接经对象级 CLI 显式配置短前缀，PID 22494；#64 真实回复 5652095770 为“🤖[墨爪] 可以继续交流。”。前一不可变批次 34746046090 已上传 collaboration 0.1.2；本项继续下一 patch，不覆写已发布版本。

### 返工最终交付（2026-09-13）

- `nextclaw@0.54.2` 与 `@nextclaw/collaboration@0.1.3` 已正式发布并安装。本机更新结果 up-to-date，三个来源无错误、七个绑定保留。正式独立包宿主 PID 41597，入口在全局 NPM 目录，已退出开发 worktree 运行。
- #64 正式包输入 5652236919 → [短回复 5652242545](https://github.com/Peiiii/nextclaw/issues/64#issuecomment-5652242545)，原任务不变。旧长前缀回复已在验签后原位缩短并重新签名；只修改本 Agent 已验证输出。
- 最终 [34747532742](https://github.com/Peiiii/nextclaw/actions/runs/34747532742) success：08:22:45Z–08:37:11Z，14 分 26 秒；NPM job 311 秒、Runtime 与升级 job 185 秒，最慢 NPM。`time budget: missed`。最终这次自动流程无人工恢复，AUTOMATION_INTERVENTIONS: 0；整个返工发布期间共两类介入：0.54.1 的 Windows Node 24 安装超时仅重跑失败 job，以及主干并行合入导致旧 expected SHA 在上传前被拒绝，复用新主干预构建后重新 dispatch。未修改发布基础设施或重发已上传版本。
- 前一批 [34746046090](https://github.com/Peiiii/nextclaw/actions/runs/34746046090) 最终 success；0.54.1/0.54.2 双语 Release 正文均已更新。最终公共用户指南已核对 presentation 配置与 reaction 说明。桌面和额外宣传仍不在本次范围。
- 复盘：首轮用明确执行任务验证过关，遗漏用户自然测试输入与最终渲染正文；后续验收需同时核对自然输入、原消息接收反馈、原始结果到签名正文的渲染边界。显示名与项目规则不属于公共协议；已从框架常量改为接入方配置，不新增服务或包。
- 设计 ledger 的 COL-010/COL-011/COL-015 已重新闭合。此前 78% 暂停 checkpoint 为历史记录；用户随后授权继续，当前不存在待发布修正。最终文档通过同一主线回流 owner 交接。

### Cloudflare 请求预算事故修复 checkpoint（2026-09-16）

- 根因不是正常用户流量：2026-09-15 Cloudflare 账户 101,976 次请求，roadmap portal Worker 88,957 次；`undici` 对 participant 列表、事件、两个主题详情和 support workflow 形成稳定机器流量。旧 listener 迁移保留 5 秒间隔，official adapter 每轮对所有绑定逐主题补扫；一次 status `fetch failed` 又让 1.5 秒宿主循环持续远端 capability 探测。Cloudflare 分时、路径/UA、本机 SQLite 状态与三段源码调用链互相印证，修复针对三条根因而非只提高套餐或改一个常量。
- 宿主先停机止血，再以单一 source/host/output 主链落地：官方最小 30 秒并持久归一；事件批次按主题复用详情/审批请求；新 portal 事件页覆盖 participant 与 administrator 并声明 `participant-visible-v1`；旧端点每 15 分钟兼容补采；outbox 持久指数退避并在丢响应后先按 operation ID 查询；不可编辑状态用 `statusSuppressed` 记录，不冒充已发布。
- 验证：shared、collaboration、portal 的 tsc 与 lint 通过；collaboration 26 项、portal 16 项组装 HTTP 契约测试通过；隔离冷启动把 5,000ms 改为 30,000ms。正式本机 bundle/内嵌/独立三个 collaboration 入口覆盖当前 0.1.4 构建，PID 42559 连续三个官方扫描点 01:24:48、01:25:19、01:26:24 均成功，GitHub webhook connected，原连接、七个绑定和任务 ID 保留。
- 用户验收入口仍是 `nextclaw collaboration status` 与 `show CONTEXT_KEY`：官方连接应显示 `intervalMs: 30000`；网络输出失败时 show 出现 attempts/nextAttemptAt；不可编辑状态保留真实 statusPublished 并单列 statusSuppressed。当前正式宿主持久在线。
- 可维护性：没有新增 quota service、第二 listener、broker 或平台专用调度器；静态能力和轮询下限归 SourceAdapter，调度归 Host，发送恢复归 Output。diff-only guard 0 errors；cli/service 两个既有大文件接近预算，仅有必要的 3/4 行增长，主观复核无 finding。重要根因与证据更新到既有迭代，不新建碎片目录，也不增加全局 Skill 规则。
- 发布/部署：用户后续已授权将本次源码提交并合入、推送 `origin/master`；NPM publish 与 Cloudflare deploy 未获授权，均不执行，changeset 已准备。生产宿主已通过本地已验证包止血；portal 新 coverage 端点尚未部署，暂由低频兼容补采保证完整性。NPM 包发布记录：`@nextclaw/collaboration` 与 `@nextclaw/shared` 需要后续 patch 统一发布，当前为 `待统一发布`。
