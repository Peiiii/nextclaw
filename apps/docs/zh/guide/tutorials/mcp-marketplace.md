# MCP 教程

MCP 用于把外部能力接入 NextClaw。它属于扩展路径，不是第一次跑通必须项。

## 什么时候需要

- 你已有 MCP server
- 你想让 NextClaw 调用外部系统能力
- 你需要把已有工具链接进 AI 工作流

## 接入步骤

1. 确认 MCP server 能独立运行。
2. 在 NextClaw 中添加对应接入配置。
3. 保存配置并重载。
4. 用一个低风险任务验证调用。

## 使用原则

- 先验证 MCP server 自己可用。
- 再接入 NextClaw。
- 不要把首次上手建立在复杂 MCP 链路上。

## 相关文档

- [扩展能力](/zh/guide/tools)
- [命令索引](/zh/guide/commands)
