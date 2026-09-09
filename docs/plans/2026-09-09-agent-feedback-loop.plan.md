# 用户反馈闭环执行计划与验收账本

- active-contract / contract-id：agent-feedback-loop-20260909
- parent-goal：用户无需外部登录，由 AI 通过 CLI 管理反馈；原平台评审，维护 Codex 处理并回评。
- scope-revision：4。2026-09-10 用户明确三端结构、代码提醒、Codex 直接 CLI 回写与本地 skill 路径；最新纠偏要求长期维护端使用私有 package。原会话主动通知为可选，已撤除默认 AI 定时查询。
- flow：standard；风险 L3；task-id：dt-a9f03c72。
- worktree：/Users/peiwang/Projects/nextbot-agent-feedback-loop；branch：codex/agent-feedback-loop。
- 设计：[当前冻结方案](../designs/2026-09-09-agent-feedback-loop.design.md)。
- 授权：用户已明确授予本任务提交、主干集成推送、部署和NPM/runtime发布及正式验收权限；无关WIP和Desktop仍排除。旧的“待发布授权”说明为历史边界，当前继续执行真实发布验证。

## 当前阶段

发布前只读核验：release.yml通过actionlint；反馈服务13项测试通过。既有生产发布路径为GitHub Actions release.yml，最近成功证据run34245612525。stable dry-run识别当前待发布依赖闭包（29个NPM包、41个验证package），仅为计划，不是已冻结发行物；工作区有未提交改动，尚不能dispatch。真实发行须先获得提交/集成/推送/部署发布授权，再精确冻结本任务范围并沿既有发布owner执行，不把dry-run写成真实发布通过。未进行任何远程mutation。

整体尚未具备最终验收条件。用户未授权把局部成果作为阶段性交付；当前记录是交付对账，不是整体已交付声明。私有 package 承载应用生命周期，反馈客户端归 CLI 应用服务，kernel 不包含反馈概念。原生产 scripts 入口已删除。

真实记录：17099dac-d89f-48b2-b31f-ad167914c0dc，标题“维护CLI闭环验收：反馈能力发现”。私有 package 自动发现批准→实际 Codex 经 CLI claim→comment→限定修复→验证→result ready，用户 CLI 已读回。UTC 2026-09-09 16:52:58 批准，16:56:27 ready；revision 5，attempts 1。外层只记录 agent-exited，未代写结果。

产物：/Users/peiwang/Projects/nextbot-feedback-cli-acceptance/packages/nextclaw-core/src/features/agent/shared/skills/nextclaw-self-manage/SKILL.md，仅两个发现字段修改。无 commit/push/发布。早期外层代回写的 be5284d8 记录仅是历史证据，不能证明当前链路。

## Active acceptance ledger

| ID | Required | 合同 | Status / 证据与限制 |
| --- | --- | --- | --- |
| FB-01 | true | 匿名提交和再次查看 | 本地通过：真实匿名回执、服务重启持久化；新真实记录用户 CLI 读回。 |
| FB-02 | true | 身份验证、过期及伪造 | 合同测试通过：受控认证服务拒绝伪造/过期关联。生产身份接入未实测。 |
| FB-03 | true | 私密报告隔离 | 测试通过：公开编号及其它账号不能读，公开列表不含私密记录。 |
| FB-04 | true | 丢响应重试与回执恢复 | 本地通过：requestId/opId 幂等、导出导入再读取；客户端现归 CLI 应用。 |
| FB-05 | true | 严重度、身份、防饥饿 | 私有包队列测试通过，身份不授予权限。 |
| FB-06 | true | 分页、恢复、重叠扫描与代码唤醒 | 分页/SQLite/并发 claim 既有测试通过；新 worker 测试与真实 Codex 唤醒通过。无需 heartbeat。 |
| FB-07 | true | 新证据与维护评论区别 | 测试通过：新增输入使批准失效，维护回复不重排队，伪造 role 无效。 |
| FB-08 | true | 中断、额度、撤回 | 通过：次数、时间上限，撤销取消、旧代次拒写、显式恢复；未实现 token 数量硬预算。 |
| FB-09 | true | 实际低风险修复并由 Codex 自己回写 | 通过：当前真实记录 claim/comment/result 与实际两字段 diff，用户 CLI 读回。 |
| FB-10 | true | 两修复一批及正式批次发布 | 部分验证：提交映射/额外提交阻断测试通过；正式合入及 dispatch 未执行，待发布授权。 |
| FB-11 | true | 部分发行失败与幂等回评 | 受控外部响应测试通过，非正式发行证据。 |
| FB-12 | true | 渠道回写、复验失败重新处理 | 合同测试通过；真实新发行安装未验证。 |
| FB-13 | true | 滥用及运行权限边界 | HTTP限流/大小/认证与路径策略已测；仅管理员审阅后的受控执行，OS级私密读取隔离未实现，不开放陌生输入全权限无人值守。 |
| FB-14 | true | 旧公开与新私密共存 | 本地通过，未替换线上服务。 |
| FB-15 | true | 原管理平台身份审批 | 真实平台登录、普通用户403、无身份401、管理员批准/领取/撤销拒写及刷新会话已通过。 |
| FB-16 | true | 高效评审 | 真实UI通过：列表详情、搜索分页、连续下一条、撤销、发布确认取消、刷新恢复和窄屏返回。 |
| FB-17 | true | 用户 AI 实际提交及个人查询 | 实际 NextClaw AI 使用 DeepSeek 提交 be5284d8；新反馈通过用户 CLI 读取真实 Codex 结果。默认 MiniMax429未冒充通过，未改全局模型。 |
| FB-18 | false | 原会话主动定时通知 | 用户后续三端需求确认其为可选；旧 AI heartbeat 已暂停，测试 cron 已清理，不默认消耗模型 token。 |
| FB-19 | true | 人无需代替 AI 操作或排障 | 当前原管理平台同一反馈记录可验收，AI 已完成提交、修复与回写；正式上线边界明确。 |

## 验证清单

本轮私有 package 的 14 项测试、lint、目录 preflight 通过。CLI 命令全集2项同步测试通过。NextClaw tsc 与完整 build（含 UI 资源）通过。迁移后 diff-only maintainability 对7个相关源码文件为0 error / 0 warning。CLI 服务按反馈职责归入 services/feedback，未为目录告警添加例外。

迁移后的 test:platform 真实浏览器验收通过，记录 fc9b1ea5-c0c7-42c4-8a22-7d17dfd33b5b：原登录、普通用户拒绝、审批到领取、撤销后旧执行拒写及刷新保持会话。首次运行发现测试仍精确匹配旧的“处理中”文本，已修正为当前状态与优先级组合；不涉及产品逻辑修改。

历史有效证据：门户三套 tsc、support 合同测试、管理平台 tsc/build、平台 worker build、真实浏览器审批和撤销。发布证明测试使用受控外部响应，不能替代实际发布。

## 人工验收交接

完整验收对象是“用户 AI/CLI → 原平台审批 → 私有维护应用唤醒 Codex → Codex 修复与 CLI 回写 → 批次发行与回评”的可运行系统，不是某个 package 或报告页面。当前已完成证据与尚缺结果如下：

| 用户结果 | 可验收产物与入口 | AI证据 | 判定 |
| --- | --- | --- | --- |
| AI代办个人反馈，无外部登录 | NextClaw feedback CLI、自管理skill、匿名回执 | 实际模型提交与个人CLI读取 | 本地通过 |
| 管理员分类并批准 | 现有5177后台与8787 API | 真实登录、审批、撤销及拒绝越权 | 本地通过 |
| 批准后唤醒并由Codex自行处理 | 私有维护package、随包skill、当前反馈记录 | 实际claim/comment/result及修复文件 | 本地通过 |
| 批次真实发行并由Codex回评，安装复验 | 既有release workflow、维护publish命令 | 合同测试；没有实际新发行与安装 | 尚缺，不能整体交付 |

已完成部分的复核路径：打开 http://127.0.0.1:5177/?feedback=ready&q=17099dac-d89f-48b2-b31f-ad167914c0dc&page=1&pageSize=10#/support ，查看同一反馈的审批、Codex评论及修复证据，预期为ready且无发行版本；通过用户AI请求“查询维护CLI闭环验收：反馈能力发现的处理结果”，应读取同一报告，不能宣称已发布。这是证据入口，不代替整体交付。

正式链路的待授权对象：本任务分支上的反馈平台/管理端接入、CLI与私有维护应用、关联shared合同及release workflow改动；正式验证将涉及精确提交、主干集成与推送、反馈服务迁移部署、发布NextClaw NPM/runtime版本，以及隔离安装和原报告回评。管理员“批准修复”不提供这些授权，不能为验收自动执行。发布不包含Desktop，不涉及无关WIP；发布owner还须在执行前核实远程主干和渠道准备状态。

打开现有管理平台，搜索当前反馈编号即可查看批准、Codex 的进展评论、验证证据和 ready 状态；不要求用户重新提交或执行测试。ready 表示本地修复待交付，不代表已发布。服务依赖本机3197、8787、5177及维护进程在线。

私有应用启动、配置、恢复及测试说明见 apps/feedback-maintainer/README.md。默认代码轮询，无空模型调用。异常启动保留提醒记录；确认旧执行停止后显式恢复/重新审批，不自动重复执行。

## 纠偏与恢复

2026-09-10再次纠偏：AI验收此前主要对照设计标准，没有明确从原始需求及确认变更恢复完整范围；漏项后又用局部证据宣布阶段交付。用户指出职责应归AI验收，已将需求逐项覆盖、证据有效性及返工loop集中到Validation(mode=acceptance)；Delivery只接收有效acceptance-ready/Review结论并准备交接，不重复验收。主工作区既有修改保留，同步当前任务规则副本。未新增skill、AGENTS常驻规则或专用检查脚本。规则推演：仅一条记录且发行缺证据→AI验收不通过并返工；显式原型任务→仅按原型范围；完整链路证据齐全→输出acceptance-ready；仅缺发布授权→准备后报告阻塞。推演不宣称模型行为已可靠，后续同类交付复核；无收益则收窄原owner。渐进加载与diff检查通过，合并重复tsc/lint说明，未提高预算。

范围对账同时发现发布reconcile仍代写模板评论，已删除；现在只返回发行证据，由Codex经维护CLI写入。新增回归证明外层不会调用act，错误workflow SHA拒绝；私有包15项测试通过。changeset移除已无变化的kernel包，避免无关版本升级。

此前设计把持续运行应用写成散落脚本，缺少依赖和生命周期归属。本次通过私有 package、公共客户端、删除旧入口和共置测试修复；不新增“所有脚本都禁止”的泛化规则。方案现状、审批接入和验收合同的体系修订仍归此前理解、设计、Review、Validation 原 owner。

恢复先读本计划、设计与工作区状态，复用已验证证据。正式交付仍需上线授权后完成生产迁移、身份接入、常驻环境、发行和安装复验；不把模拟或本地结果标成线上完成。
