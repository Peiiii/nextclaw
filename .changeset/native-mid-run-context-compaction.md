---
"@nextclaw/core": patch
"@nextclaw/ncp-agent-runtime-next": patch
"@nextclaw/kernel": patch
"nextclaw": patch
---

Native 会话会在同一次长任务的工具调用轮次之间自动压缩上下文；压缩后继续保留任务目标、已完成工具结果和下一步，并只把同一条 AI 回复中新产生的内容发送给后续模型请求，减少长时间自主执行因硬裁剪而丢失上下文的风险。
