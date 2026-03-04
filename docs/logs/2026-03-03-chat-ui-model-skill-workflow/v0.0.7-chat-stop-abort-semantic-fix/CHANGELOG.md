# v0.0.7 Chat Stop Abort Semantic Fix

## 迭代完成说明

- 修复手动停止被错误兜底为 `tool calls did not converge after ... iterations` 的问题。
- 在 `AgentLoop` 的两条核心执行路径（普通消息/系统消息）增加多点位中断守卫：
  - 每轮迭代开始前检查 abort。
  - provider 返回后再次检查 abort。
  - 执行每个工具调用前后检查 abort。
  - 进入 fallback 前最后检查 abort。
- 统一将中断转换为 `AbortError` 抛出，保证 service 层按“正常中断”路径返回 partial/final，不再误报“1000 次工具调用未收敛”。
