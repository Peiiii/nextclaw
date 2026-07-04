# Chat 完成后过程折叠设计

## 背景

长任务完成后，当前 chat 消息会把 reasoning、工具调用、工具结果和最终回答一起铺开。过程证据很重要，但默认展开会挤压最终结论，让用户每次回看都先穿过大段执行过程。

Codex 的“已处理 ...”体验值得参考：任务完成后，执行过程被折叠成一条可展开摘要，最终回答保持可见。这个能力增强的是 NextClaw 作为统一工作台的阅读效率和结果感知，不是新增孤立功能点。

## 现状依据

- NCP 消息持久化的核心事实是 `NcpMessage.parts` 与 `timestamp`。
- `activeRun` / `runId` 存在于运行期 snapshot 和 run event；完成后历史消息本身没有稳定持久化 `startedAt` / `finishedAt`。
- `ChatMessageListContainer` 已经负责把 NCP message 适配成 `ChatMessageViewModel`，并处理上下文压缩、继承 divider 等 timeline 分段。
- `@nextclaw/agent-chat-ui` 的 `ChatMessage` 是纯展示 owner，当前已经支持 reasoning 和 tool card 的局部折叠。
- `ChatReasoningBlock` 完成后默认折叠，tool card 完成后默认折叠，但缺少“整段执行过程”的上层摘要。

## 核心判断

第一阶段推荐只做 UI 视图层折叠，不改 NCP 协议。

原因：

- 用户价值主要来自“完成后阅读最终回答更轻”，不需要等待 run metadata 协议升级。
- 当前协议没有精确 run duration，若强行把近似时间写成 runtime truth 会制造误导。
- 折叠状态是局部可恢复 UI 交互，不需要 store、manager 或持久化。
- 过程证据仍保留在原 message parts 内，点击摘要即可展开，没有丢失可审计链路。

## 推荐方案

完成态 assistant message 满足以下条件时启用整段过程折叠：

- `role === "assistant"`。
- 消息不是 `pending` / `streaming`。
- parts 中存在 reasoning 或 tool-card。
- reasoning/tool-card 后面仍存在最终可见内容，通常是 markdown 最终回答。
- 产品侧提供 `processSummary.label`，第一阶段只显示 `已处理`，不显示未被 runtime 持久化证明的耗时。

渲染规则：

- 默认只显示折叠摘要和最终回答。
- 摘要行整行可点击，箭头只做视觉提示。
- 摘要行使用 Codex 式轻量行内结构，只保留灰色文案、箭头和分隔线，不做圆角、边框、背景色卡片，避免 assistant 消息里再嵌套一层卡片。
- 展开后显示原 reasoning、tool card、工具结果等过程内容。
- 若没有最终回答，不启用整段折叠，继续使用现有 reasoning/tool-card 局部折叠。
- 运行中不折叠，避免用户失去实时进展感知。

## Owner 与数据流

`ChatMessageListContainer`：

- 对最终 assistant message 生成本地化 `processSummary.label`。
- 只做视图投影，不改 raw message，不写 store。

`chat-message-process-summary.utils.ts`：

- 承载无状态的过程摘要推导，包括完成态判断、过程 part / 最终内容判断。
- 由 container 注入本地化的 `已处理` 文案，避免 utility 自己读取语言环境。

`adaptChatMessage`：

- 把 source meta 中的 `processSummary` 透传为 `ChatMessageViewModel.processSummary`。
- 不解析运行状态，不推导业务语义。

`ChatMessage`：

- 作为纯展示 owner，根据 `processSummary` 和 parts 顺序决定折叠 UI。
- 保留原 `ChatReasoningBlock` / `ChatToolCard` 渲染路径，避免复制工具卡片逻辑。

`i18n chat.json`：

- 维护 `已处理` / `Processed` 文案。
- 第一阶段不拼接 duration；后续只有 runtime 提供真实 `startedAt` / `finishedAt` 后才显示耗时。

## 目录组织

- 设计文档：`docs/designs/2026-07-04-chat-completed-process-collapse.design.md`。
- 共享 UI 合同：`packages/nextclaw-agent-chat-ui/src/components/chat/view-models/chat-ui.types.ts`。
- 共享 UI 展示：`packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message.tsx`。
- 产品侧适配：`packages/nextclaw-ui/src/features/chat/features/message/utils/chat-message.utils.ts`、`chat-message-process-summary.utils.ts`、`chat-message-texts.utils.ts` 与 `chat-message-list.container.tsx`。
- 文案：`packages/nextclaw-ui/src/shared/lib/i18n/locales/*/chat.json`。

不新增 store、manager、runtime service 或 NCP protocol 文件。

## 兼容与迁移

第一阶段不改变历史数据。已有 message 没有 `processSummary` 时保持原渲染。

第一阶段只显示 `已处理`，不使用相邻 message timestamp 推导 duration，避免把视图层近似值包装成 runtime truth。后续如果 NCP 持久化 run metadata，再把 summary 来源切到真实 `startedAt` / `finishedAt` 并显示耗时。

## 验收标准

- 已完成 assistant message 中，reasoning/tool 过程默认折叠，最终 markdown 回答仍可见。
- 点击摘要行后，过程内容重新出现。
- streaming/pending assistant message 不被整段折叠。
- 无最终回答的工具消息不被整段折叠。
- 中英文文案走 i18n。
- `@nextclaw/agent-chat-ui` 与 `@nextclaw/ui` 相关 tsc、定向测试、lint/governance 通过或披露既有阻塞。

## 非目标

- 不在本轮补 NCP run metadata 持久化。
- 不做跨会话、跨刷新保存折叠展开状态。
- 不改变 tool card 自身的展示细节。
- 不把所有历史消息重分组成严格 run timeline。
- 不新增全局设置开关。

## 后续实现顺序

1. 扩展 `ChatMessageViewModel`，加入可选 `processSummary`。
2. 在产品侧适配层生成本地化摘要。
3. 在 `ChatMessage` 中实现完成态 assistant 过程折叠。
4. 补充 shared UI 测试和产品侧适配测试。
5. 跑 tsc、定向测试、lint、治理和可维护性检查。
