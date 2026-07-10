# v0.22.17 Historical Visual Context Budget

## 迭代完成说明

本次修复 native/NCP 会话在短对话里突然回复“没有上下文”的问题。用户现场会话 `ncp-mrez818n-fc1f9e78` 没有触发上下文压缩，context window 也显示 `droppedHistoryCount=0`，但真实模型输入在进入 `InputBudgetPruner` 前被历史 `view_image` 的 `data:image/png;base64` 重新展开到约 748k tokens，最终预算器只保留了 `system` 和当前用户消息。

根因是 `ncpMessageToOpenAiMessages` 对已经 final 的历史 assistant 工具结果仍然恢复视觉观察消息，导致图片二进制每轮作为历史上下文重新进入模型输入。修复后，final 历史消息只保留工具结果文本和元数据，不再重放视觉二进制；仍在当前轮流式执行中的工具结果继续保留视觉观察。

后续追查还确认了第二层问题：`view_image` 的 `high` 与 `original` 过去都会把原文件直接 `readFile` 后转成 base64，没有 resize、重编码或模型输入体积上限；同时 `InputBudgetPruner` 会把 `data:image/...;base64` 当成普通文本长度估算，导致当前轮视觉输入也可能错误挤掉正常对话历史。修复后，默认 `high` 会按 2048px、5MB base64 与 2500 个 32px patch 三重上限准备图片，必要时 resize/re-encode；显式 `original` 继续保留原始字节语义。预算器对 image data URL、`image_url` 和工具内部 raw image object 使用有界视觉输入估算，不再按原始 base64 字符数计算。

方案设计已沉淀到 `docs/designs/2026-07-11-visual-input-budget.design.md`；旧 `view_image` 设计文档中的“本轮不实现 resize”非目标已修正为指向该预算方案，避免文档冲突。

## 测试/验证/验收方式

- 旧逻辑模拟：同一会话前 5 条消息展开后 `estimatedTokens=748415/200000`，prune 后只剩 2 条消息，用户消息只剩“注意，我说的是下载到本地。”
- 修复后同会话重建：6 条源消息展开为 40 条模型消息，`estimatedTokens=33111/200000`，`droppedHistoryCount=0`，三条用户消息全部保留，且最终输入不含 `data:image/png;base64`。
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime test -- src/__tests__/tool-result-content.manager.test.ts`：通过。
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime-next test -- src/runtime/agent-runtime-visual-output.test.ts`：通过。
- `pnpm -C packages/nextclaw-kernel exec vitest run src/services/agent-run-model-input-builder.service.test.ts`：通过。
- `pnpm -C packages/nextclaw-core exec vitest run src/features/agent/features/tests/filesystem.tool.test.ts src/features/agent/services/input-budget-pruner.service.test.ts`：通过，2 个测试文件、18 个测试，覆盖默认 high 图片缩放、patch 预算 metadata、2.5MB image data URL 不触发历史裁剪、有尺寸图片按尺寸估算、raw image tool payload 不按 base64 文本估算。
- `pnpm -C packages/nextclaw-core test`：通过，39 个测试文件、186 个测试。
- `pnpm -C packages/nextclaw-core tsc`：通过。
- `pnpm -C packages/nextclaw-core lint`：通过，保留 24 个无关既有 warning，触达文件无新增 warning/error。
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime tsc && pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime lint`：通过。
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime-next tsc && pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime-next lint`：通过。
- `pnpm -C packages/nextclaw-kernel tsc && pnpm -C packages/nextclaw-kernel lint`：通过，保留一个无关旧 warning：`agent-run-request.manager.test.ts` 测试函数过长。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `git diff --check`：通过。

## 发布/部署方式

无需单独部署。该修复随下一次统一 NPM/桌面发布带出。

## 用户/产品视角的验收步骤

1. 创建 native/NCP 会话，发送会触发图片观察或 `view_image` 工具结果的请求。
2. 等工具结果 final 后继续发送依赖前文的短句，例如“注意，我说的是下载到本地。”
3. 期望回复能延续前文任务，而不是声称没有上下文或像新会话初始化。
4. 期望 context window 和真实模型输入预算都不因为历史图片二进制出现大幅偏差。

## 可维护性总结汇总

本次把修复落在 NCP message 到 OpenAI message 的转换 owner，而不是在预算器里特殊隐藏图片。这样历史消息的模型输入合同更清楚：final 历史记录保留可读工具摘要，当前轮流式工具结果保留视觉观察。

maintainability guard 结果：inspected files 4，total `+168 / -23 / net +145`，non-test `+21 / -21 / net +0`，无 errors/warnings。测试增长来自把“final 历史视觉 payload 不重放”和“streaming 当前轮视觉 payload 仍可用”固化为回归合同。

补充 `view_image` 图片准备与 image data URL 预算修复后，定向 maintainability guard 结果：

- 测试范围：inspected files 5，total `+267 / -2 / net +265`，non-test `+0 / -0 / net +0`，无 findings。
- 生产代码范围：inspected files 4，total `+362 / -24 / net +338`，non-test `+362 / -24 / net +338`，唯一失败项是非功能净增长门槛。

该批次属于必要增长豁免：旧实现没有任何可删除的图片准备路径，新增代码承担真实缺失的 owner 职责，包括图像解码、尺寸限制、patch 限制、候选重编码、输出体积上限、失败显式报错、预算 metadata 与视觉预算估算。继续压缩会把边界错误重新藏回无类型 helper 或削弱可观察性。为避免 `image.tools.ts` 继续膨胀，已把无状态图片准备逻辑拆到 `features/agent/utils/image-preparation.utils.ts`，工具文件只保留路径、权限和 tool result 合同。

## NPM 包发布记录

- 涉及包：`@nextclaw/ncp-agent-runtime`、`@nextclaw/core`
- 发布状态：待下一次统一 NPM/桌面发布带出
- Changeset：`.changeset/historical-visual-context-budget.md`
