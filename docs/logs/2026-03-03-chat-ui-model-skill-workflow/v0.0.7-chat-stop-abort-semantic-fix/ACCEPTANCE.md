# v0.0.7 User Acceptance

## 用户/产品视角验收步骤

1. 在 UI 发送一条会触发工具调用的消息。
2. 回复流式生成过程中点击 `Stop`。
3. 检查会话：
   - 不应出现 `tool calls did not converge after ... iterations` 文案。
   - 不应将本次手动停止展示为系统错误。
4. 再发送一条普通消息，确认会话可继续正常收发。
