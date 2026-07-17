# v0.23.13 上下文压缩模型与失败原子性

## 迭代完成说明

本次修复 NC-126：当 Agent 默认模型与本次运行模型不同时，上下文压缩曾重新读取 Agent profile 的默认模型，导致压缩与正常推理使用不同模型；provider 失败后，manager 又会提前持久化 `compressing` checkpoint，使后续消息反复进入同一条失败链路。

根因通过同 payload A/B 日志、当前源码 owner 链和修前边界测试共同确认：`AgentRunRuntimeContribution` 已持有唯一运行模型 `AgentRunSpec.model`，但压缩输入没有传递它；`AgentRunContextCompactionManager` 则在等待 provider 之前就处理 begin 阶段的 metadata patch 和 timeline event。

修复收敛到现有主链路：

- runtime contribution 将 `spec.model` 直接传给现有 compaction manager，preflight 不再从 Agent profile 二次决定压缩模型；Agent profile 只继续提供 context budget。
- begin 阶段只计算内存中的 pending work，不再返回可持久化 metadata 或 timeline event。
- manager 等 summary provider 和 finish 全部成功后，才一次性持久化 `compressed` checkpoint 并返回唯一 timeline event。
- 未增加 fallback、模型 resolver、失败 checkpoint 状态或第二套恢复路径。

## 测试/验证/验收方式

修前边界基线：新增的四个 manager 回归场景全部失败，分别观察到压缩收到 Agent 默认模型、首次失败写入 `compressing`、滚动失败覆盖旧 checkpoint、重试返回 begin 与 finish 两个事件。

修后验证：

- `pnpm -C packages/nextclaw-kernel exec vitest run src/managers/__tests__/agent-run-context-compaction.manager.test.ts src/features/context-compaction/services/context-compaction-preflight.service.test.ts src/services/agent-run-model-input-builder.service.test.ts`：通过，3 files / 16 tests。
- `pnpm --filter @nextclaw/kernel tsc`：通过。
- `pnpm --filter @nextclaw/kernel lint`：0 error；仅保留既有 `agent-run-request.manager.test.ts` 超长 warning。
- kernel 全包测试：40 files / 179 tests 通过；3 个修前已存在的无关测试失败，分别来自 `context-provider.manager.test.ts` 与 `messaging-tool.provider.test.ts`。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm check:generated-clean`：通过。

真实源码 runtime 冒烟使用隔离实例 `nc-126`、端口 `18896` 和独立 home：

- 将隔离 Agent 默认模型 A 设置为已确认返回 401 的 `custom-3/glm-5.2`，将 context budget 调低到 `1000 / 100`。
- 本次 run 显式选择可用模型 B `minimax/MiniMax-M2.7`；压缩成功生成唯一 `compressed` marker，随后 `run.started -> run.finished`，并准确回答压缩前 marker `NC126_MODEL_OWNER_OK`。默认 A 已独立确认失败，因此该单变量 A/B 结果证明压缩沿用了 B。
- 失败原子性场景使用 A 触发真实压缩失败：第二次请求在 `run.started` 之前返回 401，session metadata 中没有 `last_context_compaction`，journal 中也没有 compaction timeline marker。
- 同一失败会话改用 B 重试：生成唯一 `compressed` marker，并继续到 `run.started -> run.finished`，证明失败状态没有污染后续请求。
- 隔离实例已停止，源码构建生成物已清理。

## 发布/部署方式

- 本轮按用户要求执行仅包含 NC-126 修复的 scoped commit；未执行 push、部署或发布。
- 不涉及数据库 migration、远端服务部署或线上 API 冒烟。
- 修复将通过 `.changeset/context-compaction-model-atomicity.md` 随下一次统一 NPM/runtime 发布带出。

## 用户/产品视角的验收步骤

1. 创建一个接近上下文阈值的 native 会话，并让 Agent 默认模型 A 与会话当前选择模型 B 不同。
2. 发送一条会触发上下文压缩的新消息。
3. 确认压缩完成后出现 `compressed` 状态，正常回复也由 B 完成。
4. 让 B 临时失败，确认会话 metadata 不留下 `compressing`。
5. 切换到可用模型再次发送，确认无需清理会话即可继续完成压缩和正常回复。

## 可维护性总结汇总

- `post-edit-maintainability-guard --non-feature` 检查 6 个文件：0 error、0 warning。
- 代码增减报告：`+230 / -24`，净增 `206` 行；增长来自新增 manager 边界回归测试。
- 非测试代码增减报告：`+11 / -20`，净减 `9` 行，满足非功能改动门槛。
- 正向减债动作：删除 preflight 的重复模型来源，删除 begin 阶段的 metadata/timeline 持久化结果，manager 从 begin/finish 双事件收敛为成功后的单事件。
- owner 边界保持清晰：`AgentRunSpec` 拥有本次运行模型，Agent profile 拥有预算配置，compaction manager 拥有成功后的 checkpoint 持久化。
- `post-edit-maintainability-review` 结论：通过；没有新增 resolver、wrapper、fallback 或失败状态分支，生产链路更短且失败面更小。

## NPM 包发布记录

- 涉及包：`@nextclaw/kernel`、`nextclaw`。
- 发布状态：待下一次统一 NPM/runtime 发布带出。
- Changeset：`.changeset/context-compaction-model-atomicity.md`。
