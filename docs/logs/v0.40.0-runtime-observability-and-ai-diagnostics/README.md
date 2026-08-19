# v0.40.0 Runtime Observability and AI Diagnostics

## 迭代完成说明

本次把“QQ 偶发丢消息”从一次猜测性修复，提升为 NextClaw 全局运行时可观测能力：关键链路统一产出结构化诊断事件，内置 AI 能按时间窗、领域、结果、原因码和关联 ID 查询证据。

根因未完全定位：当前没有用户现场丢消息时的完整日志，无法证明某一个历史故障就是唯一根因。已经确认的系统性缺口是此前缺少跨 Service、Kernel、扩展和 provider 的统一终态、错误分类与关联证据，因此同类问题发生后无法可靠区分接收、过滤、提交、执行、工具、网络或回复发送阶段。

核心交付：

- 新增统一诊断事件合同与隐私白名单，覆盖 runtime、extension、config、channel、agent、automation、tool 和 transport。
- 取消、网络、HTTP 与未知异常使用稳定原因码，不把原始消息、URL、工具参数/结果、用户身份或凭据写入诊断事实。
- 新增 `nextclaw logs query`，支持时间、级别、领域、事件、结果、原因码和关联 ID 过滤，并披露旧日志解析失败数量。
- 内置自管理 skill 增加运行诊断流程，让 AI 先查询状态与日志，再基于证据缩小故障阶段。
- QQ 接入入站、出站、网关连接和 transport 诊断；诊断队列后台串行发送且 SDK 有界超时，不阻塞消息投递。
- 所有 Kernel 工具统一记录 started/succeeded/cancelled/failed，Agent 的 MessageAbort 不再误记为成功。

## 测试/验证/验收方式

已完成：

- 七个受影响 workspace package 的 TypeScript 检查通过。
- `@nextclaw/kernel` 完整测试 74 files / 358 tests 通过。
- `@nextclaw/extension-sdk` 3 files / 22 tests 通过。
- `@nextclaw/channel-extension-qq` 14 tests 通过。
- 工具取消、嵌套 `ENOTFOUND`、Agent MessageAbort 和结构化 RunError 故障注入通过。
- 临时 JSONL 日志查询验证取消与 DNS 失败可按原因码检索，且不包含工具参数、URL、token 或私密错误详情。
- QQ 诊断 transport 永不返回的测试证明入站投递仍立即完成。
- 相关 lint 无新增 error；diff-only maintainability 门禁为 0 error。
- 源码 CLI 已在真实已有 service 日志上验证 `logs query` 的时间、领域、结果和原因码过滤。

正式运行实例尚未重启到本次版本，因此发布后还需通过公开安装与更新链路验证新命令和诊断事件。

## 发布/部署方式

- 用户已授权包含 NPM/runtime 与 Desktop stable 的全平台正式发布。
- 先执行产品 stable，达到 `NPM_READY` 和 `NEXTCLAW_STABLE_READY`；随后以同一 stable identity 执行 Desktop stable，达到 `DESKTOP_READY`。
- 发布必须使用仓库 `release:product:stable` 与 `release:desktop:stable` 流程，不手工拆散 registry、manifest、GitHub Release 或 APT 步骤。
- 当前状态：待统一发布；发布 commit、版本、workflow、manifest、安装 smoke 与耗时将在闭环后更新本记录。
- 不涉及数据库 migration 或远程数据库 migration。

## 用户/产品视角的验收步骤

1. 让 NextClaw 排查近期渠道、Agent、工具或网络故障，AI 应先查询状态和结构化日志，而不是猜测修复。
2. 执行 `nextclaw logs query --since 30m --outcome failed --json`，应返回可筛选的诊断记录与解析统计。
3. 取消一次工具调用或 Agent 运行，应看到独立 `cancelled` 终态，不应显示为成功或普通失败。
4. 制造可控 DNS/连接错误，应看到稳定的网络原因码，日志中不出现完整 URL、正文、工具参数或凭据。
5. QQ 收发链路应能用同一 correlation ID 串起 extension、kernel 和 provider 阶段；诊断后端不可用时消息投递仍不被阻塞。

## 可维护性总结汇总

本次按最佳努力改善边界，而不是把日志调用继续堆入主类：

- 统一错误分类归 shared，诊断事件校验与日志查询归 core，扩展 ingress 归 kernel feature，QQ 出站与诊断分别有明确 service owner。
- `nextclaw-kernel.ts` 与 `extension-runtime.service.ts` 均通过抽取 factory/service 降低行数和构造职责。
- QQ 主通道在诊断接入后一度增长到 840 行，经审查返工降到 618 行，低于修改前的 627 行。
- 自动 maintainability 检查最终为 0 error；保留两个接近或略超预算的 warning，并完成主观复核。
- 新增文件均通过 planned-path preflight，未新增平行诊断合同或重复状态 owner。

## 红区触达与减债记录

### packages/extensions/nextclaw-channel-extension-qq/src/services/qq-channel.service.ts

- 本次是否减债：是。
- 说明：把出站投递、令牌重试、URL 降级和诊断队列拆到独立 service，主文件从修改前 627 行降到 618 行。
- 下一步拆分缝：若继续扩展 QQ 能力，优先提取入站身份/路由和连接状态机，不再向主类增加 provider 细节。

### packages/nextclaw-kernel/src/managers/agent-run-request.manager.ts

- 本次是否减债：部分。
- 说明：补齐 run 终态诊断并修正 MessageAbort 语义；当前 592 行，仍接近 600 行预算。
- 下一步拆分缝：后续新增运行阶段时，优先提取 runtime event outcome tracker，而不是继续增加 manager 内部状态变量。

## NPM 包发布记录

需要发布，原因是本次改变公共诊断合同、Extension SDK、Kernel/Core/Service 运行行为、QQ 扩展与 `nextclaw` CLI。

发布前状态：

- `@nextclaw/shared@0.4.24`：待统一发布。
- `@nextclaw/extension-sdk@0.3.24`：待统一发布。
- `@nextclaw/core@0.17.4`：待统一发布。
- `@nextclaw/kernel@0.8.7`：待统一发布。
- `@nextclaw/service@0.3.40`：待统一发布。
- `@nextclaw/channel-extension-qq@0.2.24`：待统一发布。
- `nextclaw@0.39.2`：待统一发布，完整未发布批次含向后兼容新能力，产品版本级别为 minor。

正式发布完成后补充精确版本、dist-tag、实际上传包数、registry/安装验证、runtime workflow、阶段耗时和最慢阶段。
