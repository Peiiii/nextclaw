# 用户反馈闭环执行计划与验收账本

- active-contract：agent-feedback-loop-20260909；scope-revision：4；风险：L3。
- 完整目标：用户 AI/CLI 提交和管理个人反馈 → 原管理平台分类与审批 → 私有维护应用提醒 Codex → Codex 经 CLI 修复并回写 → 同批正式发行 → 用户 AI 查询原反馈结果。
- 用户已授权本任务提交、主干集成推送、部署、NPM/runtime 发行和正式验收；无关 WIP、Desktop 二进制发行不在范围内。
- 设计：[冻结方案](../designs/2026-09-09-agent-feedback-loop.design.md)。
- 版本：NextClaw 0.50.0；发行提交：7e2dde431872ff289d7471da4c89eb467b80bbfe。
- AI 验收结论：acceptance-ready。18 个必需项均有有效证据；FB-18 为已确认可选项，不默认启用。状态为待用户验收，不代表用户已验收通过。

## 完整交付对象

| 角色 | 已交付能力 | 真实入口 |
| --- | --- | --- |
| 用户 AI | 已发布的 feedback CLI、自管理 skill 索引、匿名回执、个人查询与补充；无需 GitHub 登录 | 下方 0.50.0 正式安装版会话 |
| 管理员 | 原平台身份登录、待评审队列、补充/不处理/撤销、修复与发布独立审批 | 原 Platform Admin 的用户反馈页 |
| 维护者 | private workspace package；代码轮询、去重提醒、实际 Codex 执行、本地随包 skill 路径；Codex 自行调用维护 CLI | apps/feedback-maintainer，运行配置与凭据仅在本机 .local |
| 发行与反馈闭环 | 原 release workflow、平台独立核验发行证明、同一版本发布两项真实修复、原反馈回评及安装验证 | release run 34387275723、两条原始报告 |

平台是业务状态的唯一 owner；维护器不代写模板结果，kernel 不引入反馈概念。修复子进程不获得无限提交/发布权限；本轮发行由当前维护 Codex 在用户授权及独立发布审批后执行既有发行入口。未引入 Docker 或 AI 定时扫描。

## 正式验收入口与步骤

1. 打开 [正式安装版 AI 会话](http://127.0.0.1:55668/chat/sid_ZmVlZGJhY2stZm9ybWFsLWFjY2VwdGFuY2UtMjAyNjA5MTA)。已完成真实查询，也可问“我的那两条反馈发布到哪个版本了？”预期由 AI 自行查询，回答两条均已发布到 0.50.0。
2. 打开 [管理平台已结束队列](https://platform-admin.nextclaw.io/?feedback=closed&q=&page=1&pageSize=10#/support)，沿用现有管理账号。查看下面两条真实问题的审批、修复证据、发布链接及最终回评，预期都为已发布 0.50.0。
3. 用户主要确认评审操作、信息组织及 AI 答复是否符合预期；无需重新填表、运行命令或承担功能排障。

验收 AI 实例使用从 Registry 安装的 0.50.0，并通过正常 launcher 下载/启动官方 runtime；独立 home 使用现有 DeepSeek 配置和导入的个人回执。AI 会话及维护进程依赖本机在线；平台已部署，不承诺本机休眠时执行修复。

## 两项真实修复

| 报告 | 修复与触发证据 | 最终状态 |
| --- | --- | --- |
| 1a946c86-acf5-4f3a-8b61-75db7d3dd908：反馈命令携带受影响版本时没有提交反馈 | 真实管理员批准 → 私有应用唤醒 Codex → CLI claim → 修复 --affected-version 及中英文指南 → 验证 → CLI result；修复提交 58b940138073a8a83925f40201df9232bd6eb0de，提醒记录 agent-exited | published，revision 7，0.50.0，4 条回复 |
| f60f303c-61e9-4468-94b8-4530dd14326b：正式后台反馈接口因Workers重定向选项不可用 | 当前维护 Codex 修复实际生产 503、部署复验并经 CLI 回写；修复提交 41194a8d881fc70c7a29d79464f35646700fbd99 | published，revision 7，0.50.0，4 条回复 |

两条均由真实管理平台独立批准发布，再通过正式安装版维护 CLI 关联修复 SHA、提交同一真实发行证明和各自回复。平台独立核验 workflow、tag、提交包含关系和四平台资产。对第一条重复相同 publish 操作，revision 与评论数不变。

## 原始需求逐项对账

| ID | Required | 用户结果/合同 | AI 验收证据与判定 |
| --- | --- | --- | --- |
| FB-01 | true | 匿名提交、持久化与再次查看 | passed：生产匿名原单；正式安装 CLI 提交/读回；本地重启持久化验证。 |
| FB-02 | true | 已登录身份关联，伪造/过期不冒充身份 | passed：真实本地平台签名身份与受控认证合同验证，伪造/过期拒绝关联、匿名降级。生产普通账号关联未额外重演，不把该路径写成生产实测。 |
| FB-03 | true | 私密报告隔离 | passed：合同验证其它账号拒绝读取；生产公开列表不含两条私密报告，无回执读取返回 404。 |
| FB-04 | true | 丢响应重试、回执恢复 | passed：requestId/opId 合同；生产两条回执经 CLI export/import 恢复到正式安装实例并查询。 |
| FB-05 | true | 严重度、身份排序和防饥饿 | passed：队列定向测试；身份不授予执行权限，分类不能自行批准修复。 |
| FB-06 | true | 分页、恢复、并发与代码触发 | passed：分页、SQLite、并发 claim 测试；生产实际 Codex 被唤醒；空队列路径不调用模型。 |
| FB-07 | true | 新用户证据使批准失效，维护评论不循环触发 | passed：输入版本/角色/审批测试；生产回评后无新增修复提醒。 |
| FB-08 | true | 中断、次数限制、撤销和显式恢复 | passed：时间/次数上限与取消测试，真实平台撤销后旧执行拒写。未承诺 token 数硬预算。 |
| FB-09 | true | Codex 实际修复并自行写回 | passed：上述生产 CLI bug 的实际代码 diff、验证证据与 result；外层只记执行状态。 |
| FB-10 | true | 两项修复同一批正式发行 | passed：两 SHA 都进入 0.50.0；两单平台独立核验同一 run 34387275723；额外提交阻断另有批次测试。 |
| FB-11 | true | 部分失败恢复与幂等回评 | passed：真实发行失败后仅重跑失败项；NPM 未重复上传。生产相同 publish 操作重复调用不增加评论或 revision。 |
| FB-12 | true | 渠道、安装与复验失败再处理 | passed：四平台 runtime、原 stable 升级、正式包安装和真实 CLI 提交；补充输入重新进入处理的合同测试。 |
| FB-13 | true | 滥用与运行权限边界 | passed：限流、大小、认证及路径策略验证。仅适用于管理员审阅后的受控维护，不声称 OS 级私密文件读取隔离。 |
| FB-14 | true | 原公开与新私密反馈共存 | passed：已部署，生产原公开接口 200，私密报告不进入公开列表。 |
| FB-15 | true | 接入原管理平台审批 | passed：本地真实登录、401/403、撤销与刷新；生产真实管理员完成两单修复和发布审批。 |
| FB-16 | true | 高效人工评审体验 | passed：真实 UI 列表/详情、搜索分页、连续处理、发布确认、刷新及窄屏返回；总览仍在反馈之前。体验偏好待用户确认。 |
| FB-17 | true | 用户 AI 提交与个人查询 | passed：前序真实 NextClaw AI 提交；本轮正式安装版 native + DeepSeek 通过真实 SSE 自行发现 skill、调用 CLI 查询生产原单并报告 0.50.0，run.finished。 |
| FB-18 | false | 原会话主动定时通知 | optional：用户后续三端设计确认可选；旧 AI heartbeat 暂停，测试 cron 清理；默认无 AI 轮询。 |
| FB-19 | true | 人无需代替 AI 操作或排障 | passed：AI 完成提交、修复、部署发行、安装、回评与最终查询，交付真实会话和同单平台记录。 |

FB-02 的生产普通账号重演、OS 级隔离、token 数硬预算不冒充已有证据或保证；采用当前设计约定的受控维护及分层验证。以上不把合同测试描述为真实模型或线上发行。

## 验证与 Review

- 私有维护包 15 项、门户 14 项、CLI 命令全集 2 项及相关 tsc/build/targeted lint 已通过；源码 maintainability Review 无阻断 findings。
- CLI 参数修复由实际 Codex 完成类型检查、定向检查、临时命令边界测试和 Review；正式安装包又实际提交携带版本的反馈并读回。临时记录 formal-installed-version-20260910 已撤回。
- actionlint 通过；Linux 工具链源修复在实际四平台 prepare 中通过；规则渐进加载检查通过。
- 正式用户 AI 查询返回 ok=true、run.finished、真实工具调用与 0.50.0。首次自然语言答复误写第二条的简写编号，已通过真实 UI 对话更正；系统原始记录始终正确，历史答复未被人工改写。
- 保留的开发、本地与受控合同证据覆盖边界风险；生产与真实模型证据覆盖主链路。详细运行结果保存在本机 .local/feedback-production，凭据不提交。

## 发行与部署证据

- [正式发行任务](https://github.com/Peiiii/nextclaw/actions/runs/34387275723)：attempt 2，success；源码 f9f0e0485942d58adb32c29fcee7af0c35a18dfa，发行提交 7e2dde431872ff289d7471da4c89eb467b80bbfe。
- [精确提交准备](https://github.com/Peiiii/nextclaw/actions/runs/34386552247)：NPM 与四平台 runtime 均成功。
- [版本与安装资产](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.50.0)：0.50.0；30 个 NPM 包，Desktop 二进制未发行。
- D1 migration 0003 已执行；反馈服务版本 212a2775-dc9f-495c-83cc-18ef33b2910f；网关 ddbeee52-31b0-4e00-b64a-67d8bc00eb2d；管理平台 Pages d53f65fa。本次使用已认证 Wrangler 人工部署，不声称 Cloudflare CI 无人值守部署。
- [中英文文档部署](https://github.com/Peiiii/nextclaw/actions/runs/34385479106)：build、global、domestic、verify 全部成功。
- 正式任务 UTC 18:09:18–18:31:07，共 21分49秒，包含一次 Windows 安装超时后的 failed-only 恢复。NPM 阶段197.21秒；artifact6.40秒、package183.08秒、Git/install7.74秒；package 内 precheck4.42秒、upload10.74秒、verify165.80秒。60秒性能目标未达成，主要等待 registry 传播验证（14次），事实门禁均通过。

## 开发体系修正与恢复

原缺陷是未把原始需求完整覆盖、AI验收和用户交付体验放入方案及生命周期合同。已将需求逐项覆盖和返工循环归 Validation(mode=acceptance)，Delivery只接收有效 acceptance-ready/Review 并准备真实交接；Design/Review 补现状调查、验收与交付方案约束。没有新建平行验收阶段或扩大常驻规则预算。

长期运行逻辑从 scripts 迁为私有 package，删除外层代写业务评论，保留公共 CLI 客户端及随包 skill。本次 Google Chrome 源校验失败通过限定 Ubuntu 工具链所需源修复；Windows 安装超时沿同一发行任务恢复，未降低校验门禁。

维护应用配置、恢复及边界见 apps/feedback-maintainer/README.md。继续工作前读本账本并核对实际服务状态，复用有效证据。主镜像存在其它任务活跃 WIP 时不得覆盖；交付代码已进入远程 master，本地镜像由既有 reconcile/retry owner 安全对齐。
