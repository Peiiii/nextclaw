# Codex 会话跨模型连续性设计

## 目标

一个 NextClaw Codex session 始终对应一个 `codex_thread_id`。模型和 provider 只决定当前轮如何执行，不能隐式替换会话身份；`运行时默认 -> 自定义模型 -> 运行时默认` 必须双向连续。

## 根因

第一阶段问题是 NARP wrapper 曾按模型丢弃已有 thread，现已收敛为只按 `codex_thread_id` 恢复。真实双向切换又暴露两项协议问题：

1. Codex app-server 的 thread 会记住上一轮模型；“运行时默认”不传 model override 时，不会自动恢复本地默认模型。
2. OpenAI Responses bridge 把自定义 provider 的 reasoning 文本写入 `reasoning.content`。该字段只接受 OpenAI 自身可回放的加密 reasoning，切回 OpenAI 后历史校验失败。

同时，app-server 会用 `turn/completed` 携带 `status=failed`；旧适配层未检查 status，把失败误报成正常结束，最终只剩“没有 assistant 内容”的二次错误。

## 方案

- `codex_thread_id` 继续作为唯一外部会话身份，不按模型建分支或映射表。
- app-server runtime 从 `model/list` 的 `isDefault` 项解析真实默认模型，并在 thread resume 与 turn start 中显式传入。
- Responses bridge 只把 reasoning 文本写入可移植的 `summary`，保持 `content=[]`，流式与非流式统一。
- runtime 检查 `turn/completed.turn.status`；失败时发出 `run.error` 和真实 provider 错误，不再发出 `run.finished`。
- 删除当前协议不存在的 `turn/failed` 兼容分支，终态只由 `turn/completed` 处理。

## Owner 与数据流

`NextClaw session -> codex_thread_id -> model route -> thread/resume -> turn/start -> turn/completed`

- NARP wrapper：组合稳定 thread 身份与本轮模型路由。
- Codex app-server runtime：解析运行时默认模型、执行 thread/turn、上报终态。
- Responses bridge：生成跨 provider 可回放的模型历史。

## 旧会话处理

本问题发生在尚未发布的开发版本，不增加永久自动迁移分支。已被旧 bridge 污染的本地会话先备份 rollout 与 NCP journal，再在同一 thread 上回滚污染轮次并注入完整的用户/助手文本历史；thread ID 保持不变。

## 验收标准

- 定向测试覆盖默认模型显式恢复、provider-neutral reasoning、失败终态映射。
- 原故障 session 修复后能在同一 thread 正确回答前文。
- 新 session 完整执行 `默认 -> DeepSeek -> 默认`，三轮均有 assistant 内容并保持上下文。
- raw rollout 的模型序列准确，bridge reasoning 的 `content` 为空。
- TypeScript、构建、lint、governance 与可维护性门禁通过。

## 非目标

- 不提供用户手动切换或分叉 Codex thread 的能力。
- 不保留按 provider 特判的历史格式或第二套会话链路。
- 不为未发布的中间实现增加长期迁移兼容。
