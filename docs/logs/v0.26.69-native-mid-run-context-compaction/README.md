# Native 单次长任务自动上下文压缩

## 迭代完成说明

- 根因：Native runtime 只在 run 开始前执行一次 context preflight；一次 run 内的工具结果与追加输入继续增长时，后续模型轮次只经过硬预算裁剪，没有再次进入语义压缩。与此同时，同一 run 的多个模型轮次共用一条持续增长的 assistant message，单纯复用 timestamp checkpoint 会把压缩后新增的 parts 一并过滤。
- 确认方式：修前失败测试构造“两次模型采样 + 一次工具结果”的 Native run，观测到 preflight 只调用一次且没有 phase；随后对照 Codex `rust-v0.144.1` 的 pre-turn / mid-turn compaction 调度与上下文窗口实现。
- 根因修复：保留一个 phase-aware preflight owner，在工具结果或追加输入要求继续 run 时执行 `mid-run` 检查；mid-run checkpoint 记录 streaming assistant 的 message id 与已覆盖 part 数量，后续投影只保留新增 parts，并注入仅供模型使用的 continuation message。
- 设计依据：[Codex 对齐的自动上下文压缩设计](../../designs/2026-08-08-codex-aligned-context-compaction.design.md)。
- 兼容性：旧 v1 checkpoint 继续走既有 timestamp 投影；Codex、Claude Code、Hermes 等 runtime-owned 会话不增加 NextClaw 外层压缩。

## 测试/验证/验收方式

- 修前基线：`DefaultNcpAgentRuntime` 测试实际只收到一次 `undefined` phase，预期的 `pre-run / mid-run` 失败。
- 三个触达 package 的 `tsc` 均通过：`@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/ncp-agent-runtime-next`。
- 定向测试通过：runtime 10 条、core 4 条、kernel 20 条；覆盖 phase 调度、全量 mid-run plan、part boundary、rolling compaction、旧 parts 排除与 builder 最终输入。
- package 全量测试：runtime 13/13、core 205/205 通过；kernel 260/264 通过。kernel 的 4 条失败来自工作区既有并行改动（context provider 断言、activity preview 文案和 messaging tool fixture），与本次触达文件无交集；本次 20 条 kernel 定向测试全部通过。
- package lint：runtime 零问题；core 与 kernel 零错误。core 的 24 条 warning 和 kernel 的 1 条 warning 均位于本次未触达文件；所有本次触达文件的 targeted ESLint 另行要求零问题。
- 当前源码完整构建成功，并通过隔离 clone-config 实例验证；构建产生的 `ui-dist` hash 漂移已用 `pnpm clean:generated` 清理，`pnpm check:generated-clean` 通过。
- 真实 Native smoke：`minimax/MiniMax-M3`、26K context、默认 20% reserve、同一 run 内两次顺序 `exec` 各返回 9500 字符。原始输入估算 36,989 token，mid-run 压缩后为 17,352，低于 20,800 触发线；checkpoint 为 `compressed / mid-run`、`continuationMessageCoveredPartCount=4`，最终保留两个 canary 并以 `run.finished` 结束。

## 发布/部署方式

- 本轮源码、测试、changeset、设计文档与迭代记录随当前本地提交纳入版本历史；未推送、未发布、未部署，也未重启用户当前运行实例。
- 已添加 changeset，后续随统一 patch 发布进入 NextClaw 与对应 workspace 包。
- 数据库 migration、线上 API smoke、desktop/runtime update manifest：不适用；本次只改变 Native agent runtime 的本地模型上下文编排。

## 用户/产品视角的验收步骤

1. 使用 Native 会话发起一个会连续执行多个工具、并产生较大工具结果的长任务。
2. 让同一 run 在工具结果后继续下一轮模型请求，不要拆成多个用户 turn。
3. 确认 session metadata 出现 `last_context_compaction.phase=mid-run`，并包含 continuation message part boundary。
4. 确认压缩后不会重复已完成工具调用，后续模型仍记得原始目标和关键工具结果，并正常完成最终回复。
5. 使用 Codex 等 runtime-owned 会话时，确认仍由其自身上下文 owner 管理压缩，不出现 NextClaw 二次压缩。

## 可维护性总结汇总

- 本次是新增用户能力，允许必要生产代码增长；没有新增 manager、adapter、factory 或第二套 summary 算法。
- 代码增减（10 个触达 TS/测试文件）：新增 386 行、删除 22 行、净增 364 行；排除测试后新增 139 行、删除 22 行、净增 117 行。增长主要来自 phase 合同、part-boundary 投影与失败/rolling/builder 回归测试。
- runtime 只负责 follow-up 生命周期的触发时机，kernel preflight/manager 继续拥有预算、摘要和 checkpoint，projection utils 继续只做无状态视图变换。
- 通过复用同一 preflight hook 与已有 checkpoint v1 可选字段，避免平行链路和持久数据迁移；preflight event 应用逻辑收敛为一个 async-generator method，消除了 pre-run / mid-run 重复分支并清除了本次新增 lint warning。
- maintainability guard 无阻塞项；runtime 文件为 587/600 行，是本轮唯一警告。下一步拆分缝是把模型 round drain / tool execution 协调抽成明确 runtime lifecycle owner，不能仅为降行数搬运代码。
- 已使用 `post-edit-maintainability-review` 做独立复核；无新增目录膨胀、无重复 owner、无为通过行数门禁而压缩可读性的做法。

## NPM 包发布记录

- `@nextclaw/core`：需要 patch，待统一发布。
- `@nextclaw/ncp-agent-runtime-next`：需要 patch，待统一发布。
- `@nextclaw/kernel`：需要 patch，待统一发布。
- `nextclaw`：需要 patch，待统一发布。
- 本轮未执行 NPM publish；changeset 已通过 `pnpm release:summary -- --json` 合同校验，无素材错误。本能力没有用户界面视觉变化，release-note 截图不适用。
