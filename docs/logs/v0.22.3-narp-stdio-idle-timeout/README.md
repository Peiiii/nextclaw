# v0.22.3 NARP Stdio Idle Timeout

## 迭代完成说明

本次修复 NARP stdio runtime 把长时间但仍在活跃输出的 agent run 错判为 timeout 的问题。

根因是 `@nextclaw/nextclaw-ncp-runtime-stdio-client` 在执行 `connection.prompt(...)` 时直接用 `requestTimeoutMs` 包住整个 promise。这个 timeout 实际表示了“总运行时长上限”，而用户期望的保护语义应该是“超过一段时间没有任何 ACP update 才算卡死”。因此一个持续产出内容、工具调用或状态更新的 agent，只要总运行时间超过 120 秒，也会被错误标记为 `[narp-stdio] prompt timed out`。

确认方式是先对用户指出的会话 `ncp-mqgwqq66-d8b969d1` 追日志：运行从 `2026-07-05T12:29:02.496Z` 开始，在 `2026-07-05T12:30:24.708Z` 仍有正常文本 delta，但 `2026-07-05T12:31:02.536Z` 被标成 `message.failed`，距离开始约 120 秒，距离最后一次正常输出只有约 38 秒。随后新增了一个慢速但持续输出的 stdio ACP agent 回归测试，修复前该测试能稳定复现“总时长超过 request timeout 就失败”，修复后同一测试通过。

修复方式是在 prompt 链路上把 timeout 转成 idle timeout：每次收到 ACP update 时刷新 activity timer；只有在配置时间内没有任何 update 时才触发 timeout。启动、初始化等没有活动更新的调用仍保留原来的总时长 timeout 语义。

## 测试/验证/验收方式

- 复现修复前失败：`pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client exec vitest run src/stdio-runtime.test.ts -t "does not time out an active prompt"`，修复前断言失败，`message.completed` 没有出现。
- 修复后定向通过：`pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client exec vitest run src/stdio-runtime.test.ts -t "does not time out an active prompt"`。
- 回归通过：`pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client exec vitest run src/stdio-runtime.test.ts src/stdio-runtime-abort.test.ts`。
- 包测试通过：`pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client test`。
- 类型检查通过：`pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client tsc`。
- Lint 通过：`pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client lint`。
- 生成物检查通过：`pnpm clean:generated`。
- 可维护性守卫通过：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.service.ts packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.test.ts`，仅保留既有预算 warning。
- 路径级治理通过：`pnpm lint:new-code:governance -- packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.service.ts packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.test.ts`。
- Governance backlog ratchet 通过：`pnpm check:governance-backlog-ratchet`。
- 全量 `pnpm lint:new-code:governance` 当前仍被同批次触达的 NCP legacy module-structure 债务拦住；文件命名/角色边界已通过，但 `packages/ncp-packages/nextclaw-ncp` 与 `packages/ncp-packages/nextclaw-ncp-http-agent-server` 的旧 root/legacy directory 结构需要独立治理，不属于本次 timeout 语义修复。

## 发布/部署方式

无需单独部署。该修复进入 `@nextclaw/nextclaw-ncp-runtime-stdio-client` 后，随下一次统一 NPM/桌面发布带出。

## 用户/产品视角的验收步骤

1. 使用 NARP stdio runtime 运行一个耗时超过 `requestTimeoutMs`、但持续输出 ACP update 的 agent 任务。
2. 任务在持续输出期间不应被标记为 `prompt timed out`。
3. 如果 agent 在 `requestTimeoutMs` 时间内没有任何 ACP update，系统仍应按 timeout 失败，保留卡死保护。
4. 聊天会话的错误展示只应在真实无活动 timeout 或其它真实失败时出现，不应因为任务总运行时长较长而误报。

## 可维护性总结汇总

本次遵循了 owner 收敛原则：timeout 语义修在 NARP stdio transport owner 内，不在 UI、preview 或 session activity 层吞错。`stdio-runtime.service.ts` 的生产代码变更为 `+57 / -57 / net 0`，通过删除 `pendingProviderRoute` 暂存字段、简化 `UpdateBuffer` waiter 和 connection 初始化分支抵消了新增 idle activity timer 的复杂度。

总变更为 `+138 / -57 / net +81`，净增长来自新增回归测试。非测试语义代码净增为 `0`。本次没有新增平行 timeout 通道，也没有为单个 runtime 特判另起 wrapper；`requestTimeoutMs` 在 prompt 场景下被明确解释为 idle timeout，在 startup/init 场景下仍是总时长 timeout。

`post-edit-maintainability-review` 已完成主观复核：实现落在正确 owner，行为更可预测，可观察错误语义更接近真实原因。剩余 warning 是 `stdio-runtime.service.ts` 仍超过历史预算，属于既有债务，本次没有继续恶化。

## 红区触达与减债记录

### packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.service.ts

- 本次是否减债：是。
- 说明：文件仍是历史超预算热点，但本次生产代码净增长为 0，并顺手收敛了局部临时状态和重复分支。
- 下一步拆分缝：后续继续演进 stdio runtime 时，优先拆出 prompt lifecycle / timeout activity tracking / ACP update translation 三类职责。

## NPM 包发布记录

- 涉及包：`@nextclaw/nextclaw-ncp-runtime-stdio-client`
- 发布状态：待下一次统一 NPM/桌面发布带出
- Changeset：`.changeset/narp-stdio-idle-timeout.md`
