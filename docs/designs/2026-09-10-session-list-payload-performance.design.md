# 会话列表载荷瘦身设计

## 背景与问题

VPS 上的 `/chat` 在 146 个有效会话、约 1.55 GB 会话日志的真实数据集下，浏览器刷新后会长时间停留在“加载会话中”。现场证据表明：

- NextClaw 直连 `/chat` 的首字节约 1.3 ms，经 VPS 本机 Nginx 约 2.1 ms，服务端 CPU 与可用内存正常；
- SQLite 会话摘要索引读取前 100 条约 2 ms，1.55 GB journal 没有进入列表读取主链路；
- 前 100 条索引摘要的 metadata 共约 190 KB，其中仅 `last_context_compaction` 就约 141 KB，占 74%；
- 浏览器会请求 100 条分页列表和 200 条会话摘要，当前 gzip 后响应分别约 80 KB 和 102 KB；
- 真实浏览器复测中，应用壳出现后列表仍需约 1 秒，完整刷新到列表可用约 7 秒，公网传输与前端初始化放大了无关载荷。

根因不是 journal 索引失效，而是 `/api/ncp/sessions` 列表边界把运行时内部的上下文压缩快照作为通用 metadata 原样发送。列表 UI 不读取该字段。

## Owner 与主链路

会话 metadata 的完整事实仍由 kernel session owner 保存；HTTP 列表视图由 `NcpSessionRoutesController` 拥有对外投影。采用以下单一路径：

```text
kernel 完整 session summary
  -> server 规范化运行状态
  -> server 列表投影删除 last_context_compaction
  -> /api/ncp/sessions consumer
```

`GET /api/ncp/sessions/:sessionId` 仍返回完整 metadata，运行时恢复、上下文压缩和单会话诊断不受影响。

## 方案

在 sessions controller 内增加局部的列表投影函数，只从列表响应 metadata 中删除 `last_context_compaction`：

- peerId 列表与分页列表统一使用同一投影；
- `last_activity_preview`、label、项目、模型、thinking、父子会话、已读状态等现有列表消费字段全部保留；
- 不改变 kernel 索引 schema、journal、持久化数据或通用 `NcpSessionSummary` 类型；
- 不引入新 service、缓存、迁移或兼容层。

这是 HTTP consumer 边界上的最窄投影，避免让 kernel owner 为单一 UI 传输问题维护第二份状态。

## 放弃与延后

- 不缩小首屏 100 条分页：现有置顶会话可能较旧，直接缩页会让置顶项在首次加载时消失。
- 不在本次合并 100 条分页与 200 条摘要查询：这些查询服务于不同现有消费者，合并需要重新设计选择会话、子会话和通知的数据 owner。
- 不清理 1.55 GB journal：现场已证明列表走 SQLite 摘要索引，清理用户数据既不能解决根因，也超出本任务授权。
- 不做列表虚拟化或全局 Vite 拆包：它们可能继续改善完整首屏，但不是当前“列表响应携带无关运行时数据”的必要修复。

## 风险与不变量

- 列表仍返回稳定的 `NcpSessionSummary` 结构，只减少一个内部 metadata 键。
- 单会话详情必须保留 `last_context_compaction`，否则可能破坏诊断或未来详情消费者。
- 运行中/异常中断 activity preview 的规范化行为必须保持。
- 修复不修改用户会话、索引或 VPS 配置。

## 验收契约

- `SLP-1`（Required）：列表 API 的普通分页与 peerId 分支均不返回 `metadata.last_context_compaction`。
- `SLP-2`（Required）：列表 API 继续返回 UI 所需 metadata，至少覆盖 label 与 `last_activity_preview`。
- `SLP-3`（Required）：单会话详情 API 继续返回完整的 `last_context_compaction`。
- `SLP-4`（Required）：sessions controller 定向测试、`@nextclaw/server` TypeScript 编译和 diff-only maintainability review 通过。
- `SLP-5`（Required）：修复后用代表性 100 条大 metadata 数据证明列表 JSON 体积显著下降。
- `SLP-6`（Required）：部署到 `8.219.57.52` 后服务健康，真实公网 `/chat` 的会话列表加载指标优于修复前基线；最终体验偏好由用户验收。

## 交付边界

用户已在任务中明确把 VPS 部署与真实公网提速纳入最终交付标准，因此本任务授权在完成验证后部署到 `8.219.57.52` 并复验。提交、推送和公开发布仍未授权。
