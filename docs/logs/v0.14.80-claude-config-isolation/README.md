# v0.14.80-claude-config-isolation

## 迭代完成说明

- Claude NCP runtime 默认注入隔离的 `CLAUDE_CONFIG_DIR`，路径落在 `${NEXTCLAW_HOME}/runtime/claude-code`。
- 这样 Claude runtime 不再继承宿主机 `~/.claude/settings.json` 里的 `ANTHROPIC_BASE_URL`、`ANTHROPIC_AUTH_TOKEN` 等全局配置，避免覆盖 NextClaw 当前会话选择的 provider / model。
- 补充了回归测试，校验 Claude runtime 会把隔离后的 `CLAUDE_CONFIG_DIR` 注入到真实执行环境。
- 更新了 Claude provider routing 方案文档，补充“全局 Claude 配置污染”这一已确认事实与隔离策略。

## 测试/验证/验收方式

- 自动化：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/create-ui-ncp-agent.test.ts src/cli/commands/ncp/create-ui-ncp-agent.claude.test.ts`
- 真实链路：
  - 先用 MiniMax Anthropic 兼容端点直接 `curl`，确认真实返回文本。
  - 再用 `@anthropic-ai/claude-agent-sdk` + 隔离 `CLAUDE_CONFIG_DIR`，确认真实返回 `CLAUDE_SDK_ISOLATED_OK` / `ONLY_CONFIG_DIR_OK`。
  - 最后在 `pnpm dev start` 的 NextClaw 本地服务里创建 Claude 会话，确认页面内拿到真实 AI 回复。

## 发布/部署方式

- 本次为本地开发态修复，无独立部署步骤。
- 如需让其它环境生效，更新到包含本迭代代码的构建产物后重新启动 `nextclaw` / `pnpm dev start` 即可。

## 用户/产品视角的验收步骤

1. 启动 `pnpm dev start`。
2. 在 Providers 页面配置 Claude 兼容 provider，例如 MiniMax。
3. 进入 Chat，新建 `Claude` 会话。
4. 选择 Claude 兼容模型并发送一条简单消息。
5. 预期：
   - Claude 会话能返回真实 AI 回复。
   - 不会再被宿主机 `~/.claude/settings.json` 里的旧 `baseURL/token/model` 污染。
   - Claude 会话所用 provider/model 与 NextClaw 当前配置一致。

相关方案文档：

- [Claude Runtime Provider Routing Design](../../plans/2026-03-19-claude-runtime-provider-routing-design.md)
