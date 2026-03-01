# v0.0.1-qq-private-nickname-identity

## 迭代完成说明（改了什么）

- 修改 QQ 入站消息逻辑：`packages/extensions/nextclaw-channel-runtime/src/channels/qq.ts`。
- 私聊分支补充 `qq.userName` 写入（有昵称时）。
- 入模身份前缀从“仅群聊/频道群”调整为“QQ 全场景”，包含私聊：
  - `[speaker:user_id=<id>;name=<nickname>] <message>`

## 交付结果

- QQ 私聊中，模型可以看到稳定用户身份；若事件里提供昵称，也能直接看到昵称字段。
