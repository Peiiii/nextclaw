# 上下文压缩失败的结果与恢复闭环

## 2026-11-14 桌面自动补发方案

用户新增明确桌面发布授权，并要求由现有全自动流程完成。补充验收 CCF-07–09 的当前账本归同批日志。`release.yml target=all` 首次真实执行在创建 Draft 时返回 403，尚未发布桌面身份；NPM/Runtime 已正确识别为现有 0.59.4。

已确认边界：GitHub Create Release 在目标提交的 workflow tree 与默认分支不同时要求 workflows 写权限，内置 `GITHUB_TOKEN` 无法取得该权限。原 resolver 在 Runtime 相同且只有内容/控制平面变化时回退到旧产品提交，恰好将旧 workflow tree 重新引入。依据：[GitHub Releases API](https://docs.github.com/en/rest/releases/releases#create-a-release)。不采用复制个人令牌、提高长期凭据权限或提前创建公开 tag 的路径。

冻结方案：

1. 原 `resolveDesktopReleaseTarget` 继续拒绝产品提交之后任何未发布 Runtime/共享依赖变化；校验后首次 Desktop 发布使用当前父流程冻结的完整源码 SHA，而不是追溯最近 shipping 文件提交。内容和控制流程可以更新，不改变已发布 Runtime 身份。
2. 原恢复 owner 比较同版本已有 Desktop tag 与请求 target 的实际 shipping 变更。仅文档/控制流程不同、没有 Runtime 或 Desktop shipping 变化时复用已有 target/tag；不能因为源码 HEAD 前进再次制造 Desktop 身份。Desktop shipping 变化照旧分配新构建，Runtime 变化明确失败。隐藏 Draft 仍只允许精确 target 复用。
3. 原 prepare-draft owner 对已公开的完整身份或 APT-only checkpoint 不再错误要求它是 Draft；真正首次发布仍 Draft-first。随后父流程调用原 closure owner 验证公开资产、manifest、APT 与 Pages。
4. 仍只触发 `release.yml target=all`；原五平台 child 消费同一个不可变 target，资产齐全后公开。父子 timeout、签名、安装启动冒烟与发布门不改变，不重新发布 NPM，不改既有产品 tag。

黄金验收：桌面用户从 stable 入口安装/更新→获得内含 0.59.4 的桌面版；维护者一次触发父流程→复用产品 checkpoint→五平台实包冒烟/30 资产校验→正式 Release/channel/APT/官网入口闭合。重复触发且 shipping 内容相同→复用原 Desktop 身份并验证，不新建 Draft。请求中混入未发布 Runtime 或共享依赖→在创建 Draft 前拒绝。

沿用同一 preflight/recovery/github owner，无新发布器、凭据或配置开关。回归覆盖首次 source 冻结、控制流程演进后的原身份复用、Desktop shipping 更新、Runtime/依赖漂移拒绝以及已公开 prepare checkpoint。脚本为 JavaScript，未触达 TypeScript；验证为定向真实 Git 历史/命令合同、lint、actionlint、diff maintainability，随后同一 0.59.4 的真实父流程是生产闭环证据。plan: not-required。

方案 Review（mode=design）：独立反查用户目标与 API 权限边界，校验首次和重入两条链路，保留产品身份与 Draft-first。原身份复用必须在 prepare 和 publish 两处都生效，否则全自动重入会再次要求 public Release 是 Draft；本方案一并覆盖。没有放宽 Runtime gate，无未关闭设计 finding，design-review: passed。

## 来源、目标与边界

用户提供《反馈-NextClaw压缩失败-20261112.md》，要求核实、先复现、修复及验证，后明确验收通过后直接发布。附件建议是调查参考，不是逐项新增功能的授权清单。目标是长期会话遇到不可用摘要后仍有可验证的恢复途径，并如实向用户报告结果，服务长期搭档的连续性。

0.59.1 已用 785 条、2,206,608 字符合成输入复现原报错。当前 0.59.3 已消除旧的多批全有或全无机制；本次进一步复现两个现行缺口：手动压缩返回成功但最终 checkpoint 为 failed；257 条短消息下摘要为空，连续自动调用两次均生成 failed 并重复请求 provider。原机 Windows journal 与真实 DeepSeek 响应未提供，不能声称还原原机生成失败原因。

## 用户链路与唯一 owner

用户在已有会话执行 `/compact` → native runtime 调用原压缩 manager → 成功安装摘要或显式恢复检查点时显示成功；保留旧检查点时记录失败与原因，API 返回 `CONTEXT_COMPACTION_FAILED`，原有 UI 错误提示直接显示原因。用户随后可继续读取历史、修正供应商配置或手动重试，不丢失旧检查点。

自动压缩遇到消息数量、parts 或归档结构压力时，不能把恢复候选一再丢弃。原 preflight owner 使用同一个 structuralPressure 事实决定触发与安装：只有没有结构压力、没有 overflow 且原输入仍能装入模型时，才延后降级摘要；结构/硬压力则安装可验证的恢复检查点，并维持原有只读恢复限制。软 token 压力下的延后与增长后重试继续有效。

## 实现选择与不变量

补充反例：安装结构恢复 checkpoint 后，触发判断必须按有效模型投影计算数量与 parts，不能继续把已覆盖原文算作活跃压力；否则即使安装成功仍会每轮重压。此为同一结构压力事实的计算修正，方案复审通过，不扩大 owner。

持久化边界复核：真实 SessionRun 原本只在 compressed 终态等待持久化，failed/cancelled 依赖后续异步事件。扩展同一个终态 checkpoint 提交点，三类终态均先持久化再变更 actor/UI；ingestion 既有 WeakMap 按事件对象去重，随后发布不会重复追加。用真实 SessionRun 和 journal 的冷重载验证，不以 mock applyEvents 冒充落盘。方案复审通过。

- 复用 `AgentRunContextCompactionManager` 的事件生成与原 `SessionContextCompactionManager` 的持久应用/发布边界，不增加服务或第二条压缩路径。
- core checkpoint 增加可选 `failure` 文本，记录真实抛错；不伪造未知 provider 调用次数或 usage。旧 checkpoint 无该字段仍兼容。
- automatic generator 保持失败 marker 后抛错。manual 收集器仅在已经收集到对应失败 marker 后返回这些事件；其它错误继续抛出。session manager 先持久应用、发布事件，再从失败 marker 生成明确领域错误。
- `CONTEXT_COMPACTION_FAILED` 由 kernel 生产、server 现有领域错误映射返回 409、client 现有错误处理传至 UI；成功响应结构保持不变。新增变体必须同时验证源码类型与组装 API。
- recovery notice 不冒充完整摘要；原始 journal、来源证据、旧成功检查点与取消语义均保留。失败原因进入 checkpoint、API 和时间线正文，避免只存在于运行时异常。
- 不把附件中的分段接口、历史裁剪或放宽摘要完整性作为恢复必需条件；已有有界来源与恢复检查点已能闭环，不新增平行能力。

## 验收契约

contract-id: CCF-20261113；flow: bugfix；风险 L3，发布 L4；scope-revision: 1。

| ID | Required | 行为与反例 | 初始状态 |
| --- | --- | --- | --- |
| CCF-01 | true | 保留旧版同报错复现与当前两个失败基线；明确合成/真实证据边界 | passed |
| CCF-02 | true | 手动失败先保存失败 marker 与原因，再返回非成功 API；原成功 checkpoint 不被替换；恢复 provider 后重试成功 | not-run |
| CCF-03 | true | 超过结构边界时空摘要不反复丢弃候选；连续两次压缩、冷重载后原文仍可读取，恢复约束有效 | not-run |
| CCF-04 | true | 无结构压力且低于硬预算时继续延后降级摘要；自动重试被节制，手动/增长/overflow 可重新触发 | not-run |
| CCF-05 | true | 真实可用模型完成压缩并继续原任务；失败原因在故障注入中贯通 checkpoint/API，取消不安装成功结果 | not-run |
| CCF-06 | true | 匹配的 tsc、lint、定向回归及实现 Review；中英文说明、changeset、稳定发布、更新渠道与旧版升级按原 owner 闭环 | not-run |

## 方案审查与执行

兼容证据归属审查：旧候选筛选把所有祖先release run纳入，而job名称不含版本，确定性复现可用旧版16项success错误满足当前版本。将job名绑定目标版本；resolver恢复时必须提供不可变sourceCommit和targetVersion，仅接收该版本的具名证据，旧格式证据只接受精确初始源码SHA。候选允许精确初始源码及release commit之后的控制平面，排除更早版本祖先；新的恢复结果因此可安全复用。CLI/producer/helper/tests一起修改，不增加证据注册服务。负例覆盖旧版本、错误来源、缺身份，正例覆盖当前版本及精确源码旧格式。设计复审通过，本次必须真实补验0.59.4的4个ARM单元。

恢复准备进一步复审：第一次 exact-source 恢复在 NPM 准备阶段因旧源码落后远程 master 被正常同步门拒绝，说明不能把已发布身份当作新发布重新准备。原 immutable NPM artifact 仍在；在原 prepare workflow 先按精确源码 artifact 名查找未过期产物，下载后调用原 importPreparedNpmReleaseArtifact 验证 HEAD/source、manifest、tree fingerprint、tarball 完整性并恢复版本树。存在有效原产物时跳过重新打包，继续原 Runtime 构建；不存在时保留正常新发布准备路径；验证失败明确停止。复用已验证 owner，不新增输入、发布器、版本特判或放宽 master 同步门。默认新源码没有同源产物，行为不变；旧控制平面退役后的恢复可复用原包。设计复审通过，以 artifact 导入真实测试、workflow 合同及同一0.59.4恢复验收。

发布失败补充设计：GitHub 注释明确拒绝 `macos-14-arm64-us-default`，官方说明 macOS 14 runner 已于 2026-11-02 退役。将既有 ARM runner 标签迁移为仍受支持的 `macos-15`，保留 darwin/arm64 架构、Node 20/22/24/26 矩阵及不可变 0.59.4 身份；同步相同 runner owner 的 Runtime、Portable 与 Desktop 验证/构建入口，但不发布 Desktop。当前控制平面按原 owner 恢复已发布身份，复用已成功安装单元和已上传 NPM，不移动 tag。actionlint、既有发布合同测试及真实 ARM job 是验收。方案复审通过；不新增发布器、版本特判或治理脚本。官方依据：https://github.blog/changelog/2026-10-01-github-actions-macos-14-runner-image-retirement/ 。

00:35 验收环境修正：DeepSeek 已真实返回自然完成、未裁剪的 provider 摘要（6241 输入、419 输出 token），后续调用返回 402 余额不足。原用户要求没有限定线上模型，因此将 CCF-05 的模型身份从错误固化的单一供应商改为当前已配置可用模型；原模型失败及已成功摘要证据仍保留，不声称原机验证通过。用户结果、失败分支与续跑标准不变，不绕过余额错误或更改账号配置。

design-document: required；plan: not-required（同批实现与原发布 owner 可直接闭环，执行状态写迭代日志）。

方案 Review：从原输入反查旧失败机制、当前结果语义与结构重试均覆盖；新字段只承载真实失败事实，领域错误沿既有传播路径消费；手动先应用再报错可避免失败 marker 丢失；自动行为不被 manual 收集策略改变。无未关闭方案 finding，design-review: passed。验收不得用单独摘要生成成功替代 checkpoint 持久化、API 结果与续跑。
