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

复用 `release.yml target=product`：NPM → stable runtime → 文档/内容闭环；不发布 desktop。既有成功生产路径：Actions [34541952826](https://github.com/Peiiii/nextclaw/actions/runs/34541952826)，`npm-production` environment。readme 同步、release health 和 product dry-run 已完成。dry-run 计划 nextclaw 0.53.0 → 0.54.0，随既有 Changesets 依赖闭包发布；本批发布状态待下节补录。首轮 prewarm 34741078725 与 Docs 34741078384 失败：包缺少仓库显式 `private:false`，新指南缺少导航登记；已修正并通过 release:check:groups、文档完整构建与导航 tsc。未发生 npm publish。AUTOMATION_INTERVENTIONS: 2（两项配置遗漏，均已由已有门禁检出并修正，无新增发布分支）。

本地宿主复用已有 gh/Linear 登录、官方凭据文件引用。默认 30 秒轮询，电脑须在线；`start` 不安装开机服务，可由已有系统服务托管 `run`。状态目录只存本地，不进入 Git。最终宿主将从稳定发布安装运行，不能把开发 worktree 路径当长期部署。

## 用户/产品视角的验收步骤

1. 在本仓库或 Linear NC 新建 Issue，加 `agent:mozhao`，要求记住一个暗号；看到提前状态及回复。
2. 在原 Issue 追问暗号，确认 Codex 任务 ID 不变。
3. `/agent pause` 后发问题，再 `/agent resume`，确认暂停不执行、恢复继续原任务。

入口、前提、参数与异常恢复见 [中文用户指南](../../../apps/docs/zh/guide/collaboration.md)。用户无需执行测试脚本或再配置已有凭据。

## 可维护性总结汇总

新增一个包隔离真实平台传输差异，协调器独占事件/绑定/执行语义，输出 owner 独占回写。未迁移自定义 argv 旧配置保留兼容实现；本次实际迁移配置只走新 owner。没有增加平台专属协调器、消息 broker、常驻模型轮询或面板。

自动检查发现函数过长、目录预算、类方法与跨目录别名规则；按职责拆 CLI 注册函数、输出 owner、legacy worker 注册，采用普通 ESM 相对导入（显式声明无构建别名），未引入包私有导入。最终主观 Review：新增抽象都有真实消费者，状态归属清楚，未把复杂度藏入重复 wrapper。原大文件近预算仅保留 warning，不增加新硬违规。完整回归覆盖语义变动，不以 lint 替代真实链路。

## NPM 包发布记录

- `@nextclaw/collaboration`：新公共包，当前源版本 0.1.0，计划首发 0.1.1；稳定发布待执行。
- `nextclaw`：新协作入口及迁移装配，计划 0.54.0；稳定发布待执行。
- 其它本批包以 exact-SHA Changesets release identity 为准，发布后补录 workflow、registry/runtime、安装和主线回流事实。
- 当前不是发布完成声明。最终完成门包含稳定包、实际绑定宿主、用户三条验收入口。
