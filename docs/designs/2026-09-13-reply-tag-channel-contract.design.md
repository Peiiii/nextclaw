# Reply Tag 渠道输出合同

## 背景与问题

NextClaw 的全局系统提示仍要求模型优先在正文开头输出 `[[reply_to_current]]`。旧的非流式链路会在发送前解析该标记并把目标写入 `replyTo`，但当前 NCP 渠道链路已经改为按文本事件流发送：微信和飞书会在 `MessageTextEnd` 时发送尚未清洗的文本，最终消息阶段的清洗无法撤回已经发出的标记。

同时，当前 NCP 清洗器在没有触发消息 ID 的情况下把 assistant 自身消息 ID 当成 `reply_to_current` 的目标。渠道流式 consumer 也没有消费最终消息的 `reply_to` 元数据。因而该标记在微信链路只会增加泄漏风险，不会形成原生引用回复。

## 用户可观察结果

- AI 的普通回复不再生成或展示 `[[reply_to_current]]`、`[[reply_to:<id>]]`。
- 微信与飞书收到干净正文；微信现有的 `context_token` 会话连续性不变。
- Telegram、Discord、QQ 等渠道已有的结构化 `replyTo` / 入站 `message_id` 回复路径不变。
- 历史消息或旧模型仍输出 reply tag 时，标签继续被兼容清洗，不作为正文展示。

## Owner 与主链路

Reply tag 不再是模型正文协议。渠道引用回复由结构化消息字段拥有：入站回复沿渠道 metadata 自动路由，主动发消息由 `message` 工具的 `replyTo` 参数表达。

模型正文的兼容清洗仍由 `@nextclaw/ncp` 的 reply-tag toolkit utils 统一拥有，NCP 会话投影、历史 hydration 和渠道流式 consumer 复用同一清洗语义：

```text
assistant text event
  -> NCP reply-tag compatibility sanitizer
  -> clean text part
  -> channel Chat adapter
  -> provider send API
```

## 设计决策

1. 删除全局 `Reply Tags` context provider 及其注册，并删除网关重启恢复提示中的显式 tag 指令，不再教模型生成正文控制标记。重启恢复已有的结构化 `reply_to` metadata 继续保留。
2. 保留 `stripReplyTagsFromText` / `sanitizeAssistantReplyTags`，用于历史数据和旧模型输出兼容；只把文本开头的 tag 视为控制标记，正文中用于解释或引用的同名文本必须保留。
3. `sanitizeAssistantReplyTags` 不再默认使用 assistant 消息 ID 解析 `reply_to_current`。只有调用方明确提供真实触发消息 ID 时才生成 `reply_to`；否则仅清除标记。
4. NCP 渠道 consumer 在每个文本块送入 Chat adapter 前复用 reply-tag sanitizer，防止最终消息清洗之前发生流式泄漏。
5. 不给微信伪造原生引用能力；其发送接口和 `context_token` 语义保持不变。

## 放弃的路径

- 只删系统提示：无法覆盖旧上下文、旧模型和历史输出，流式边界仍可能泄漏。
- 删除全部 parser：会让历史消息重新显示控制标记，并破坏显式 `[[reply_to:<id>]]` 的兼容读取。
- 给微信增加 `replyTo`：当前微信 provider API 没有对应消费合同，属于无真实能力支撑的字段扩张。
- 新增一套渠道专用 parser：会制造与 NCP toolkit 并行的语义 owner。

## 验收标准

1. 系统上下文不再包含 `Reply Tags` 或生成 reply tag 的指令。
2. 网关重启恢复提示不再要求模型输出 reply tag，结构化恢复 metadata 保持不变。
3. NCP 渠道事件流包含完整或按 delta 拼接的 `[[reply_to_current]]` 时，Chat adapter 只收到干净正文。
4. 旧 assistant 消息 hydration 仍会清除两种 reply tag。
5. 没有真实触发消息 ID 时，`reply_to_current` 不产生指向 assistant 自身的 `reply_to`。
6. 显式 `[[reply_to:<id>]]` 仍转换为对应结构化 metadata。
7. 正文中用于解释的 reply tag 文本不会被误删。
8. 受影响 TypeScript package 的定向测试、构建和 `tsc` 通过。

## 非目标

- 不改变 `<noreply/>`、reasoning tag 或其它模型输出协议。
- 不新增渠道能力或修改第三方 provider API。
- 不迁移已经持久化的 metadata；读取时兼容清洗即可。

## 交付与风险

本次是内部协议收敛和用户可见缺陷修复，不新增用户操作入口，因此用户文档不适用；修复会改变用户实际收到的消息正文，需要 patch changeset。实现完成后需通过 diff-only maintainability review。未经额外授权不提交、推送、发布或部署。
