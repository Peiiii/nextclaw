# Codex 会话跨模型连续性设计

## 背景

同一个 NextClaw Codex 会话切换模型后，当前实现会创建新的 Codex thread。界面中的会话和历史消息仍在，但底层模型上下文已经断开，不符合“一个产品会话对应一个外部运行时会话”的预期。

## 现状依据

- NextClaw session metadata 持久化 `codex_thread_id`，它是恢复 Codex thread 的外部身份。
- Codex NARP wrapper 同时用 `codex_thread_model` 校验当前模型；模型不同时返回空 `threadId`，触发 `thread/start`。
- 新 thread 创建后会覆盖原来的 `codex_thread_id`，而新 thread 只收到当前用户消息，不会自动重放旧对话。
- 修前回归测试已证明：运行时默认模型切换到自定义模型时，当前实现返回 `threadId=null`。

## 核心判断

NextClaw session 是会话身份 owner；model、provider、thinking 和 API route 都只是每轮执行参数。模型不能成为隐式会话身份键。原实现是在 runtime-default 支持中加入的防御性隔离，但它把路由兼容风险转化成了确定的上下文丢失。

## 推荐方案

1. Codex NARP wrapper 只按 `codex_thread_id` 恢复 thread，不再按模型作用域拒绝恢复。
2. Codex SDK 与 app-server runtime 停止写入 `codex_thread_model`，删除这份重复且误导性的身份事实。
3. 模型和 provider 继续通过现有 thread/turn overrides 传给 Codex，不新增映射表、fallback 或平行历史链路。
4. 已有会话只要保存了 `codex_thread_id` 就直接恢复；遗留的 `codex_thread_model` 字段可以保留在旧 metadata 中，但不再读取或更新。

## Owner 与数据流

`NextClaw session -> codex_thread_id -> Codex thread/resume -> 本轮 model/provider overrides`

- SessionManager 继续负责持久化 runtime metadata。
- Codex runtime 只在首次创建 thread 时回写 `codex_thread_id`。
- Codex NARP wrapper 负责把持久化 thread 身份与本轮模型路由组合成运行配置。

## 验收标准

- 回归测试覆盖“已有无模型作用域的 thread”和“运行时默认模型切换到自定义模型”，两种情况都必须复用原 `codex_thread_id`。
- metadata writer 不再产生 `codex_thread_model`。
- Codex NARP 与 Codex SDK 定向测试、TypeScript、lint 和治理检查通过。
- 真实或最贴近真实的同一 session 跨模型验证中，thread id 保持不变，第二轮能够使用第一轮上下文。

## 非目标

- 不提供用户手动分叉或切换 Codex thread 的产品能力。
- 不维护按模型分组的 thread 映射。
- 不改变普通新会话创建、模型选择和 provider 路由行为。
