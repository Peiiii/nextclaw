---
"@nextclaw/ncp-agent-runtime": patch
"@nextclaw/ncp-agent-runtime-next": patch
"@nextclaw/kernel": patch
"@nextclaw/core": patch
---

保留连续工具调用的历史顺序，减少多步任务中的重复输入与缓存失效；修复公共 Harness 模型流式调用无法正常执行的问题。

精简重复的会话参数和消息交付说明，将 inline 展示细则改为使用前读取，保留能力触发、关键约束及完整展示协议。

保持会话搜索工具声明稳定，未就绪时明确返回索引状态。修复压缩保留最后一轮回复时恢复整段旧工具历史的问题，并校正后续轮次边界。

原生模型保留工具名称与用途声明，将较大的非基础工具参数改为通过 tool_schema 按需查询；执行时继续使用完整参数校验，减少不使用工具的持续输入开销。
