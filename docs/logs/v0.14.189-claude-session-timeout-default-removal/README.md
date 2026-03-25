# v0.14.189 Claude Session Timeout Default Removal

## 迭代完成说明

- 移除了 Claude 会话主链路里默认写死的 `30000ms` 请求超时，避免长任务在 30 秒被本地定时器提前中断。
- 保留了显式 `requestTimeoutMs` 配置能力；只有用户或部署方明确配置时，Claude 请求才会启用硬超时。
- 对齐了两条 Claude 运行链路：
  - `@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk` / `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk`
  - `@nextclaw/nextclaw-engine-claude-agent-sdk`
- 更新了相关 README，明确 `requestTimeoutMs` 为可选项，默认禁用。

## 测试/验证/验收方式

- 构建：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-engine-plugin-claude-agent-sdk build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk build`
- 静态检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-engine-plugin-claude-agent-sdk lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-engine-plugin-claude-agent-sdk tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk tsc`
- 运行链路冒烟：
  - 使用 Node 内联脚本实例化 Claude NCP runtime 与 Claude engine，验证：
    - 未配置 `requestTimeoutMs` 时默认值不再是 `30000`
    - 显式配置 `requestTimeoutMs` 时仍会生效
- 可维护性检查：
  - `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/extensions/nextclaw-engine-plugin-claude-agent-sdk/src/index.ts packages/extensions/nextclaw-ncp-runtime-claude-code-sdk/src/claude-code-query-runtime.ts packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/src/index.ts packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/src/claude-runtime-shared.ts`

## 发布/部署方式

- 执行标准 NPM 发布流程：
  - `PATH=/opt/homebrew/bin:$PATH pnpm release:version`
  - `PATH=/opt/homebrew/bin:$PATH pnpm release:publish`
- 本次已发布版本：
  - `@nextclaw/nextclaw-engine-claude-agent-sdk@0.3.5`
  - `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.6`
  - `@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk@0.1.18`
- 本次为 NPM 包发布，不涉及后端或数据库迁移；远程 migration 不适用。
- 发布后检查对应包在 npm 上的最新 patch 版本与 changelog 是否包含本次默认超时修复。

## 用户/产品视角的验收步骤

1. 在 NextClaw 中打开 Claude 会话。
2. 发送一个会持续超过 30 秒的任务，例如要求 Claude 进行较长推理或多步执行。
3. 观察会话不应在约 30 秒时报本地超时错误；请求应继续运行，直到 Claude 返回结果或用户主动停止。
4. 如需硬超时，显式配置 `requestTimeoutMs` 后再次发送长任务，确认超时仅在显式配置时触发。
