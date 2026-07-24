# NCP 会话消息连续性修复

## 迭代完成说明

修复用户发送消息后偶尔没有立即展示、刷新页面后才出现的问题。

根因由三段端到端证据共同确认：NCP React 的发送 hook 此前只等待后端 `send`，没有先把用户消息写入当前会话状态；草稿会话 materialize 为真实 session 后，如果 manager 已保留消息，hydrate hook 会直接返回而不建立实时事件流；实时流断开时只记录错误，不会重新读取 seed 补回断线期间遗漏的事件。修复前的定向测试分别稳定复现了“请求返回前消息不可见”“已有 manager 状态时不启动 stream”“断流后不重连”三个失败条件。

修复落在现有 NCP React 会话状态 owner：已有会话发送时先用标准 `message.sent` 事件乐观写入，同 ID 后端事件继续由 manager upsert 去重；发送失败时同一条消息转为错误状态。草稿会话拿到真实 session ID 后写入同一条消息，并始终建立实时流；流断开后重新读取权威 seed，再恢复订阅。没有在聊天组件新增平行消息列表，也没有重新触发发送请求，因此修复的是消息连续性主链路而不是刷新表象。

## 测试/验证/验收方式

- NCP runtime、排队发送与 hydrate 定向测试：3 个文件、12 个用例全部通过，覆盖现有会话立即展示、草稿 materialize、后端事件去重、发送失败状态、已有 manager 的实时订阅，以及断流后的 seed 恢复与重连。
- `pnpm --filter @nextclaw/ncp-react tsc`：通过。
- `pnpm --filter @nextclaw/ui tsc`：通过。
- `pnpm --filter @nextclaw/ncp-react lint`：0 error；2 条 warning 来自未触达的既有附件文件。
- `pnpm --filter @nextclaw/ui lint`：通过。
- `pnpm --filter @nextclaw/ui build`：通过，确认 UI 能从实际 package 边界组装修改后的 NCP React 源码。
- UI 完整测试：177 个文件中 172 个通过，824 个用例中 810 个通过；剩余 5 个文件、14 个失败与冻结本轮 `master` 上逐项复跑的基线失败完全一致，均不涉及 NCP 消息修复。

## 发布/部署方式

本次只提交并尽量 fast-forward 合入本地 `master`；不 push、不建 PR、不发布 NPM 包、不部署、不执行 migration，也不重启现有 NextClaw 实例。

## 用户/产品视角的验收步骤

1. 打开已有会话，发送一条消息，确认点击发送后消息立即出现在当前会话中，不需要等待模型首个事件。
2. 从新建草稿会话发送首条消息，确认会话生成真实 ID 后，用户消息仍持续可见，后续回复可以实时出现。
3. 在回复期间模拟实时连接短暂中断，恢复后确认断线期间的消息自动补回，且不会重复发送用户请求。
4. 模拟发送请求失败，确认原用户消息保留并显示为失败状态，而不是静默消失。

## 可维护性总结汇总

- 消息写入、去重与错误状态继续由现有 conversation state manager 持有，没有新增 UI 局部消息 owner、第二套队列或发送 fallback。
- hydrate 生命周期删除了旧的 request id、controller ref、三份并行状态和提前返回分支，收敛成单一外部实时流生命周期；同时删除已无必要的 manager dispatch 兼容分支。
- 生产语义代码新增 126 行、删除 133 行、净减 7 行；源码与测试合计新增 364 行、删除 137 行、净增 227 行，增长全部来自回归测试覆盖。
- `post-edit-maintainability-guard` 为 0 error、1 warning；warning 仅提示 hydrate 测试文件本次增长 121 行，文件当前 272 行、仍低于 900 行预算，并给出未来可拆 fixture/builder 的缝。
- `post-edit-maintainability-review` 结论：通过、无主观可维护性 finding；正向减债动作是删除平行状态机与旧兼容路径，owner、错误可观察性和断流恢复边界更清晰。

## NPM 包发布记录

- `@nextclaw/ncp-react`：需要 patch，发布消息立即可见与实时流恢复修复，待统一发布。
- `@nextclaw/ui`：需要 patch，随产品 UI 交付修复后的 NCP React 行为，待统一发布。
- Changeset：`.changeset/fix-ncp-message-continuity.md`。
- 本次未执行 NPM 发布。
