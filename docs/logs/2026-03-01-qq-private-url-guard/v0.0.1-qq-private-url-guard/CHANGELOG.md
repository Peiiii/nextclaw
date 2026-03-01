# v0.0.1-qq-private-url-guard

## 迭代完成说明（改了什么）

- 修改 QQ 出站发送逻辑：`packages/extensions/nextclaw-channel-runtime/src/channels/qq.ts`。
- 新增 `40034028`（请求参数不允许包含 url）错误兜底：
  - 首次发送失败命中该错误时，自动将消息降级为安全纯文本并重试。
- 增加 URL/Markdown 链接/`.md` 文件名的安全清洗逻辑，避免再次触发 QQ 私聊参数校验。

## 交付结果

- 像 `USER.md` 这类内容不再导致 QQ 私聊“发不出去且无回复”，系统会自动重试并成功发送可读文本。
