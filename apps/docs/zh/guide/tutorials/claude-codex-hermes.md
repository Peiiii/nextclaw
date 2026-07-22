# Claude Code / Codex / Hermes 集成

这类集成适合已经理解 NextClaw 基础运行方式的用户。它不是第一次跑通的最短路径。

## 什么时候使用

- 你已经有 Claude Code、Codex 或 Hermes 运行环境
- 你希望把外部 agent runtime 接入 NextClaw
- 你需要在不同 runtime 之间做会话或任务路由

下面是一个使用 Codex 的真实任务：左侧继续讨论并执行项目修改，右侧直接查看生成的 Markdown 架构文档。

![NextClaw 使用 Codex 推进项目并在右侧预览 Markdown 架构文档](/product-screenshots/nextclaw-codex-runtime-markdown-preview-cn.png)

## 接入前确认

- NextClaw 本体已经跑通
- 外部 runtime 可以独立工作
- 你知道希望哪个任务走哪个 runtime

## 基本步骤

1. 先验证外部 runtime 自己可用。
2. 在 NextClaw 中添加对应集成配置。
3. 保存并重启或重载需要的服务。
4. 创建一个测试会话。
5. 用低风险任务验证路由是否正确。

## 使用原则

先保留一个稳定主入口，再接入其他 runtime。  
不要用多 runtime 解决基础配置还没跑通的问题。

## 相关文档

- [多 Agent 路由](/zh/guide/multi-agent)
- [对话与会话](/zh/guide/chat)
- [命令索引](/zh/guide/commands)
