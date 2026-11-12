# 上下文压缩失败的结果与恢复闭环

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

恢复准备进一步复审：第一次 exact-source 恢复在 NPM 准备阶段因旧源码落后远程 master 被正常同步门拒绝，说明不能把已发布身份当作新发布重新准备。原 immutable NPM artifact 仍在；在原 prepare workflow 先按精确源码 artifact 名查找未过期产物，下载后调用原 importPreparedNpmReleaseArtifact 验证 HEAD/source、manifest、tree fingerprint、tarball 完整性并恢复版本树。存在有效原产物时跳过重新打包，继续原 Runtime 构建；不存在时保留正常新发布准备路径；验证失败明确停止。复用已验证 owner，不新增输入、发布器、版本特判或放宽 master 同步门。默认新源码没有同源产物，行为不变；旧控制平面退役后的恢复可复用原包。设计复审通过，以 artifact 导入真实测试、workflow 合同及同一0.59.4恢复验收。

发布失败补充设计：GitHub 注释明确拒绝 `macos-14-arm64-us-default`，官方说明 macOS 14 runner 已于 2026-11-02 退役。将既有 ARM runner 标签迁移为仍受支持的 `macos-15`，保留 darwin/arm64 架构、Node 20/22/24/26 矩阵及不可变 0.59.4 身份；同步相同 runner owner 的 Runtime、Portable 与 Desktop 验证/构建入口，但不发布 Desktop。当前控制平面按原 owner 恢复已发布身份，复用已成功安装单元和已上传 NPM，不移动 tag。actionlint、既有发布合同测试及真实 ARM job 是验收。方案复审通过；不新增发布器、版本特判或治理脚本。官方依据：https://github.blog/changelog/2026-10-01-github-actions-macos-14-runner-image-retirement/ 。

00:35 验收环境修正：DeepSeek 已真实返回自然完成、未裁剪的 provider 摘要（6241 输入、419 输出 token），后续调用返回 402 余额不足。原用户要求没有限定线上模型，因此将 CCF-05 的模型身份从错误固化的单一供应商改为当前已配置可用模型；原模型失败及已成功摘要证据仍保留，不声称原机验证通过。用户结果、失败分支与续跑标准不变，不绕过余额错误或更改账号配置。

design-document: required；plan: not-required（同批实现与原发布 owner 可直接闭环，执行状态写迭代日志）。

方案 Review：从原输入反查旧失败机制、当前结果语义与结构重试均覆盖；新字段只承载真实失败事实，领域错误沿既有传播路径消费；手动先应用再报错可避免失败 marker 丢失；自动行为不被 manual 收集策略改变。无未关闭方案 finding，design-review: passed。验收不得用单独摘要生成成功替代 checkpoint 持久化、API 结果与续跑。
