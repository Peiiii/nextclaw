# v0.0.5 Chat Manual Stop Control

## 迭代完成说明

- 新增聊天停止能力闭环：
  - 前端增加发送中 `Stop` 按钮与 `Esc` 快捷停止。
  - 增加后端能力探测接口：`GET /api/chat/capabilities`。
  - 增加后端停止接口：`POST /api/chat/turn/stop`。
  - Stream `ready` 事件新增 `runId`、`stopSupported`、`stopReason`。
- 前端停止按钮按后端能力自适配：
  - 后端支持：可点击停止。
  - 后端不支持：按钮禁用并显示提示。
- 后端 Native 引擎实现真实中止链路：
  - `AbortSignal` 贯通 `UI -> runtimePool -> engine -> providerManager -> provider`。
  - OpenAI/LiteLLM 请求支持取消信号透传。
- 发送中断体验优化：
  - 停止后保留已生成部分文本为本地 assistant 消息，避免“停止即整段消失”。
  - 停止时清空待发送队列，避免继续自动排队发送。
- 新增路由测试覆盖：capabilities/stop/stream-ready(runId+stopSupported)。
