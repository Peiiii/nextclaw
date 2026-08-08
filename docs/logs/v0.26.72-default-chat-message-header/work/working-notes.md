# 新会话思考状态连续性工作笔记

## 当前目标

保证发送动作被前端接受后，首条用户消息立即进入消息列表；到首个可见助手输出或明确终止之前，“Agent 正在思考...”在 draft → 正式 session materialization 期间连续存在，且两者不换位。

## 当前事实

- draft 发送时 `useNcpAgentRuntime` 的 `sessionId` 是 `undefined`，本地 `sendingSessionId` 因而只属于 draft 身份。
- 旧实现只有 `envelope.sessionId` 已存在时才创建乐观用户消息；根新会话首发会把 `pendingMessage` 直接设为 `null`，因此用户消息只能等 handle / 服务端事件后插入时间线。
- UI 已有 `createNcpSessionId()`，kernel 的 `getOrCreateAgentRunSession()` 也支持调用方提供尚不存在的 session ID；根新会话可以在提交时预分配正式身份，无需制造临时协议消息或空 session ID。
- `/send` 返回的 `NcpRunHandle` 是命令接受确认；`runId !== null` 表示该请求已经成为活动 run。
- handle 返回后，上层立即把路由切换为正式 session ID；旧实现同时结束本地 `isSending`，但没有把 handle 投影进 conversation manager 的 `activeRun`。
- 正式 session 的 SSE 是纯 live stream，不回放 materialization 前已经发布的 `run.started`。
- `useHydratedNcpAgent` 发现 draft manager 已含正式 session 的乐观用户消息后会跳过 seed hydration，因此错过的活动 run 不会由 hydration 自动补回。

## 关键约束 / 不变量

- draft ID 与正式 session ID 是同一提交生命周期的身份迁移，不是两个 run。
- 同一条首发用户消息从提交、handle 确认到正式路由必须保持同一个 message/session 身份；不能由组件再维护一条占位消息。
- accepted handle、SSE run 事件和 hydration 只能汇入同一个 conversation state manager；禁止为思考提示新增平行 store、计时器或组件特判。
- 重复到达的同一 `run.started` 必须幂等，不能清空已经积累的 execution metadata。
- “正在思考”只在尚无可见助手输出时显示；输出出现后由消息表面隐藏，run 生命周期仍由 manager 保持到 terminal event。

## 证据 / 观察点

- 修前聚焦测试：`use-ncp-agent-runtime.test.tsx -t "keeps an accepted run active while a new root chat materializes"` 稳定失败，handle 已返回但 `result.current.isRunning` 为 `false`。
- 第二组修前测试稳定证明：controller 未给根新会话预分配 session ID；即使 envelope 已有预分配 ID，runtime 在 route session 仍为空时也拒绝展示乐观消息。
- 代码首个违约 hop：`useNcpAgentRuntime.send()` 消费 handle 后只补入 materialized 用户消息，未建立 `activeRun`，随后 `finally` 清除本地 sending。
- 服务端 live stream：`createNcpSessionEventStreamResponse` 只订阅未来 `eventKeys.ncpEvent`，没有历史回放。

## 已验证结论

- 已证实：根新会话提交时预分配 session ID，再将 `runId !== null` 的 accepted handle 映射为标准 `RunStarted` 事件，可让用户消息和 run 状态共同跨越正式路由切换。

## 已排除项

- 仅移除 UI 的后端 `running` 门控：只能保证单个 draft render，无法跨 materialization 保持状态。
- 在组件中保留 `optimisticThinking`：会制造第二状态源，且无法正确处理 run 终止。
- 用延时或最短展示时长遮住闪烁：只掩盖状态丢失，不修复生命周期合同。

## 关键决策

- 正确 owner 是 NCP conversation state manager；React hook 只把 accepted handle 转成已有标准事件。
- 使用已有 manager 与 `RunStarted` 合同，不新增 manager、store、helper、兼容分支或 effect。
- root draft 的 session 身份由提交 controller 使用现有 ID 生成器预分配；child materialization 继续遵守服务端“不得携带既有 session ID”的当前合同，不在本次扩大协议范围。

## 已完成

1. manager 对重复的相同 run start 幂等。
2. root draft 提交时预分配 session 身份，用户消息在请求返回前进入时间线。
3. `send()` 返回 handle 前批量写入已接受用户消息与 active run。
4. 修前失败测试、materialization 回归集和三包 TypeScript 检查通过。
5. 真实页面采样证明 draft → 正式 session 前后，用户消息与思考提示同时存在、顺序和坐标稳定；首个回复出现后思考提示正常消失。

## 剩余边界 / 交接提醒

- child materialization 仍由服务端生成 session ID；若后续要求子会话首条消息具备同样的请求前乐观展示，需要先扩展“预分配但尚不存在的 child session”协议合同，不能复用根会话条件做组件补丁。
