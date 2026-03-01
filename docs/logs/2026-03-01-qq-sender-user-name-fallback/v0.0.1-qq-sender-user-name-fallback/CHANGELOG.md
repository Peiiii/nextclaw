# v0.0.1-qq-sender-user-name-fallback

## 迭代完成说明（改了什么）

- 修复 QQ 入站昵称提取字段兼容：`packages/extensions/nextclaw-channel-runtime/src/channels/qq.ts`。
- `resolveSenderName` 新增对 `sender.user_name` 的支持（SDK 常见字段）。

## 交付结果

- QQ 私聊若事件中存在 `sender.user_name`，可被识别并注入到入模身份前缀，提升“我的昵称是啥”类问题命中率。
