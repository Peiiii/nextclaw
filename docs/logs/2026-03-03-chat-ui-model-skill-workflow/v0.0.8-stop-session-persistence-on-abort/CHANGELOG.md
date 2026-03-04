# v0.0.8 Stop Session Persistence On Abort

## 迭代完成说明

- 修复“点击 Stop 后会话消失”问题。
- 根因：中断改为 `AbortError` 后，`AgentLoop` 在中断路径提前抛出，未执行 `sessions.save(...)`，导致新会话只在内存存在，前端刷新后看不到。
- 修复：在 `processMessage` 与 `processSystemMessage` 中对执行循环增加 abort catch；捕获到中断时先 `this.sessions.save(session)` 再抛出。
- 效果：手动中断仍保持“非错误语义”，且会话历史可被持久化与重新加载。
