# 迭代完成说明

- 将 Claude NCP Runtime Plugin 的 provider 路由从“仅少数确认兼容 provider 白名单”调整为“默认接受所有已配置且可推导 Claude 路由的 provider”，不再把 DashScope 这类 provider 预先排除在外。
- 为缺少运行时 provider registry 的链路补充常见 provider 的 fallback spec，使 `dashscope`、`openai`、`openrouter`、`deepseek`、`gemini`、`moonshot`、`qwen-portal`、`aihubmix` 等 provider 也能推导 `apiBase` 与模型前缀。
- Claude session type 描述改为“基于真实 runtime probe 的可用模型集合”：
  - 先发现所有可尝试 provider route
  - 再按 route 做 capability probe
  - 对通过的 route 内模型逐个做 execution probe
  - 最终只展示当前环境里真实可返回结果的模型，而不是原始 provider 候选并集
- 修复聊天输入栏的模型选择展示：当当前选中模型已失配但下拉里仍有可选模型时，closed state 会稳定回退到首个可选项，不再出现空白。
- 更新 Claude 相关回归测试，覆盖“默认开放 provider 候选”“保留当前默认模型为推荐模型”“模型选择空白回退”。

# 测试/验证/验收方式

- 插件构建：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk build`
- 插件类型检查：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk tsc`
- Claude NCP 端到端测试：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/create-ui-ncp-agent.claude.test.ts`
- UI 适配器测试：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui test -- --run src/components/chat/adapters/chat-input-bar.adapter.test.ts`
- UI 类型检查：`PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
- 本机配置实测（隔离 `NEXTCLAW_HOME` + repo 宿主链路）：
  - 先前原始候选集里：
    - `openai/gpt-5.3-codex`
    - `openai/gpt-5.4`
    - `dashscope/qwen3.5-plus`
    - `dashscope/qwen3.5-flash`
    - `dashscope/qwen3.5-397b-a17b`
    - `dashscope/qwen3.5-122b-a10b`
    - `dashscope/qwen3.5-35b-a3b`
    - `dashscope/qwen3.5-27b`
    - `dashscope/qwen3-coder-next`
    - `custom-1/gpt-5.4`
    都会在真实 Claude 会话里返回 `run.error`，报“selected model may not exist or you may not have access”，因此被视为当前环境下明确不可用
  - `minimax/MiniMax-M2.7-highspeed` 在真实 Claude 会话里超时，因此也不再进入最终展示集合
  - 最终 probe 后保留下来的可用模型：
    - `minimax/MiniMax-M2.7`
    - `minimax/MiniMax-M2.5-highspeed`
    - `minimax-portal/MiniMax-M2.5`
    - `minimax-portal/MiniMax-M2.5-highspeed`
  - 以上 4 个模型均通过 `Reply exactly OK` 的真实 smoke，返回 `run.finished` 且 `assistantText = "OK"`
- 维护性守卫：`PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard`
  - 结果：本次相关文件为 warning 级别；guard 同时报告了工作区内其它已脏文件的既有 maintainability error，需要与本次任务分开处理。

# 发布/部署方式

- 本次仓库改动完成后，按常规包发布流程发布 `@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk`，并确保 Claude runtime 相关包版本联动。
- 若需要让外部已安装实例获得同样行为，需升级到包含本次修复的 Claude runtime plugin 版本；旧的全局 `nextclaw 0.6.15` 宿主与当前 NCP runtime plugin 协议并不同代，不应作为本次修复的承载宿主。
- 发布后建议补一次真实配置冒烟，确认 Claude 会话的模型列表与推荐模型仍保持“默认开放”契约。

# 用户/产品视角的验收步骤

1. 在带有 `dashscope`、`minimax` 等 provider 配置的环境中打开 NCP Chat 页面。
2. 新建一个 `Claude` 会话。
3. 查看模型选择器，确认只展示当前环境里真实 smoke 通过的 Claude 模型，而不是原始 provider 全量候选。
4. 确认当前推荐模型为 `minimax/MiniMax-M2.7`。
5. 任选下拉中的任意一个模型发送 `Reply exactly OK`，确认会收到 `OK`。
6. 在当前选中模型失效的情况下重新进入页面，确认模型选择器 closed state 不再空白，而会显示一个稳定可用的候选项。
