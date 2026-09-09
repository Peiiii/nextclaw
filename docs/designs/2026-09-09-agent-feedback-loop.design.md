# 用户反馈闭环设计

日期：2026-09-10。当前冻结方案，替代此前 AI 定时扫描、外层代写结果和散落脚本方案。对齐[产品愿景](../VISION.md)。运行证据与上线缺口见[验收账本](../plans/2026-09-09-agent-feedback-loop.plan.md)。

## 目标与范围

用户让 AI 提交、查询、补充和撤回自己的反馈，无需 GitHub 等外部系统登录。匿名用户凭回执访问；已有 NextClaw 身份经服务端核验后关联。管理员在现有管理平台分类审批；普通代码发现批准事项并唤醒 Codex，由 Codex 自己通过 CLI 修复、验证、评论与提交结果。正式发布需要独立授权和发行证据。

不新增账号体系、后台、通用工作流或内核反馈调度器。主动推送原会话为可选场景，不默认创建消耗 token 的查询任务。GitHub 承载代码和发布，不做反馈状态的双向镜像。

## 现状与复用

| 现有 owner | 本次应用层补充 |
| --- | --- |
| public-roadmap-feedback-portal | 保留公开路线图；增加独立私密反馈、回执、版本、审批和发行证明校验。本地 SQLite，部署使用 D1。 |
| platform-admin 与平台 gateway | 复用原登录、管理员角色与导航，接入反馈评审，不新增另一套管理员入口。 |
| nextclaw CLI 应用服务 | 用户与维护客户端共用 shared HTTP 合同，反馈领域不进入 kernel。 |
| nextclaw-self-manage | 在已有 skill 中索引反馈命令，帮助用户让 AI 代办。 |
| Codex CLI | 复用已认证的非交互执行；实际启动及 CLI 回写已本地验证。 |
| release workflow | 复用固定 SHA、发布渠道及流程，增加反馈批次和发行关联。 |

自有反馈服务直接满足匿名、私密和原平台审批。代投 GitHub 仍需要这些接口；维护两个问题池增加状态冲突，因此不采用全量双向同步，也不预建 provider 抽象。

## 私有 package 边界

长期运行的维护应用归 **apps/feedback-maintainer / @nextclaw/feedback-maintainer**，private:true。显式依赖 nextclaw 公共入口，拥有启动入口、服务、策略和测试。原生产脚本入口删除；仓库 scripts 仅保留本地验收服务启动辅助。

这是反馈应用，不是底层核心能力。扫描、唤醒、进程生命周期与发布批次协作归该应用；报告业务状态归平台。Node 原生 ESM 与包内 imports 足够，不增加构建层、动态仓库路径解析或转发适配层。

## 唯一主链路

1. 用户 AI 通过 nextclaw feedback submit 提交，回执本地保存。请求 ID 支持响应丢失后重试；list/get/reply/withdraw/link/sync/export/import 管理个人反馈。
2. 原管理平台管理员分类并批准当前输入版本。登录身份可影响同级排序，不能赋予执行权限。
3. 私有维护应用以代码读取队列，无批准工作时不调用模型。按 ID、inputVersion、reviewedAt 落独占提醒记录，然后启动 Codex。
4. 启动器只提供反馈 ID、服务地址、CLI 参数前缀、允许路径和本地 skill 绝对路径。报告正文由 Codex 再查询，完整 skill 不塞入提示。
5. Codex 读取 skill，通过 feedback maintain get 获取最新事实，自行 claim、comment、修复、验证、result。外层不领取、不解析模型回答、不运行第二套验证、不把退出码视为修复成功。
6. 用户 AI 通过个人 feedback get 读取原单回复。发布另行批准，有可核验发行证明才能标记已发布。

维护 CLI 提供 skill-path/list/get/claim/comment/result/triage/recover/authorize-delivery/publish。写入携带读取时的 revision、runId 及可复用 operationId；冲突重新读取，不能覆盖旧版本。管理员审批不作为维护者自批准命令。

维护 skill 随 nextclaw/resources/skills/feedback-maintainer/SKILL.md 分发；skill-path 解析当前安装包并确认可读。维护 token 通过限定环境提供，管理员凭据不传给 Codex，提示和日志不输出 token。

## 一致性和异常

- 平台 claim 原子检查审批、输入版本、状态和尝试次数；本地去重控制模型启动，两者职责不同。
- 用户补充使旧审批失效；旧 revision/runId 的结果拒绝写入。维护评论不重新排队。
- 运行中代码检查暂停、撤销及版本；失效或无法核验时终止进程组。超时默认十分钟；服务端限制尝试次数，没有 token 数量硬预算。
- 启动不明确或失败只记录执行事实，不自动重试、不伪造业务成功/失败。确认旧执行停止后显式 recover，再由管理员审批。
- 工作区必须干净且隔离，保留修复供验收，不自动 reset；下一批由维护者提供新的干净工作区。
- 工作区写入沙箱及允许路径不等于私密文件读取的操作系统隔离。仅支持管理员审阅后的受控维护，不开放陌生输入全权限无人值守。
- 匿名回执是访问凭证；编号本身不能读取私密反馈。身份、限流和大小限制在模型之前处理。

## 发布边界

批次协作检查批准报告与提交映射，拒绝混入额外改动；沿用固定 SHA release workflow。失败不写已发布，回评重试使用幂等键，发行渠道证据不能互相冒充。ready 只表示修复待交付。

本次授权覆盖本地实现及验收，未授权提交、推送、部署或正式发布。生产迁移、身份接入、常驻宿主及发行安装复验在上线授权后闭合，不能用本地模拟证明。进程依赖机器在线，不承诺休眠期间执行。

## 启动及验收

启动：pnpm --filter @nextclaw/feedback-maintainer start /absolute/path/config.json。配置及恢复归应用 README；包含服务地址、维护凭据、隔离工作区及允许路径。默认 30 秒代码扫描，未发布 CLI 可由 cliCommand 参数数组指定。

AI 先证明匿名提交、审批限制、代码唤醒、真实 Codex 领取评论及结果回写、用户 CLI 读回、无工作零模型调用、重复与撤销保护。用户直接在原管理平台查看同一记录的审批、结果和产物，不替 AI 填表、查日志或运行测试。

方案 review：长期进程归私有 package；CLI 与应用共用客户端；状态、审批和完成判断无重复 owner；恢复明确；不把应用抬升为通用内核。正式发布实测独立列为未验证，不能声称线上闭环已完成。
