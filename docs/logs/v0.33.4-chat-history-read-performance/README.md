# v0.33.4 会话历史读取性能优化

## 迭代完成说明

- 将 NCP 会话首次 hydration、历史分页和服务端缺省页大小从 80 条统一降为 40 条，减少长会话打开与恢复时的消息传输和前端状态注入成本。
- `NcpAgentSessionMessageProjectionStore` 在没有未稳定 journal tail 时直接随机读取目标 ordinal 区间，不再为一页消息构建完整 `messageId -> ordinal` Map；tail 非空时继续走原有覆盖与追加去重路径。
- `SessionManager` 只在最新页计算准确 context window，cursor 历史页复用最新页已经写回 projection 的快照，避免向上翻页时重复读取完整 session。
- 保持 journal 事实源、cursor、消息正序、流式 tail、模型完整 session state、context compaction 和 token budget 语义不变。
- 设计依据见 [`docs/designs/2026-08-13-chat-session-history-read-path-optimization.design.md`](../../designs/2026-08-13-chat-session-history-read-path-optimization.design.md)。

## 测试/验证/验收方式

- Kernel 定向测试覆盖冷 projection 无 tail fast path、tail 覆盖/追加去重、连续 cursor 分页，以及首次页与 cursor 页的 context window 分工。
- Server 组装后的 Hono route 测试覆盖缺省 `limit=40`、显式 limit 最大 200 和非法 cursor 的稳定 400 错误。
- UI hook 测试覆盖 hydration、连续两次向上分页、终页 `hasPreviousPage=false` 和缺省 `limit=40`。
- `@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/ui` TypeScript 检查通过；触达文件 targeted ESLint 零告警。
- `lint:new-code:governance`、`git diff --check` 通过；diff-only maintainability guard 为 0 error。

## 发布/部署方式

- 本批只完成本地源码、设计、测试、changeset 和 Git 提交，不重启当前 NextClaw 实例，不部署、不发布。
- 后续由统一 NPM/产品发布批次消费 `.changeset/chat-history-load-performance.md`。

## 用户/产品视角的验收步骤

1. 打开消息数超过 40 的已有长会话，确认首先显示最新消息，顶部仍可继续加载更早历史。
2. 连续向上加载至少两页，确认消息无重复、无遗漏，最终到达 `hasPreviousPage=false`。
3. 在运行中的会话刷新或重连，确认 streaming tail 与稳定消息不重复，完成态内容保持完整。
4. 确认 context window 指示在首次进入时仍准确，向上翻页不会改变其当前值。
5. 模型继续基于完整/压缩后的 session context 回复，不受 UI 每页 40 条限制影响。

## 可维护性总结汇总

- 沿既有 UI hook、HTTP controller、SessionManager 和 projection store owner 收敛，没有新增 cache、service、wrapper、索引文件或兼容分支。
- 自动 guard 首次发现 projection store 被条件分支推过 400 行预算，随后用等价主流程收敛消除 blocker；最终两个触达 source 文件都恢复到改动前行数，非测试源码净增长为 0。
- 最终 guard 仅报告 manager 593/600、projection store 398/400 两个未恶化的既有临界预算 warning；按条件主观复核后无可维护性发现。
- 新设计、测试和迭代文件均通过命名、目录、role boundary 和 module structure 治理。

## NPM 包发布记录

- `@nextclaw/kernel`：需要 patch，changeset 已添加，待统一发布。
- `@nextclaw/server`：需要 patch，changeset 已添加，待统一发布。
- `@nextclaw/ui`：需要 patch，changeset 已添加，待统一发布。
- 本次未执行 NPM 发布。
