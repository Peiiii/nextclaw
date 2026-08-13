---
name: delivering-delegated-linear-issues
description: 当用户明确要求领取、处理、批量清空或定时扫描 Linear 的 `Delegated to Agent` issue 时使用；按队列状态、领取竞争、交付路径和收尾四个阶段渐进读取。
---

# Linear 委派交付

## 阶段路由

- 判断标签、状态、队列、定时会话归属：读取 [状态与队列](references/state-and-queue.md)。
- 领取前调查、Run ID、幂等与竞争：读取 [领取合同](references/claim.md)。
- 隔离开发、ready PR 或本地 master：读取 [交付路径](references/delivery-paths.md)。
- Delivered/Blocked、评论、恢复异常：读取 [收尾与恢复](references/closure.md)。

一次只读取当前阶段；进入实现后遵循项目标准开发合同，不重新加载上游 lifecycle，也不在本 skill 复制开发规范。

## 永久合同

- `Delegated to Agent` 和 `Delivery: Local Master` 是用户标签，Agent 永不自动添加或删除。
- `Agent: Queued/Claimed/Blocked/Delivered` 是互斥持久状态，Agent 第一次写入后只能完整替换，不清空，也不覆盖其它标签。
- 指定 issue 的用户指令可替代 Delegated 授权；默认交付本地 master，只有明确 PR/禁止本地合并说明才走 ready PR。
- 所有模式都不授权 release、deploy、migration、生产配置/数据或其它不可逆外部动作。
- 每个 issue 独立 worktree/分支；保护用户 WIP，不 stash/reset/force，不因 master dirty 自动放弃隔离开发。
- 第一版队列串行，不宣称多执行者原子租约。

最终状态为 `In Review + Agent: Delivered` 或 `Todo + Agent: Blocked`，永不自动 Done。
