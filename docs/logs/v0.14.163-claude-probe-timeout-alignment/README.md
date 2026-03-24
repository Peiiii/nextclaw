# 迭代完成说明

- 修复 Claude NCP runtime `supportedModels` 的误杀问题：将 Claude 可用性探测的默认执行验证超时从过短窗口提升到更符合真实 provider 延迟的范围，避免 `dashscope`、`minimax`、`minimax-portal` 这类“可真实回包但首轮略慢”的模型在 session type 探测阶段被提前判为不可用。
- 插件侧新增统一的 Claude 执行探测超时解析逻辑，确保 `describeSessionType` 与路由探测使用同一默认值。
- 运行时包也同步使用同一更长默认值，避免源码直跑、构建产物、不同入口之间出现探测语义漂移。
- 新增回归测试锁定默认超时，防止后续再次退回到“Claude 下拉只剩少数快模型/新建会话模型集合异常收缩”的问题。

# 测试/验证/验收方式

- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk tsc`
- 构建：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk build`
- 回归测试：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/claude-session-type-probe-defaults.test.ts src/cli/commands/ncp/create-ui-ncp-agent.claude.test.ts`
- 真实 Claude 会话验证（隔离 `NEXTCLAW_HOME`，复制现有 provider 配置到临时目录）：
  - 服务启动：
    - `NEXTCLAW_HOME=/tmp/nextclaw-claude-verify.EDLqTy`
    - `NEXTCLAW_ENABLE_OPENCLAW_PLUGINS=1`
    - `NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR=/Users/peiwang/Projects/nextbot/packages/extensions`
    - `pnpm -C packages/nextclaw exec nextclaw serve --ui-port 18894`
  - 模型列表接口：
    - `curl -sS http://127.0.0.1:18894/api/ncp/session-types`
    - Claude `supportedModels` 返回：
      - `openai/gpt-5.3-codex`
      - `openai/gpt-5.4`
      - `dashscope/qwen3.5-plus`
      - `dashscope/qwen3.5-flash`
      - `dashscope/qwen3.5-397b-a17b`
      - `dashscope/qwen3.5-122b-a10b`
      - `dashscope/qwen3.5-35b-a3b`
      - `dashscope/qwen3.5-27b`
      - `dashscope/qwen3-coder-next`
      - `minimax/MiniMax-M2.7`
      - `minimax/MiniMax-M2.5`
      - `minimax/MiniMax-M2.5-highspeed`
      - `minimax-portal/MiniMax-M2.5`
      - `minimax-portal/MiniMax-M2.5-highspeed`
  - 真实 Claude 单轮回复 smoke：
    - `openai/gpt-5.4` -> `assistantText = "OK"`
    - `openai/gpt-5.3-codex` -> `assistantText = "OK"`
    - `dashscope/qwen3-coder-next` -> `assistantText = "OK"`
    - `dashscope/qwen3.5-plus` -> `assistantText = "OK"`
    - `minimax/MiniMax-M2.7` -> `assistantText = "OK"`
    - `minimax/MiniMax-M2.5` -> `assistantText = "OK"`
    - `minimax-portal/MiniMax-M2.5` -> `assistantText = "OK"`
  - 上游业务错误透传：
    - `custom-1/gpt-5.4` -> `SUBSCRIPTION_NOT_FOUND`
    - 说明当前剩余失败根因在 provider 订阅层，而不是 Claude runtime 协议层或模型适配层

# 发布/部署方式

- 至少同步构建并发布：
  - `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk`
  - `@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk`
- 升级目标环境中的 Claude runtime plugin 到包含本次超时对齐修复的版本，否则目标环境仍可能因为探测窗口过短而低估可用模型集合。
- 发布后建议在目标环境执行最小验收：
  - `pnpm smoke:ncp-chat -- --session-type claude --model dashscope/qwen3-coder-next --port <port> --json`
  - `pnpm smoke:ncp-chat -- --session-type claude --model minimax/MiniMax-M2.5 --port <port> --json`
  - `curl -sS http://127.0.0.1:<port>/api/ncp/session-types`

# 用户/产品视角的验收步骤

1. 启动包含本次修复的 NextClaw 与 Claude runtime plugin。
2. 新建一个 `Claude` 会话。
3. 打开模型下拉，确认不再空白，也不再只显示极少数快模型。
4. 确认下拉中可见 `openai/gpt-5.4`、`dashscope/qwen3-coder-next`、`dashscope/qwen3.5-plus`、`minimax/MiniMax-M2.5`、`minimax/MiniMax-M2.7`、`minimax-portal/MiniMax-M2.5` 等模型。
5. 任选 `dashscope/qwen3-coder-next`、`dashscope/qwen3.5-plus`、`minimax/MiniMax-M2.5` 发送 `Reply exactly OK`，确认收到 `OK`。
6. 若个别模型仍失败，查看错误信息；现在应优先暴露 provider 自身订阅或权限错误，而不是 Claude SDK 协议层的“模型不存在/无权限”假性报错。
