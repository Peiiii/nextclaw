# v0.14.62-claude-agent-sdk-ncp-runtime-fix

## 迭代完成说明

- 将 `packages/extensions/nextclaw-ncp-runtime-claude-code-sdk` 的 Anthropic 依赖从错误的 `@anthropic-ai/claude-code` 修正为可编程接入的 `@anthropic-ai/claude-agent-sdk`。
- 调整 `claude-code-loader.cjs` 的动态加载逻辑，校验 `query()` 导出并增加模块缓存，避免 Claude 类型会话在发送消息时因错误入口而报 `Cannot find package ... @anthropic-ai/claude-code/index.js`。
- 同步更新 Claude NCP runtime 与 runtime plugin 的描述文案，避免继续把当前实现误标为 Claude Code SDK。
- 在 `packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.test.ts` 增加 Claude 会话真实消息流测试，验证 `session_type=claude` 时会通过配置的 Claude 可执行入口完成回复并持久化 `claude_session_id`。
- 拆分测试文件中的 `describe` 结构，消除新增测试引入的函数级可维护性违规。

## 测试/验证/验收方式

- 安装依赖：`pnpm install`
- 运行时包验证：
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk build`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk lint`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk tsc`
- 插件包验证：
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk build`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk lint`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk tsc`
- 端到端冒烟：
  - `pnpm --filter nextclaw exec vitest run src/cli/commands/ncp/create-ui-ncp-agent.test.ts`
  - 重点观察点：
    - `claude` 会话类型可被列出
    - `runs claude session messages through the configured Claude CLI entrypoint` 用例通过
    - 会话元数据中写入 `claude_session_id`
- 可维护性闸门：
  - `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/extensions/nextclaw-ncp-runtime-claude-code-sdk/claude-code-loader.cjs packages/extensions/nextclaw-ncp-runtime-claude-code-sdk/package.json packages/extensions/nextclaw-ncp-runtime-claude-code-sdk/README.md packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/package.json packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/openclaw.plugin.json packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/src/index.ts packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.test.ts`

## 发布/部署方式

- 本次修复属于仓库内 Claude NCP runtime 与 plugin 的源码修复，合并后按项目常规发布流程执行对应包的 version/publish。
- 若本次仅在本地联调，执行 `pnpm install` 让 workspace 锁定到 `@anthropic-ai/claude-agent-sdk` 即可完成生效。
- 若后续需要正式发布 NPM 包，应基于本次改动生成 changeset，并联动发布依赖该 runtime/plugin 的上层组件。

## 用户/产品视角的验收步骤

1. 在 NextClaw 配置中启用 `nextclaw-ncp-runtime-plugin-claude-code-sdk`。
2. 配置 Claude 相关参数，并确保运行时依赖已安装到包含 `@anthropic-ai/claude-agent-sdk` 的当前工作区。
3. 创建或打开一个 NCP 会话，在会话类型里选择 `Claude`。
4. 发送一条普通文本消息。
5. 确认消息不再报 `Cannot find package ... @anthropic-ai/claude-code/index.js`，并能正常返回 Claude 回复。
6. 再次进入同一会话，确认 Claude 会话能够沿用已持久化的 `claude_session_id` 继续工作。
