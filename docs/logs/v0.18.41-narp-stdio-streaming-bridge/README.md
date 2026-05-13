# v0.18.41 NARP stdio streaming bridge

## 迭代完成说明

- 修复 Codex / Claude Code 通过 NARP stdio 接入 OpenAI-compatible provider 时不产生连续 `message.text-delta` 的问题。
- 根因确认：
  - Codex Responses bridge 与 Claude Anthropic gateway 过去向 OpenAI-compatible 上游发的是非流式 ChatCompletions 请求，等完整 JSON 返回后再伪造成目标协议 stream。
  - Codex CLI/SDK 在外部 Responses bridge 下仍可能把完整 assistant item 合并成一次 `item.completed`，导致 NCP 层只产生一个大 delta。
  - MiniMax M2 通过 ChatCompletions gateway 时若不传 `reasoning_split: true`，`<think>` 会混入正文，影响 reasoning/text 分离。
- 修复方式：
  - Codex bridge stream 路径直接向上游发送 `stream: true`，实时解析 OpenAI-compatible SSE，并转换为 Responses SSE。
  - Claude gateway stream 路径直接向上游发送 `stream: true`，实时解析 OpenAI-compatible SSE，并转换为 Anthropic Messages SSE。
  - Codex / Claude SDK event mapper 对上游或 SDK 聚合后的大文本 delta 做稳定切片，确保 NCP/SSE 用户表面不会只有单个大 `message.text-delta`。
  - Claude OpenAI-compatible gateway 对 MiniMax api base 自动带上 `reasoning_split: true`，让 thinking 进入 reasoning delta。
  - Claude OpenAI-compatible gateway 向上游发请求前剥离 provider 前缀，避免把 `minimax/MiniMax-M2.7` 误传为上游模型名。
- 修复位点在 provider wrapper / SDK runtime mapper，未在通用 NARP stdio host/client 层加入 Codex/Claude 特判。

## 测试/验证/验收方式

- TypeScript:
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk tsc`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk tsc`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk tsc`
- Lint:
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk lint`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk lint`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk lint`
- Build:
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk build`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk build`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk build`
  - `pnpm -C packages/extensions/nextclaw-narp-runtime-codex-sdk build`
  - `pnpm -C packages/extensions/nextclaw-narp-runtime-claude-code-sdk build`
  - `pnpm -C packages/nextclaw-ncp-runtime-stdio-client build`
  - `pnpm -C packages/nextclaw-narp-stdio-runtime-wrapper build`
- Bridge 直测：
  - 临时 OpenAI-compatible SSE 上游返回 reasoning + 两段 text delta。
  - Codex bridge 输出 `response.output_text.delta` 两段，Claude gateway 输出 `content_block_delta:text_delta` 两段。
- 真实本地模型 NARP stdio 冒烟：
  - Codex NARP + 本地 DeepSeek 配置：`deepseek/deepseek-chat` / `https://api.deepseek.com`，`message.text-delta` 3 段，最终文本包含目标 token。
  - Claude NARP + 本地 MiniMax 配置：`minimax/MiniMax-M2.7` / `https://api.minimaxi.com/v1`，`message.text-delta` 2 段，`message.reasoning-delta` 1 段，最终文本包含目标 token。
- Governance:
  - `pnpm lint:new-code:governance`
  - `pnpm check:governance-backlog-ratchet`
- Maintainability guard:
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <本次相关路径>`：0 error，8 warning。

## 发布/部署方式

- 本次只修改源码与本地构建产物验证，不涉及线上服务部署。
- NPM 包发布：待统一发布。
- Marketplace skill 发布：不涉及，本次未修改 marketplace skill 包内容。

## 用户/产品视角的验收步骤

1. 使用本机已配置的 DeepSeek provider 启动 Codex NARP runtime。
2. 发送一个较长文本生成请求。
3. 观察会话事件里出现多次 `message.text-delta`，而不是只有最终一次性输出。
4. 使用本机已配置的 MiniMax provider 启动 Claude NARP runtime。
5. 观察 thinking 进入 `message.reasoning-delta`，正文进入多次 `message.text-delta`。

## 可维护性总结汇总

- 本次遵守 NARP 分层边界：通用 stdio client / wrapper 不识别 Codex、Claude 或 provider 身份。
- 新增流式状态机集中在 bridge stream writer owner 内，HTTP handler 保持薄路由，SDK mapper 只负责 NCP 事件表面稳定化。
- 删除了旧的“完整响应伪 stream”写法，替换为真实上游 SSE 转换。
- `post-edit-maintainability-guard` 结果：本次相关路径总代码 `+1796 / -189 / net +1607`，非测试代码 `+1796 / -189 / net +1607`；这是用户可见运行链路修复，净增主要来自真正流式状态机、协议转换和治理要求下的 owner class 收敛。
- 剩余 warning 主要是若干文件接近 400 行预算，以及 Claude/Codex stream writer 属于协议状态机集中承载点；后续若继续扩展 tool/reasoning 事件，应优先拆成更小的 writer/parser 子 owner。

## NPM 包发布记录

- `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk`：待统一发布。
- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk`：待统一发布。
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk`：待统一发布。
- `@nextclaw/nextclaw-narp-runtime-codex-sdk`：受上游依赖影响，待统一发布。
- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk`：受上游依赖影响，待统一发布。
