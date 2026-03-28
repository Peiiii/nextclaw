# v0.14.256-codex-bootstrap-context-parity

## 迭代完成说明

- 为 Codex / Claude 的 SDK 会话补齐统一的 workspace bootstrap 上下文装配。
- 新增共享 helper，把 `AGENTS.md`、`SOUL.md`、`USER.md`、`IDENTITY.md`、`TOOLS.md`、`BOOT.md`、`BOOTSTRAP.md`、`HEARTBEAT.md` 的装载规则抽到 `@nextclaw/core`，避免各插件各自拼 prompt。
- `ContextBuilder` 改为复用同一套 bootstrap 上下文装载逻辑，保证普通 NextClaw 会话与 SDK 会话的文件注入规则一致。
- Codex engine、Claude engine、Codex NCP runtime、Claude NCP runtime 全部切到新的 bootstrap-aware user prompt，修复 SDK 会话漏掉 `IDENTITY.md` 的问题。
- 额外把 requested skills 解析抽成共享函数，消除两处 engine 大文件“继续膨胀”的可维护性阻塞。

## 测试/验证/验收方式

- 单测：
  - `pnpm -C packages/nextclaw-core test -- --run src/agent/runtime-user-prompt.test.ts src/agent/context.test.ts`
  - `pnpm -C packages/nextclaw-core test -- --run src/agent/runtime-user-prompt.test.ts`
- 类型检查：
  - `pnpm -C packages/nextclaw-core tsc`
  - `pnpm -C packages/extensions/nextclaw-engine-plugin-codex-sdk tsc`
  - `pnpm -C packages/extensions/nextclaw-engine-plugin-claude-agent-sdk tsc`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk tsc`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk tsc`
- Lint：
  - `pnpm -C packages/nextclaw-core lint`
  - `pnpm -C packages/extensions/nextclaw-engine-plugin-codex-sdk lint`
  - `pnpm -C packages/extensions/nextclaw-engine-plugin-claude-agent-sdk lint`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk lint`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk lint`
  - 结果：无新增 error；存在仓库既有 warning。
- 构建：
  - `pnpm -C packages/nextclaw-core build`
  - `pnpm -C packages/extensions/nextclaw-engine-plugin-codex-sdk build`
  - `pnpm -C packages/extensions/nextclaw-engine-plugin-claude-agent-sdk build`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk build`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk build`
- 可维护性守卫：
  - `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-core/src/agent/bootstrap-context.ts packages/nextclaw-core/src/agent/runtime-user-prompt.ts packages/nextclaw-core/src/agent/runtime-user-prompt.test.ts packages/nextclaw-core/src/agent/context.ts packages/nextclaw-core/src/index.ts packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/codex-input-builder.ts packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/index.ts packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/src/claude-runtime-context.ts packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/src/index.ts packages/extensions/nextclaw-engine-plugin-codex-sdk/src/index.ts packages/extensions/nextclaw-engine-plugin-claude-agent-sdk/src/index.ts`
  - 结果：无阻塞项；保留若干历史 warning（大文件/目录预算接近或超预算，但本次未恶化）。

## 发布/部署方式

- 本次未执行发布。
- 如需随下次版本发布带出，按现有 NPM/插件发布流程执行对应包的 version/build/publish。

## 用户/产品视角的验收步骤

1. 在工作区准备 `IDENTITY.md`，写入一条容易辨认的身份规则。
2. 打开一个普通 NextClaw 会话，确认模型会遵循该规则。
3. 打开一个 Codex 会话，再发起同类问题，确认也能遵循同一条 `IDENTITY.md` 规则。
4. 如使用 Claude SDK 会话，同样复测一次，确认行为与普通会话一致。
5. 如工作区同时存在 `SOUL.md` / `BOOT.md` 等 bootstrap 文件，确认 SDK 会话也能体现对应约束，而不是只读到 `AGENTS.md`。
