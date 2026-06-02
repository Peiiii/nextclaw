# v0.20.5 OpenCode NARP Runtime

## 迭代完成说明

本次把 OpenCode 从“裸 `opencode acp` runtime entry”调整为正式的 `nextclaw-opencode-narp` launcher 路径。

根因：裸 `opencode acp` 不消费 NextClaw 的 `promptMeta.providerRoute`，因此前端选择 `deepseek/deepseek-v4-flash` 或 `MiniMax-M2.7` 后，OpenCode 子进程收到的是未注册到自身 config 的模型名，触发 `session/set_model` 的 `model not found`。

确认方式：本地真实复现路径显示 `/api/ncp/session-types` 中 `opencode` ready 后，通过 `pnpm smoke:ncp-chat` 走 `opencode` session type 与 `deepseek/deepseek-v4-flash`，真实文本回复与真实文件写入任务均完成。裸 `opencode models deepseek --pure` 在无临时 config 时仍返回 provider not found，说明通过 wrapper 注入的 OpenCode config 是必要边界。

修复方式：新增 `@nextclaw/nextclaw-narp-runtime-opencode`，复用 `NarpStdioRuntimeWrapper` 作为外层 ACP runtime，并在每次 session/prompt 创建时把 NextClaw provider route 映射为 OpenCode 可识别的临时 `opencode.json`、`HOME` 与 `OPENCODE_CONFIG`。真实 API key 与 header 值只通过 env 注入，不写入 config 明文。内部继续复用 `StdioRuntimeNcpAgentRuntime` 与现有 ACP event -> NCP event 转换链路。

收尾纠偏：OpenCode Runtime skill 只能作为 marketplace skill 存在，不应进入 `@nextclaw/core` 的 builtin skills。已移除 `packages/nextclaw-core/src/features/agent/shared/skills/opencode-runtime`，并修正 core `copy-skills` 脚本，使复制前清空 `dist/skills`，避免已删除的 builtin skill 在打包产物中残留。

## 测试/验证/验收方式

- `pnpm -C packages/extensions/nextclaw-narp-runtime-opencode test`：通过，2 个测试文件、3 个测试。
- `pnpm -C packages/extensions/nextclaw-narp-runtime-opencode lint`：通过。
- `pnpm -C packages/extensions/nextclaw-narp-runtime-opencode tsc --pretty false`：通过。
- `pnpm -C packages/extensions/nextclaw-narp-runtime-opencode build`：通过，`tsdown` 构建完成；Node 22.16.0 有 deprecation warning，但不影响构建结果。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm -C packages/nextclaw-core exec vitest run src/features/agent/features/tests/skills.test.ts`：通过，1 个测试文件、8 个测试。
- `pnpm -C packages/nextclaw-core lint`：通过，0 error；存在既有 warning。
- `pnpm -C packages/nextclaw-core build`：通过，`copy-skills` 后 `packages/nextclaw-core/dist/skills` 不再包含 `opencode-runtime`。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`：通过，无阻塞项、无警告。
- 真实接口 smoke：临时 `NEXTCLAW_HOME=/Users/peiwang/.cache/nextclaw-opencode-smoke-home-hxj1Ay`，`pnpm -C packages/nextclaw dev:build serve --ui-port 18795`，`/api/ncp/session-types` 返回 `opencode` 为 `ready: true`。
- 真实模型文本 smoke：`pnpm smoke:ncp-chat -- --base-url http://127.0.0.1:18795 --session-type opencode --model deepseek/deepseek-v4-flash --prompt 'Reply exactly NEXTCLAW_OPENCODE_FINAL_TEXT_OK' --timeout-ms 240000 --json`，返回 `assistantText=NEXTCLAW_OPENCODE_FINAL_TEXT_OK`、`terminalEvent=run.finished`。
- 真实 agent 文件任务 smoke：`pnpm smoke:ncp-chat -- --base-url http://127.0.0.1:18795 --session-type opencode --model deepseek/deepseek-v4-flash ...`，事件包含 `message.tool-call-start` / `message.tool-call-result`，返回 `assistantText=NEXTCLAW_OPENCODE_FINAL_AGENT_DONE`，并验证 `/tmp/nextclaw-opencode-final-smoke-workspace-3/opencode-agent-result.txt` 内容严格等于 `NEXTCLAW_OPENCODE_FINAL_AGENT_FILE_OK`。

## 发布/部署方式

NPM 包已发布：

- `@nextclaw/nextclaw-narp-runtime-opencode@0.1.0`
- dist-tag：`latest`

Skill marketplace 已存在 `opencode-runtime`，但本次纠偏明确该 skill 不随 `@nextclaw/core` builtin skills 打包。

## 用户/产品视角的验收步骤

1. 启动 NextClaw UI/API，并确认 `/api/ncp/session-types` 中 `opencode` 显示 `ready: true`。
2. 前端打开 OpenCode 会话，选择 `deepseek/deepseek-v4-flash`。
3. 发送普通文本请求，应收到 assistant 内容，且不再出现 OpenCode ACP `session/set_model` 的 `model not found: deepseek-v4-flash`。
4. 发送一个需要写入 `/tmp` 文件的 agent 任务，应出现工具调用事件并生成目标文件。
5. 在 marketplace 已安装列表中卸载 OpenCode Runtime 后，`@nextclaw/core` builtin skills 不应继续显示同名 OpenCode Runtime。

## 可维护性总结汇总

本次是新增用户能力，允许生产代码增长。实现没有改通用 NARP stdio host client，没有复制 ACP event 转换层，而是把 OpenCode 专属逻辑收敛到独立 extension package 的三个 owner：route 解析 utility、临时 config service、runtime wrapper service。这样保持了 Codex/Claude/Hermes 的既有主链路不被扰动。

纠偏后进一步减少了 builtin skill 面积：OpenCode Runtime 不再进入 core builtin skills，避免 marketplace 可卸载项与不可卸载 builtin 同名并存。

可维护性检查通过：无文件/目录/函数级新增阻塞，无治理新增违规。`post-edit-maintainability-review` 结论为通过；增长来自新增 OpenCode runtime 能力与测试覆盖，已尽量复用现有 wrapper 与 stdio runtime client。

## NPM 包发布记录

- `@nextclaw/nextclaw-narp-runtime-opencode@0.1.0`：已发布到 NPM，`latest -> 0.1.0`。
