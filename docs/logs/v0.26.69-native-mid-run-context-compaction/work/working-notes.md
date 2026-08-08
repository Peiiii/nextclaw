# Stable prefix 落地工作笔记

## 当前目标

把已实现的 `summary + token-bounded 用户原文` replacement history 收口成显式 `compaction epoch / stable prefix` 合同，并验证同一 checkpoint 下后续模型输入只增长动态 suffix。

后续事故收口追加目标：完整预算面必须覆盖工具 schema、summary 动态输入/输出与最终输出预留；不可用的小窗口在配置保存时拒绝；进程重启后未闭合 run 必须从 journal 收敛到唯一中断终态。

## 当前事实

- pre-run 会保留最新 raw tail；mid-run 覆盖完整有效模型视图。
- checkpoint 已保存 `preservedUserMessageIds` 与可选的边界截断文本。
- projection 已固定投影 `summary -> preserved users -> continuation -> retained raw tail -> dynamic suffix`。
- projection 已返回 stable-prefix message count；builder 同时标出合并 system 中的 summary 字符边界。
- `InputBudgetPruner` 会先按稳定前缀自身确定性规范化启动上下文尾部，再冻结整个 provider 前缀并只裁剪动态 suffix。
- 当前 researcher 的真实固定输入使动态最低窗口为 32562；`100` 与 `3000` 都已在本地 5174 保存接口被明确拒绝，配置保持原来的 1000。

## 关键约束 / 不变量

- timeline 继续 append-only，checkpoint 不复制完整用户正文。
- 同一 checkpoint 内 stable prefix 的消息内容与顺序必须深度相等。
- 下一次压缩允许整体建立新前缀；压缩之间不得重新选择或移动 preserved user messages。
- 最终预算裁剪不得静默删除或截断 checkpoint-owned stable prefix；summary 之后、checkpoint 之外的启动上下文只允许在冻结前被确定性规范化。
- 不新增 Cache Manager，不把 provider-specific cache-control 字段塞进通用 NCP 消息合同。

## 证据 / 观察点

- `ContextCompactionService` 当前按剩余 token 预算选择真实用户消息。
- `buildContextCompactionModelProjection` 返回消息和显式稳定边界。
- `InputBudgetPruner` 的删除、tool protocol 修复和边界截断均跳过受保护消息。
- 连续两次 projection 测试已证明同一 checkpoint 的稳定切片深度相等；final-pruner 测试已证明动态 suffix 不改写它。

## 活跃假设

- checkpoint 记录 retained raw-tail message id 后，可以不依赖 timestamp 猜测 pre-run 稳定成员。
- 仅有 message count 不足以处理 summary 与启动上下文合并后的超大 system；必须再携带 summary 字符边界，并以稳定消息自身而非动态 suffix 计算一次确定性 system 规范化。

## 已排除项

- 不新建 `StablePrefixManager`、cache adapter 或第二套 compaction 算法。
- 不在本轮接入 OpenAI/Anthropic 专用显式缓存字段；本轮只保证 NextClaw 生成的前缀确定稳定。
- 不改 Codex、Claude Code、Hermes 等 runtime-owned 上下文管理。

## 关键决策

- checkpoint 增加可选 `retainedMessageIds`，旧 checkpoint 缺失时保持原 timestamp 投影。
- projection 改为返回 `messages + stablePrefixMessageCount` 的单一合同。
- `InputBudgetPruner` 增加可选保护边界；未传边界的所有旧调用保持现有行为。
- builder 额外传递 `protectedSystemContentChars`；预算闸只允许确定性收缩其后的启动上下文尾部，并固定预留一个最小用户输入空间。
- 不可变稳定内容自身超预算时显式失败，不使用隐藏 fallback 篡改 checkpoint 语义。
- checkpoint 只有经过最终 provider 同口径预算验证后才安装；summary 请求自身也满足动态 `input + max output <= context window`。
- `targetSummaryTokens` 是给 provider 的软目标，`maxInstallableSummaryTokens` 才是 checkpoint 安装硬上限；超过软目标但仍能通过最终预算面的 summary 必须允许安装。
- Agent 保存阶段由 kernel 加载真实 context/tool providers 求解最低窗口，UI/server 不再夹值。
- 启动恢复只向 append-only journal 追加 canonical interrupted `run.error`，conversation projection 统一取消未完成工具调用。

## 下一步

1. 已补修前失败测试并完成 checkpoint retained ids、projection result、message/字符双边界和 final-pruner 保护。
2. 已通过 runtime 10 个、core 17 个、kernel 18 个定向测试；三个 package 全量测试分别为 13/13、210/210、268/268。
3. 三个 package `tsc`、package lint、触达文件 targeted ESLint、new-code governance、backlog ratchet、release summary 与 diff check 均已通过。
4. 既有隔离 Native smoke 已覆盖真实 mid-run 与用户原文保真；本次新增的 stable-prefix 双边界通过 deterministic preflight -> builder assembled test 和 pruner 的跨 suffix 前缀相等测试验收，未重启或影响用户当前运行实例。
5. 后续 3000-token 事故已用 fake summarizer/provider/journal 与真实 kernel contribution chain 做零 Token 验收；本地源码实例保存接口返回动态最低值，未改写用户配置。
6. 真实 MiniMax 超软目标回归已在隔离当前源码实例通过：35K/7K researcher checkpoint 安装成功，完整输入 26,745/28,000；56 条零 Token 专项验证由功能开发任务在完成前主动执行，不接入通用发布门禁。
7. 连续压缩事故已复现为第二次摘要 `providerMaxTokens=4096`、`finishReason=length`；根因是 3 倍软目标 headroom 不足，且 Chat wire 没有消费上层 `thinkingLevel=low`。当前实现改为摘要请求 `off`、MiniMax-M3 wire 显式 `thinking.disabled`、摘要 completion 首次即使用窗口允许的 8K 上限。
8. 隔离真实 MiniMax 验收在同一 run 串行执行三次 9,000 字符 `exec`，checkpoint 覆盖量从 3 到 7 再到 11，最终回复 `DOUBLE_COMPACTION_REAL_SMOKE_OK` 并 `run.finished`；这次证据覆盖了第二、第三次滚动压缩和压缩后继续响应，隔离实例已停止。

## 剩余缺口 / 交接提醒

- 当前工作区有大量与本任务无关的用户 WIP；只触达本文列出的 context compaction / input budget 文件。
- provider-specific 显式 cache breakpoint 仍是单独能力边界；本轮只保证 NextClaw 在 checkpoint、静态上下文和模型配置不变时生成确定的 provider 前缀。
