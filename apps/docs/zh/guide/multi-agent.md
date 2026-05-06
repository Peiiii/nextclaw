# 多 Agent 路由

多 Agent 路由是高阶能力。它适合在你已经稳定使用 NextClaw 之后，把不同任务交给不同 agent 或 runtime。

## 什么时候需要

- 不同任务需要不同模型或运行时
- 你希望某些会话绑定特定 agent
- 你在测试 Claude Code、Codex、Hermes 等不同运行路径
- 你需要把实验能力和日常主入口隔离

## 什么时候不需要

第一次跑通不需要多 Agent。  
日常单人使用也通常不需要一开始就拆很多 agent。

## 使用原则

- 先保留一个可靠主入口。
- 再为明确场景增加 agent。
- 每个 agent 应该有清楚职责。
- 不要把路由当成解决配置混乱的办法。

## 相关文档

- [对话与会话](/zh/guide/chat)
- [命令索引](/zh/guide/commands)
- [Claude Code / Codex / Hermes 集成](/zh/guide/tutorials/claude-codex-hermes)
