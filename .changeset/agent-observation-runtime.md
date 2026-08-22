---
"@nextclaw/kernel": minor
"@nextclaw/extension-sdk": minor
"@nextclaw/ncp": minor
"@nextclaw/ncp-agent-runtime-next": patch
---

新增持久化的 Agent Observation 能力：Agent 可绑定持续刷新的 Context、订阅带过滤与预算的事件源，并通过现有 started/queued/steered 输入链路可靠接收事件。Context 会作为低权限数据固定追加到模型输入尾部，订阅关系、cursor 与待投递事件可在重启后恢复，重复投递由幂等合同拦截。
