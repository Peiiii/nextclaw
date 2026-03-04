# v0.0.6 Chat Send Error + Dedupe Fix

## 迭代完成说明

- 修复停止后消息重复渲染问题：
  - 停止/完成后先拉取历史，再重置临时流式事件。
  - 仅保留必要的一条本地 partial assistant 事件，避免历史事件与临时事件重复叠加。
- 修复“发送失败无可见错误”问题：
  - 在输入区域显示发送错误文本（来自后端流式 error）。
  - 发送前与发送中自动清空旧错误，避免脏提示残留。
- 兼容旧后端（无 capabilities 路由）：
  - `useChatCapabilities` 查询失败时自动降级为 `{ stopSupported: false }`，不阻塞发送流程。
