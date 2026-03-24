# 迭代完成说明

- 为 Claude NCP Runtime 补上了本地 `Anthropic Messages -> OpenAI-compatible chat/completions` bridge，不再把 `openai`、`dashscope`、`custom-*` 这类 raw OpenAI-compatible provider base URL 直接伪装成 `ANTHROPIC_BASE_URL`。
- Claude runtime 底层新增 gateway 访问准备逻辑：
  - `anthropic-direct` 路由继续直连 provider 的 Anthropic-compatible 接口
  - `anthropic-gateway` 路由改为先起 loopback bridge，再让 Claude Agent SDK 对 bridge 发送 `/v1/messages`
- Claude capability probe 与真实运行链路统一走同一套 bridge 逻辑，避免“describe 阶段一套逻辑，真实会话另一套逻辑”。
- 在当前本机真实配置下，Claude session type 的可用模型集合已从“只剩 minimax 少数模型”扩展为能真实返回的 openai / dashscope / minimax 模型集合，不再出现新建 Claude 会话时模型显示空白的问题。
- 本次修复同时把根因从“协议不兼容”推进为“上游账号能力问题可被明确暴露”：
  - `custom-1/gpt-5.4` 现在失败时返回的是上游 `SUBSCRIPTION_NOT_FOUND`
  - 不再是之前那种“selected model may not exist or you may not have access”的 Claude SDK 协议层假报错

# 测试/验证/验收方式

- 运行时包类型检查：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk tsc`
- 插件包类型检查：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk tsc`
- 运行时包构建：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk build`
- 插件包构建：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk build`
- Claude NCP 回归测试：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/create-ui-ncp-agent.claude.test.ts`
- UI 适配器回归：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui test -- --run src/components/chat/adapters/chat-input-bar.adapter.test.ts`
- 真实 Claude 会话 smoke（隔离 `NEXTCLAW_HOME`，强制加载仓库内第一方插件源码）：
  - 服务启动：
    - `NEXTCLAW_HOME=/tmp/nextclaw-claude-smoke-...`
    - `NEXTCLAW_ENABLE_OPENCLAW_PLUGINS=1`
    - `NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR=/Users/peiwang/Projects/nextbot/packages/extensions`
    - `pnpm -C packages/nextclaw exec nextclaw serve --ui-port 18892`
  - 模型列表接口：
    - `curl -sS http://127.0.0.1:18892/api/ncp/session-types`
    - Claude `supportedModels` 已返回：
      - `openai/gpt-5.3-codex`
      - `openai/gpt-5.4`
      - `dashscope/qwen3.5-plus`
      - `dashscope/qwen3.5-flash`
      - `dashscope/qwen3.5-397b-a17b`
      - `dashscope/qwen3.5-122b-a10b`
      - `dashscope/qwen3.5-35b-a3b`
      - `dashscope/qwen3-coder-next`
      - `minimax/MiniMax-M2.7`
      - `minimax/MiniMax-M2.5`
      - `minimax/MiniMax-M2.5-highspeed`
  - 单轮真实回复 smoke：
    - `openai/gpt-5.4` -> `assistantText = "OK"`
    - `openai/gpt-5.3-codex` -> `assistantText = "OK"`
    - `dashscope/qwen3-coder-next` -> `assistantText = "OK"`
    - `dashscope/qwen3.5-plus` -> `assistantText = "OK"`
    - `minimax/MiniMax-M2.7` -> `assistantText = "OK"`
  - 更复杂 prompt smoke：
    - `openai/gpt-5.4` 在“判断仓库目录名后回复 nextbot”的提示下返回 `nextbot`
    - `dashscope/qwen3-coder-next` 在同一提示下完成整轮回复，不再出现协议层报错
  - 上游账号错误透传：
    - `custom-1/gpt-5.4` 返回 `SUBSCRIPTION_NOT_FOUND`
    - 说明当前剩余失败根因已下沉到 provider 账号/订阅层，而不是 Claude SDK 协议桥缺失

# 发布/部署方式

- 发布前至少同步构建并发布：
  - `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk`
  - `@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk`
- 若外部实例当前依赖 marketplace / npm 安装的 Claude runtime plugin，需要升级到包含本次 bridge 修复的版本，旧版本仍会把 OpenAI-compatible endpoint 直接当成 Anthropic gateway 使用。
- 发布后建议在目标环境再做一次最小真实 smoke：
  - `pnpm smoke:ncp-chat -- --session-type claude --model openai/gpt-5.4 --port <port> --json`
  - `pnpm smoke:ncp-chat -- --session-type claude --model dashscope/qwen3-coder-next --port <port> --json`

# 用户/产品视角的验收步骤

1. 启动包含本次修复的 NextClaw 与 Claude runtime plugin。
2. 新建一个 `Claude` 会话。
3. 打开模型下拉，确认不再是空白，也不再只剩 `minimax/minimax-2.7` 单项。
4. 确认下拉里至少能看到 `openai/gpt-5.4`、`openai/gpt-5.3-codex`、`dashscope/qwen3-coder-next`、`minimax/MiniMax-M2.7` 等真实可用模型。
5. 任选 `openai/gpt-5.4` 或 `dashscope/qwen3-coder-next` 发送 `Reply exactly OK`，确认收到 `OK`。
6. 若某个模型仍失败，查看错误内容；现在应优先暴露 provider 自身的订阅/权限错误，而不是 Claude SDK 协议层的假性“不存在/无权限”提示。
