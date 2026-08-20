# v0.40.4 Session Run 插话

## 迭代完成说明

- 在既有 Session 级排队之上新增统一 pending-input owner：`next-run` 继续表示下一轮排队，`next-step` 表示当前 run 的下一安全步骤插话；完整 request/composer snapshot 不被降级为纯文本。
- Native runtime 显式支持 next-step input；当前 NARP/HTTP 等外部 runtime 未声明能力时自动回退排队，并通过 accepted handle 的 `delivery` 返回实际结果。
- 插话采用 `A1(final) -> U2 -> A2` 消息语义：同一 `runId`，U2 使用稳定 message ID，A1/A2 使用不同 assistant message ID；停止、错误或未消费时，插话恢复到下一轮队首。
- 前端保留单一发送按钮：空闲时开始运行，运行中普通 Enter/点击自动排队，Command/Ctrl + Enter 请求插话；排队行可原子转为插话。编辑排队项会恢复到真实 composer，输入框已有草稿时不覆盖。
- 排队行不再把完整 message 降级成纯文本：文本使用紧凑摘要，图片显示缩略图，普通文件显示文件标签；临时 submitting 与服务端 queued snapshot 复用同一投影，编辑时仍从完整消息恢复附件、引用和技能。
- pending 插话先由服务端权威数据投影为用户气泡，消费后用同一 message ID 交接给正式 transcript，避免重复、闪烁和 DOM 重挂载。

## 测试/验证/验收方式

- 8 个受影响 workspace 的 TypeScript 检查通过：NCP、NCP Toolkit、Native runtime、Agent Chat UI、Kernel、Server、Client SDK、UI。
- 定向 ESLint 与 `git diff --check` 通过。
- Native runtime 13 项通过，覆盖 A1/U2/A2 顺序、同 run 不同 assistant message ID、工具/终止与执行元数据。
- Kernel 定向测试 14 项通过，覆盖 capable steer、unsupported queue fallback、严格插话异常不移动队列、未确认 next-step 在终止后回队首。
- Server、Client SDK、NCP Toolkit、UI 与 Agent Chat UI 定向合同测试通过；覆盖 pending/steer HTTP 资源、快捷键、结构化 composer 编辑保护、图片/文件队列摘要、pending→durable DOM 身份稳定。
- 未重启用户当前 NextClaw 宿主；构造器与对象图通过隔离冷实例测试验证。

## 发布/部署方式

- 本轮完成本地实现、设计文档、changeset、验证与用户授权的本地 commit；未授权 push、PR、发布、部署或宿主重启，因此这些动作均不执行。
- 后续由统一 NPM/runtime 发布流程消费 `.changeset/session-run-steering.md`。

## 用户/产品视角的验收步骤

1. AI 空闲时点击原发送按钮，确认正常开始新 run。
2. AI 运行中普通点击发送或按 Enter，确认消息进入输入框上方排队区，不提前进入 transcript。
   - 排队内容含图片时确认显示缩略图，含普通文件时确认显示文件名；只有附件时也不能显示为空消息。
3. AI 运行中按 Command/Ctrl + Enter，确认出现“等待进入下一步”的独立用户气泡；当前 AI 步骤结束后，该气泡保持同一位置并继续生成新的 AI 消息。
4. 对排队行点击插话，确认支持的 Native runtime 在下一安全步消费；不支持或暂不可用时给出明确错误且原排队行不变。
5. 点击排队行编辑，确认完整内容、附件、引用与技能回到主输入框；主输入框已有草稿时编辑动作不可用并显示 tooltip。
6. 在插话尚未消费时停止或制造 run error，确认该输入回到排队队首，随后可作为下一轮继续执行。

## 可维护性总结汇总

- 权威状态仍只归 `SessionRun`；新增 `AgentRunInputDeliveryService` 仅承载公共 pending API 与 runtime 能力协商，不持有队列副本。
- 前端新增 `use-session-pending-input-actions` 收敛临时提交投影和排队行动作，结构化 presentation builder 统一文本/附件摘要，组件只连接和展示；pending transcript 仍以 server/kernel snapshot 为准。
- maintainability 自动检查最终为 0 error、4 个既有/近预算 warning；第一次检查触发的 3 个硬预算 finding 已通过真实 domain seam 拆分关闭，并完成主观复核，结论为 no findings。
- 新文件均通过 planned-path preflight；没有新增兼容开关、隐藏 fallback 或第二套事件链。

## 红区触达与减债记录

### packages/nextclaw-kernel/src/managers/agent-run-request.manager.ts

- 本次是否减债：是。
- 说明：把 pending 列表、删除、严格插话和 runtime 能力协商拆到 `AgentRunInputDeliveryService`，主 manager 相对基线仅净增 1 行并回到硬预算内。
- 下一步拆分缝：runtime event publication 与诊断/产品活动记录可在后续独立批次继续按事件出口拆分。

### packages/nextclaw-ui/src/features/chat/features/conversation/hooks/use-session-conversation-controller.ts

- 本次是否减债：是。
- 说明：排队临时投影与编辑/删除/插话动作进入专用 hook，controller 保留发送编排，未跨越 600 行预算。
- 下一步拆分缝：首轮发送、预设消息与 recovery primary action 可继续收敛为 submission domain hook。

### packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message.tsx

- 本次是否减债：是。
- 说明：pending 状态标签放入 message-list 的 meta footer owner，核心 message renderer 相对基线零增长。
- 下一步拆分缝：按现有 README 规划继续将 message shell 与 part renderer 分离。

## NPM 包发布记录

- 本次用户可见变化需要后续 patch 发布，但当前改动尚未发布，统一状态均为 `待统一发布`：
  - `@nextclaw/ncp`
  - `@nextclaw/ncp-toolkit`
  - `@nextclaw/ncp-agent-runtime-next`
  - `@nextclaw/agent-chat-ui`
  - `@nextclaw/kernel`
  - `@nextclaw/server`
  - `@nextclaw/client-sdk`
  - `@nextclaw/ui`
- 本轮不执行 NPM 发布。
