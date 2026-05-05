# 迭代完成说明

- 新增方案文档：[System Status View Model Boundary Refactor](../../designs/2026-05-05-system-status-view-model-boundary.md)。
- 从 `SystemStatusView` 删除聊天场景字段 `isChatBlocked` / `chatMessage`，系统状态层只继续表达 `phase`、`connectionStatus`、lifecycle、错误与 runtime control 等事实。
- 删除 `SystemStatusManager.isChatInteractionBlocked()` 与 `SystemStatusManager.getDisplayMessage()`，避免系统 manager 暴露聊天 UI 策略。
- 在 chat feature 内新增 `ncp-chat-runtime-availability.utils.ts`，由聊天层根据系统事实推导 `isRuntimeBlocked`、runtime 消息与 send error 展示文案。
- 更新聊天输入栏、会话 hydration retry 与发送 manager，统一读取系统事实后在 chat 层做策略推导；本次不改变发送时机和现有禁用行为。
- 续改：发送按钮与 `send()` 内部校验不再使用聚合 `phase === "ready"` 判断，而是只用 `bootstrapStatus.ncpAgent.state === "ready"` 判断 NCP 发送 runtime 是否可用；realtime 断线、`stalled` 等聚合状态不再单独阻止发送。
- 根因说明：
  - 根因是系统事实层混入了聊天场景化展示/交互策略，把 `phase !== "ready"` 这种 chat UI 决策固化成 `SystemStatusView.isChatBlocked`，导致调用方把策略误当成系统事实。
  - 根因通过代码路径确认：`toSystemStatusView()` 直接生成 `isChatBlocked` / `chatMessage`，`useChatRuntimeAvailability()` 与 `NcpChatInputManager.send()` 又依赖这些系统层聊天判断。
  - 本次修复命中根因的方式，是删除系统层聊天策略字段与方法，并把同等行为迁到 chat feature 的 view-model 工具中；这不是改一处按钮条件，而是恢复“事实状态与场景策略分层”的架构边界。

## 测试/验证/验收方式

- 已通过：
  - `pnpm -C packages/nextclaw-ui test -- src/features/chat/utils/ncp-chat-runtime-availability.utils.test.ts src/features/chat/utils/ncp-chat-input-availability.utils.test.ts src/features/chat/hooks/use-ncp-session-conversation.test.tsx src/features/system-status/utils/system-status.utils.test.ts src/features/system-status/managers/system-status.manager.test.ts`
  - 续改验证：`pnpm -C packages/nextclaw-ui test -- src/features/chat/utils/ncp-chat-runtime-availability.utils.test.ts src/features/chat/utils/ncp-chat-input-availability.utils.test.ts src/features/chat/managers/ncp-chat-input.manager.test.ts`
  - `pnpm -C packages/nextclaw-ui tsc`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <touched production files>`
  - 续改 guard：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/features/chat/utils/ncp-chat-runtime-availability.utils.ts`
  - `pnpm lint:new-code:governance`
- 未完全通过项：
  - 续改后 `pnpm lint:new-code:governance` 失败，阻塞点为工作区已有改动 `packages/nextclaw/src/cli/launcher/npm-runtime-update-source.service.ts` 位于 legacy root `launcher/`；本次发送按钮判断改动未触达该文件。
  - `pnpm check:governance-backlog-ratchet` 失败，原因是仓库当前 tracked doc file-name violations 为 `13`，高于 baseline `11`；失败项均为历史文档命名债务，本次新增方案文档通过了 `doc-file-name-kebab-case` diff 检查，未新增该类违规。

## 发布/部署方式

- 本次改动属于前端源码结构调整，随下一次包含 `@nextclaw/ui` 的统一发布进入用户环境。
- 不需要单独数据迁移或运行时配置迁移。

## 用户/产品视角的验收步骤

1. 打开聊天页面，确认 `bootstrapStatus.ncpAgent.state === "ready"` 且输入非空时可正常发送。
2. 在 aggregate `phase` 进入 `stalled/recovering` 但 `ncpAgent.state` 仍为 `ready` 时，确认发送按钮不再因此被禁用。
3. 在 `ncpAgent.state` 非 `ready` 阶段确认输入框仍可编辑，发送按钮仍按 runtime 能力禁用。
4. 制造 transient runtime error，确认恢复中与 stalled 阶段的聊天错误展示仍与之前一致。
5. 检查系统状态相关 UI，确认 runtime badge/control 仍只依赖系统事实字段正常展示。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
  - 删除系统层聊天策略字段和 manager 方法，避免底层事实模型继续夹带场景策略。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。
  - 先删除旧系统层 API，再新增一个小型 chat view-model 工具承接必要策略，没有保留双路径或兼容空壳。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：
  - 代码与文档总增减报告：新增 `368` 行、删除 `198` 行、净增 `+170` 行；净增主要来自方案文档、迭代留痕和新增测试。
  - 排除测试与文档后的非测试生产代码增减报告：新增 `84` 行、删除 `87` 行、净增 `-3` 行。
  - 这次非功能改造满足非测试生产代码不增长，并实际删除了系统层场景策略代码。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：
  - 是。`system-status` 回到事实 view；chat feature 拥有自己的 runtime availability view model；`NcpChatInputManager` 只通过 chat 工具判断发送策略。
- 目录结构与文件组织是否满足当前项目治理要求：
  - 当前触达文件通过 `pnpm lint:new-code:governance`；`post-edit-maintainability-guard` 仅提示 `system-status.manager.ts` 接近文件预算，这是历史热点，本次已让该文件减少 `29` 行。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：
  - 已基于独立复核填写。

可维护性复核结论：通过

本次顺手减债：是

长期目标对齐 / 可维护性推进：
- 这次改动让 NextClaw 的自感知状态更像“事实模型”，而不是混入某个交互入口的临时策略，有利于后续统一入口按不同能力面做更自然的策略编排。
- 可维护性上顺着“代码更少、架构更简单、边界更清晰”的方向推进了一小步：系统状态层少了聊天特例，chat feature 明确拥有自己的 view-model 推导。

代码增减报告：
- 新增：368 行
- 删除：198 行
- 净增：+170 行

非测试代码增减报告：
- 新增：84 行
- 删除：87 行
- 净增：-3 行

no maintainability findings

正向减债动作：删除 / 职责收敛

质量与可维护性提升证明：
- 删除了系统层 `isChatBlocked`、`chatMessage`、`useChatRuntimeAvailability`、`isChatInteractionBlocked()`、`getDisplayMessage()` 等聊天策略出口。
- 聊天相关策略集中到 chat feature 的 `ncp-chat-runtime-availability.utils.ts`，调用方不再把系统事实与交互策略混为一谈。

为何不是单纯压缩行数：
- 本次不是把逻辑压缩到更难读的位置，而是删除错误层级的 API，并把剩余必要策略放到正确 feature 边界下。
- 行数下降来自删除系统层场景策略与旧测试，而不是牺牲类型、测试或可读性。

可维护性总结：
- 这次改造让系统状态模型更纯，聊天策略 owner 更清楚，后续再讨论“更早允许发送”时不会被系统层 `isChatBlocked` 绑死。
- 保留的债务是 `system-status.manager.ts` 仍接近文件预算，以及仓库既有文档命名 ratchet baseline 漂移；本次没有扩大这两类债务。

## NPM 包发布记录

- 本次是否需要发包：需要，待统一发布。
- 需要发布哪些包：
  - `@nextclaw/ui`
- 每个包当前是否已经发布：
  - `@nextclaw/ui`：未发布，待统一发布
- 未发布原因：
  - 当前仅完成源码改造与验证，尚未进入统一 release 批次。
- 后续触发条件：
  - 随下一次前端/UI 统一发布批次一起发布。
