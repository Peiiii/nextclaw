# v0.21.21 Chat Attachment Submit

## 迭代完成说明

- 修复上传文件、上传图片或粘贴图片后，composer 中可见附件 token 但点击发送后附件没有进入真实发送 payload 的问题。
- 修复已进入消息的图片附件在 MiniMax 等 OpenAI-compatible provider 上请求失败的问题。
- 根因：上传完成后先写入 `attachments`，再同步插入 file token；file token 触发 `onNodesChange` 时，旧实现用渲染闭包里的旧 `inputSnapshot.attachments` 执行 prune，把刚上传的附件事实覆盖为空。
- 第二层根因：NCP user content 转换层把图片附件默认转成带 `image_url.detail: "auto"` 的 OpenAI-compatible 内容块；MiniMax-M3 会拒绝该值并返回 `invalid image detail: auto`，导致图片已经持久化但模型无法识别。
- 确认方式：新增组件级复现测试，走真实 `SessionConversationInput`、上传适配、file token 插入和 `useSessionConversationController` envelope 构造。修复前测试失败，表现为 DOM 可见 `sample.png` token，但点击发送后 `send` 未被调用；修复后发送 envelope 中包含 `file` part。
- 修复方式：`handleNodesChange` 改用 input state owner 的 functional update，在同一个 state transition 中读取最新 `current.attachments` 后 prune，避免旧闭包覆盖新附件事实。
- 第二层修复方式：NCP runtime 默认不再发送 image detail，让 provider 使用自身默认值；只有上游显式给出图像细节时才应传递该语义。

## 测试/验证/验收方式

- 复现失败：`pnpm -C packages/nextclaw-ui test -- src/features/chat/features/conversation/components/__tests__/session-conversation-input.streaming.test.tsx -t "keeps uploaded file attachments"` 修复前失败，`send` 调用次数为 `0`。
- 修复后定向复验：`pnpm -C packages/nextclaw-ui test -- src/features/chat/features/conversation/components/__tests__/session-conversation-input.streaming.test.tsx -t "keeps uploaded file attachments"` 通过。
- 当前状态补验：`pnpm -C packages/nextclaw-ui test -- src/features/chat/features/conversation/components/__tests__/session-conversation-input.streaming.test.tsx -t "keeps uploaded file attachments"` 通过。
- 相关回归：`pnpm -C packages/nextclaw-ui test -- src/features/chat/features/conversation/components/__tests__/session-conversation-input.streaming.test.tsx src/features/chat/features/conversation/hooks/__tests__/use-session-conversation-controller.test.tsx src/features/chat/features/input/utils/__tests__/chat-composer-state.utils.test.ts` 通过。
- 类型检查：`pnpm -C packages/nextclaw-ui tsc` 通过。
- Kernel 类型边界补验：`pnpm -C packages/nextclaw-kernel tsc` 通过。
- Lint：`pnpm -C packages/nextclaw-ui lint` 通过。
- NCP runtime 定向回归：`pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime test -- src/__tests__/context-builder.test.ts src/__tests__/utils.test.ts` 通过。
- NCP runtime 全量测试：`pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime test` 通过，5 个测试文件、17 个测试通过。
- NCP runtime 类型检查：`pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime tsc` 通过。
- NCP runtime Lint：`pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime lint` 通过。
- 真实链路烟测：通过 `/api/ncp/agent/send` 向隔离会话 `ncp-mr7d8m9z-5d9b75f4` 发送同一图片资产与 `minimax/MiniMax-M3`，不手写 timestamp，让服务端生成消息时间；最终 session `status=idle`，无 `invalid image detail: auto`，助手消息包含正常 `text` 回复并准确描述图片中的 NextClaw 欢迎页和中文文案。验收后已删除隔离烟测会话，避免污染用户会话列表。
- 治理检查：`pnpm lint:new-code:governance -- <touched source files>` 通过；`pnpm check:governance-backlog-ratchet` 通过。

## 发布/部署方式

- 未部署。
- 未提交、未推送、未发布。
- 已新增 changeset：`.changeset/chat-attachment-submit.md`。
- 后续进入统一发布批次时，应发布 `@nextclaw/ui` 与 `@nextclaw/ncp-agent-runtime` patch。

## 用户/产品视角的验收步骤

- 在聊天输入框上传文件、上传图片或粘贴图片后，输入框内应出现对应附件 token。
- 不输入文字、只发送附件时，发送按钮应可用。
- 点击发送后，用户消息应保留对应文件或图片附件；模型侧应能收到附件引用，而不是只收到空消息或纯文本。
- 使用 MiniMax-M3 等兼容 provider 处理图片附件时，请求 payload 不应包含默认 `detail: "auto"`，模型应能正常读取图片。
- 发送失败时应恢复原 composer snapshot，包括附件 token 与附件事实。

## 可维护性总结汇总

- 本次修复落在前端 composer/input 状态 owner，不在发送层或后端执行层新增兜底。
- provider 兼容性修复落在 NCP user content 转换 owner，不在 MiniMax provider 层新增特殊分支。
- 生产代码通过 functional update 删除旧闭包依赖，避免增加第二套附件缓存或兼容路径。
- NCP runtime 删除默认 detail 字段，减少跨 provider 请求形态假设。
- 新增测试覆盖真实组件链路和 envelope 边界，避免只测纯函数而漏掉上传、token 插入与 state batching 的顺序问题。
- `post-edit-maintainability-guard` 通过，非测试生产代码净变更 `+4 / -8 / net -4`；仅剩测试文件增量和 input 组件接近预算的提醒。

## NPM 包发布记录

- 本次未执行 NPM 发布。
- 涉及待后续统一发布的包：`@nextclaw/ui`、`@nextclaw/ncp-agent-runtime`。
- 当前状态：已新增 patch changeset，待统一发布。

## 红区触达与减债记录

### packages/nextclaw-ui/src/features/chat/features/conversation/components/session-conversation-input.tsx

- 本次是否减债：是。
- 说明：删除了 `handleNodesChange` 对渲染闭包附件快照的依赖，改为在 input state owner 的 functional update 中读取最新附件事实，减少状态竞争和重复事实来源。
- 下一步拆分缝：该组件仍承担 toolbar、input surface 和 composer wiring；后续若继续增长，应把附件/toolbar wiring 进一步下沉到更窄的 business hook 或 manager。

### packages/ncp-packages/nextclaw-ncp-agent-runtime/src/runtime/user-content.utils.ts

- 本次是否减债：是。
- 说明：删除图片附件转换时的默认 `detail: "auto"`，让 OpenAI-compatible 请求保持更小、更通用的合同形态，避免 provider-specific 参数污染 NCP 主链路。
- 下一步拆分缝：若未来需要 provider 能力矩阵，应由模型/provider capability owner 显式决定，而不是在 NCP 基础转换层默认注入。
