# v0.22.26 Codex SDK 模型兼容性修复

## 迭代完成说明

- 根因：Codex NARP runtime 绑定的 `@openai/codex-sdk` / `codex-cli` 为 `0.139.0`，实际运行时默认模型已选择 `gpt-5.6-sol`；同链路 A/B 证明旧 CLI 会完成 turn，但不产生 assistant item，最终形成 `task_complete.last_agent_message=null`。官方 `0.143.0` 发布说明也显示 GPT-5.6 Sol/Terra/Luna 的一等支持晚于 `0.139.0` 落地。
- 根因确认：原始 Codex rollout 中只有 user message 和 `task_complete`，没有 assistant `response_item`；随后使用同一个 NextClaw adapter、工作目录、reasoning 配置和 prompt 做单变量 A/B，`0.139.0` 只产生空 `message.completed`，`0.144.1` 产生连续 `message.text-delta` 和预期 marker。
- 修复方式：把 `@nextclaw/nextclaw-ncp-runtime-codex-sdk` 的官方 Codex SDK 最低版本提升到 `^0.144.1`，不在 NARP、stdio client 或 UI 增加空响应兜底。
- 机制改进：在 `nextclaw-delivery-workflow`、`long-chain-debugging` 和 `nextclaw-validation-workflow` 中补充复现收益/成本权衡、修前基线和修后同指标复验规则。

## 测试/验证/验收方式

- 修前复现：`codex-cli 0.139.0` 同链路只有 `run.started -> run.metadata -> message.completed(空) -> run.finished`，没有任何 `message.text-*`。
- 修后底层复验：`codex-cli 0.144.1` 使用相同 prompt `Reply exactly NEXTCLAW_CODEX_0139_OK`，产生连续 `message.text-delta`，拼接结果为 `NEXTCLAW_CODEX_0139_OK`，终态为 `run.finished`。
- 用户入口复验：对 `http://127.0.0.1:55667` 运行 `pnpm smoke:ncp-chat -- --session-type codex ... --json`，返回 `ok: true`、`assistantText: NEXTCLAW_CODEX_NARP_FIXED_OK`、`terminalEvent: run.finished`。
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-codex-sdk tsc`：通过。
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-codex-sdk test`：7 个测试文件、19 个测试通过。
- `pnpm --filter @nextclaw/nextclaw-narp-runtime-codex-sdk tsc`：通过。
- `pnpm --filter @nextclaw/nextclaw-narp-runtime-codex-sdk test`：2 个测试文件、15 个测试通过。
- 两个包的 ESLint：0 error；adapter 保留 1 条本次未触达源码中的既有 warning。
- 三个修改后的 skill 均通过 `skill-creator/scripts/quick_validate.py`。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm lint:new-code:governance`：被当前工作区与本任务无关的 `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/__tests__/chat-message-list.attachments.test.tsx` parent-relative import 阻塞；本次未修改该用户并行改动。

## 发布/部署方式

- 本次未执行 NPM 发布、部署或服务重启。
- Codex runtime 为 per-session NARP 子进程；本机 `55667` 配置指向当前仓库 launcher，依赖更新后新会话已直接加载 `0.144.1` 并通过真实 smoke。

## 用户/产品视角的验收步骤

1. 在 `http://127.0.0.1:55667` 新建 Codex 会话，并保持模型为 Runtime default。
2. 发送一条要求固定文本回复的消息。
3. 确认页面出现非空 assistant 回复，不再显示 `ACP prompt completed without any assistant content`。
4. 确认会话以正常完成状态结束，而不是 `Run failed`。

## 可维护性总结汇总

- 本次没有新增 fallback、provider 特判、NARP 分支或 UI 掩盖逻辑；修复落在真实依赖合同 owner。
- 生产 TypeScript 代码新增 `0` 行、删除 `0` 行；运行链路复杂度和文件/函数/目录数量均未增加。
- 复现规范复用现有三个 workflow owner，没有创建平行 skill 或治理脚本；新增内容只补足成本自适应决策与可审计证据合同。
- `post-edit-maintainability-guard --non-feature --paths ...` 判定本次没有 code-like 文件改动，自动守卫不适用；`post-edit-maintainability-review` 复核无新增生产代码、分支、抽象或目录膨胀。

## NPM 包发布记录

- `@nextclaw/nextclaw-ncp-runtime-codex-sdk`：当前已发布 `0.2.2`；本次 patch changeset 已添加，待统一发布。
- `@nextclaw/nextclaw-narp-runtime-codex-sdk`：当前已发布 `0.2.2`；作为用户入口和直接依赖方同步 patch，待统一发布。
