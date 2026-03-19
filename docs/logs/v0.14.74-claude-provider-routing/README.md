# 迭代完成说明

- 新增 Claude provider routing 设计文档：[Claude Runtime Provider Routing Design](../../plans/2026-03-19-claude-runtime-provider-routing-design.md)。
- Claude runtime 改为优先跟随 `NextClaw` 当前 provider/model，而不是默认假设 Claude 自身订阅或 user settings。
- 新增 `claude-provider-routing.ts`，将已确认路径收敛为：
  - 内置直连：`anthropic`、`minimax`、`minimax-portal`、`zhipu`
  - 显式声明：`anthropicCompatibleProviderNames`
  - 显式 gateway：`gatewayProviderNames`
- Claude readiness / supportedModels / recommendedModel 改为基于可确认路由输出，不再把全局所有 provider 模型都暴露给 Claude 会话。
- 第三方 Anthropic-compatible 路由现在会同时注入 `ANTHROPIC_API_KEY + ANTHROPIC_AUTH_TOKEN`，并补齐模型环境变量，减少 Claude Agent SDK 误走订阅鉴权的概率。
- 补充自动化测试，覆盖：
  - 默认模型不兼容时自动回退到已配置兼容 provider
  - 无兼容 provider 时显示 setup required
  - Claude runtime 正确把 MiniMax provider 转换为 Anthropic-compatible base/model/auth

# 测试/验证/验收方式

- 自动化验证
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/create-ui-ncp-agent.test.ts`
- 真实链路验证
  - 使用隔离 `NEXTCLAW_HOME=/tmp/...`、真实 `pnpm dev start`、真实本机 `MiniMax` / `MiniMax Portal` credential 做 Claude 会话冒烟。
  - 已确认：
    - Claude 路由不再退回旧的“默认 provider 凭证盲用”逻辑
    - `session_type=claude + minimax/*` 会进入新路由
    - 只传 `ANTHROPIC_AUTH_TOKEN` 时会命中旧的 403 订阅错误
    - 改为同时注入 `ANTHROPIC_API_KEY + ANTHROPIC_AUTH_TOKEN` 后，不再命中该 403，链路进入真实长等待
  - 当前阻塞：
    - 在本机现有 `MiniMax` / `MiniMax Portal` credential 下，Claude Agent SDK 最终未返回真实文本，表现为长时间等待后 `claude request timed out`
    - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc` 当前因仓库已有无关文件 `src/cli/commands/platform-auth.ts` 的既有类型错误失败，本次未对该无关问题做修改

# 发布/部署方式

- 本次改动主要是仓库内 Claude runtime/plugin 源码与设计文档更新。
- 本地使用源码验证时，需要至少重新构建：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk build`
- 若后续要正式发布到 npm / marketplace，按项目既有 `changeset -> release:version -> release:publish` 流程执行；本次未执行正式发布。

# 用户/产品视角的验收步骤

1. 在 Providers 页面配置一个已确认兼容的 provider，例如 `MiniMax`、`MiniMax Portal`、`Anthropic` 或已声明为 Anthropic-compatible 的自定义 gateway。
2. 启用 Claude runtime 插件，并重建本地插件包。
3. 启动本地开发环境：`PATH=/opt/homebrew/bin:$PATH NEXTCLAW_HOME=/tmp/<isolated-home> pnpm dev start`
4. 打开会话页切换 `Session Type = Claude`，确认模型列表只剩 Claude 当前可兼容模型，默认模型不兼容时会自动切到推荐兼容模型。
5. 发送一条 Claude 会话消息，观察是否返回真实文本。
6. 若仍出现长超时或 provider 侧无返回，优先检查：
   - 当前第三方 credential 是否真的具备 Claude Code / Anthropic-compatible coding 权限
   - 对应 provider 官方文档要求的 key 类型、base URL、模型名是否匹配
