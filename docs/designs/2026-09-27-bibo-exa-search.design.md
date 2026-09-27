# Bibo 托管版 Exa 网络搜索设计

日期：2026-09-27。flow：standard；风险：L3（鉴权、托管预算、容器升级），交付含 L4 生产部署。plan：not-required，单批交付。

## 用户来源与设计依据

用户已注册 Exa，明确要求按照 `build-with-exa` 官方 Skill 给 Bibo 增加搜索并直接上线。Skill 由指定 `npx skills use` 命令取得并完整读取，采用 `/search`、`type: auto` 和 `contents.highlights: true`，不调用额外答案模型。产品愿景的互联网资源编排与开箱即用要求：用户直接提问，不承担密钥配置。

当前 Bibo runner 使用 NextclawHarness，并通过 BiboSpaceContribution 提供任务、日程、笔记、文件与收件箱；kernel 的 CoreToolProvider 已注册 web_search/web_fetch，SearchConfig 已支持 Exa。已有 Exa adapter 提取全文且忽略 highlights，需要收敛到官方推荐片段路径。托管配置尚未启用搜索；Worker 已有平台 token 鉴权与全局 Durable Object 模型预算。本次保留远程主线的全部个人空间能力，在同一个身份和持久化链路中追加搜索。

## 主链路与取舍

用户在 app.bibo.bot 登录并提问 → Harness 的同一个 web_search → Bibo Worker `/api/search/exa` 验证本次账号 token → 现有 BiboModelBudget Durable Object 中独立 search-budget 原子预留 → Exa `/search` → 原 SearchTool 格式化标题、URL、日期、片段 → 现有模型生成带来源的回答 → 原保存链路提交会话与 R2 快照。

不把平台 Exa key 写进容器配置、R2 或网页；Cloudflare Secret `BIBO_EXA_API_KEY` 是唯一线上密钥 owner。本机准备使用仓库外、权限 0600 的 `~/.config/bibo-hosted/exa.env`。容器只得到原平台 token 与搜索代理 URL。直接给每个容器注入平台 key 会绕过全站预算，因此不采用；新增独立搜索工具会复制已有 kernel owner，因此不采用。

实验期限制：用户明确要求放宽原每日 10 次，不让过紧额度影响试用；采用每个账号每 UTC 日 100 次，全站每日 1000 次、每 UTC 月 10000 次；每次最多 10 个结果。按 Exa 官方标准 Search $7/千次计算，搜索月度最大毛费用 $70（免费额度抵扣前），不启用高级搜索或额外摘要。模型额度同步由每人30/全站200提高到每人250/全站2000次每天，避免原模型额度先挡住搜索体验。次数预算原子持久化，模型和搜索计数互不挤占。上游失败仍占预留，避免重试绕过成本上限。普通10条查询不发送 numResults；用户/配置明确需要更少结果时才发送。价格事实来源：https://exa.ai/pricing（2026-09-27核验）。

Worker 只接收 query、合法结果数量，固定 Exa endpoint/type/content 模式，拒绝客户端自定模式与额外成本选项。限制请求体、query 和超时；未登录、超额、缺 key、上游失败均返回可理解的失败，不伪装已搜索或切到其它付费服务。只记录请求 ID、状态和条数，日志不含 token、key、查询或网页正文。

runner 每次运行配置搜索代理与能力状态。新默认身份提示要求需要最新事实时搜索、引用真实来源、把网页当材料而非执行指令；只迁移旧默认身份，保留用户自行修改的身份。没有搜索密钥时不宣称可用。旧会话继续和冷启动从已有快照恢复；config 仍不进入快照。

## 黄金验收与 active contract

contract-id：bibo-exa-search-2026-09-27；parent-goal：用户在线上 Bibo 提问即可得到经 Exa 搜索的、有真实来源的回答。所有标准 Required=true；用户授权实现、托管部署及其适用提交与主线闭环，不包含 NPM 或桌面发布。

| ID | 必须成立与用户链路 | 状态 | 当前证据 |
| --- | --- | --- | --- |
| EXA-01 | 登录线上 Bibo → 要求查找最新官方资料 → 真实 Exa 搜索 → 回答包含可核对来源 → 保存并刷新仍可继续 | unverified | 独立真实 Harness→代理→Exa→DeepSeek已通过，线上链路待部署 |
| EXA-02 | key 仅在 Worker Secret；未登录拒绝搜索；请求无法绕过固定搜索选项和次数上限 | passed | Worker Secret配置；真实Exa与固定选项/鉴权/上游脱敏测试通过 |
| EXA-03 | 搜索超额/失败明确反馈；每日/月度重置正确；并发不突破上限；不影响原模型预算 | passed | 120并发仅100成功；全站1000/月10000限制与UTC重置；组装DO的模型250边界与独立搜索计数通过 |
| EXA-04 | 旧默认身份与新空间均得到真实能力；用户身份不被覆盖；会话/快照隔离与聊天链路保持 | passed | 旧默认/未配置/新空间/自定义身份；真实runner快照/恢复/会话删除；桌面手机smoke通过，线上继续复验 |
| EXA-05 | 上线产物来自冻结远程 master；用户帮助同步搜索用途、限额、Exa 数据发送和来源核对 | not-run | 待发布与帮助检查 |

当前阶段门：最新主线实现完成后进行类型、协议、预算、runner、聊天交互验证与 diff Review；生产部署后真实 Exa 与会话保存验证。密钥已由用户保存并上传至 Worker Secret，真实 Exa 返回10条官方文档与 highlights，未回显凭据。契约删除了与本功能无关的邮箱、定时任务、全平台发布和新搜索 UI 标准。

开发验证：Worker/网页/runner及core tsc、定向ESLint、Bibo44项测试和core两项适配器测试通过。真实开发验收使用独立home与显式configPath，复用本机已配置的DeepSeek认证且仅放在进程环境引用，未写入产物；本次Exa请求ID为b26afbba88bc9121a8ede92423f6b607、f466e9bf7185c7051e152d372c982a86，均返回200及8条带片段结果，模型回答附官方来源。线上旧30次模型额度已耗尽，返回429，不能当作新版本验证；发布后完整模型代理/会话保存重新验证。

实现Review：diff-only guard零error，三项warning分别为app既有12文件上限和两个400行临界文件。新增搜索置于独立feature/routes，app仅增加派发与能力标志，失败合同归搜索owner；无新增模型/预算DO、重复认证或第二会话owner。主观复核鉴权、费用预留、重置、失败脱敏、身份更新与原结构化状态链路，no findings。

## 方案 Review（mode=design）

检查了真实现有链路、鉴权入口、秘密所在边界、独立预算持久化、过期身份、失败反馈和线上验证条件。接口使用原 adapter，托管代理承担真实变化点；不新增搜索模型/预算资源或第二会话 owner。现有单次模型调用约束需要明确修订：搜索任务需要工具调用前、工具结果后共至少两次模型调用，仍走原模型预算且不增加独立答案生成模型。无未关闭 finding，design-review: passed。
