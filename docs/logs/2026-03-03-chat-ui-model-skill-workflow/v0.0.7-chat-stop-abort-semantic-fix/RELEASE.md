# v0.0.7 Release

## 发布/部署方式

1. 发布 `@nextclaw/core`（包含 AgentLoop abort 语义修复）。
2. 发布并部署依赖该核心能力的运行层包（至少 `nextclaw`）。
3. 重启服务后执行一次“发送后立刻 Stop”的线上冒烟：
   - 不应出现 `tool calls did not converge after ... iterations`。
   - 会话应保留已产生的 partial，不应展示误导性错误。

## 变更类型判定

- 涉及后端运行时逻辑；不涉及数据库迁移。
