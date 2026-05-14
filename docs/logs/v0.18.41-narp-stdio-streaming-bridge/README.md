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

### 2026-05-14 Codex raw reasoning 展示修正

- 修复 Codex NARP 在用户可见 thinking 区域展示 SDK raw reasoning summary 的问题。
- 根因确认：
  - Codex SDK 的 `reasoning` item 是 agent 内部 reasoning summary，真实链路可复现出 `Thefirstcommandfailedasexpected...` 这类无空格工具调用修正叙事。
  - Codex SDK NCP mapper 过去把所有 `reasoning` item 原样转成 `message.reasoning-delta`，导致内部工具调用自述进入用户表面。
- 修复方式：
  - Codex SDK mapper 不再把 SDK raw reasoning summary 映射为用户可见 NCP thinking。
  - `message.text-*` 与 `message.tool-call-*` 仍保持流式输出。
  - 新增 mapper 回归测试，确保 raw reasoning 被抑制、assistant text 仍正常流式映射。

### 2026-05-14 Codex reasoning 空白保留修正

- 上一版 raw reasoning 修正把 Codex reasoning 整体丢弃，导致 DeepSeek / MiniMax 这类真实 provider 的 thinking 也消失；这是错误修复，已撤销。
- 根因重新确认：
  - DeepSeek 上游原始 `reasoning_content` 是带空格的可读英文。
  - 进入 Codex SDK raw event 后变成 `Theuserwants...`，第一处错误来自 bridge 解析 OpenAI-compatible SSE 时对每个 delta 使用会 `.trim()` 的通用 `readString()`。
  - 流式 delta 的前导空格被 bridge 删除后，下游无法再恢复。
- 修复方式：
  - `codex-openai-sse-chunks` 对 reasoning/text delta 改用 raw string reader，保留模型输出的原始空白。
  - Codex SDK NCP mapper 撤销摘要化 workaround，只负责原样协议映射。
  - `integrating-narp-stdio-runtime` skill 增补规则：遇到无空格 reasoning 必须定位第一个错误 hop，禁止在 mapper 统一改写成高层摘要。

### 2026-05-14 Codex bridge live output 修正

- 修复 Codex + OpenAI-compatible bridge 下 thinking 与普通正文仍然非实时流式的问题。
- 根因确认：
  - 延迟上游每 450ms 返回一次 `reasoning_content` / `content` delta。
  - bridge 自身实时写出 Responses SSE，但 Codex SDK 对 bridged `reasoning` 和 `message` item 暴露的是完成态快照，NCP runtime 因此在约 2.1s 后一次性收到完整 thinking/text。
  - 这不是 UI 渲染问题，也不是只影响 reasoning；普通正文同样被 Codex SDK 聚合。
- 修复方式：
  - 新增 `CodexLiveOutputStream`，由 bridge 在同进程内把上游 reasoning/text delta 旁路推给 Codex NCP runtime。
  - NCP runtime 同时消费 Codex SDK 事件与 live output stream；live 通道开始后，抑制 Codex SDK 完成态 reasoning/text item，避免重复输出。
  - Codex NARP stdio wrapper 与 Codex plugin bridge 路径都接入同一 live output stream。

### 2026-05-14 Claude bridge raw whitespace 同步修正

- 修复 Claude Code + OpenAI-compatible bridge 下 thinking 出现 `Theseemstobe...` 这类无空格英文的问题。
- 根因确认：
  - Claude bridge 的 stream writer 使用会 `.trim()` 的 `readString()` 读取上游 `reasoning_content`、`content` 和 tool arguments delta。
  - 当上游按 `These seem `、`to be ` 这类分片输出时，每个 delta 的尾部或头部空白被吞掉，最终拼成不可读文本。
  - Codex bridge 之前已修同类问题，但 Claude bridge 未做横向同步。
- 修复方式：
  - 在 Claude OpenAI bridge payload owner 中新增 `readRawString()`，只给模型生成内容字段使用。
  - `readString()` 继续用于 id、name、role、model 等结构字段，避免结构字段行为漂移。
  - `integrating-narp-stdio-runtime` skill 增补横向同步规则：修 Codex / Claude Code 同构 bridge 内容字段 bug 后，必须搜索 sibling runtime。

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
- 2026-05-14 Codex raw reasoning 修正验证：
  - 复现：Codex NARP + 本地 DeepSeek 配置，命令型提示产生 `message.reasoning-delta`，内容包含无空格工具调用修正叙事。
  - 修复后源码验证：同一 DeepSeek 链路 `reasoningDeltaCount: 0`，仍有 `message.tool-call-*` 事件。
  - 修复后源码验证：MiniMax 链路 `reasoningDeltaCount: 0`，仍有 `message.text-delta`，文本包含 `收到`。
  - 发布后安装验证：`/tmp` npm install `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.1.5`，依赖闭包解析到 SDK `0.1.28`、插件 `0.1.62`。
  - 发布后 DeepSeek 冒烟：`reasoningDeltaCount: 0`，仍有 `message.tool-call-*` 事件。
  - 发布后 MiniMax 冒烟：`reasoningDeltaCount: 0`，仍有 `message.text-delta`，文本包含 `收到`。
- 2026-05-14 Codex reasoning 空白保留修正验证：
  - DeepSeek 分层复现：上游 reasoning sample 为 `The user wants...`，Codex SDK raw sample 变为 `Theuserwants...`，确认第一处错误在 bridge delta 空白处理；修复后 DeepSeek 账号返回 `Insufficient Balance`，无法继续真实模型闭环。
  - Unit：`pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk test`，验证 reasoning/text delta 保留前导空白。
  - Unit：`pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk test`，验证 NCP mapper 不再改写 reasoning 文本。
  - TypeScript：`pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk tsc`、`pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk tsc`、`pnpm -C packages/extensions/nextclaw-narp-runtime-codex-sdk tsc`。
  - Lint：`pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk lint`、`pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk lint`、`pnpm -C packages/extensions/nextclaw-narp-runtime-codex-sdk lint`，0 error，仅既有 context-destructuring warning。
  - Build：`pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk build`、`pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk build`、`pnpm -C packages/extensions/nextclaw-narp-runtime-codex-sdk build`。
  - MiniMax 真实模型 Codex SDK raw event：`minimax/MiniMax-M2.7` reasoning 非空且保留空白，最终文本 `391`。
  - MiniMax 真实模型 NCP runtime：`message.reasoning-delta` 非空且保留空白，最终文本 `391`。
  - 发布后安装验证：`/tmp` npm install `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.1.6`，依赖闭包解析到 SDK `0.1.29`、插件 `0.1.63`。
  - 发布后 MiniMax NCP runtime 冒烟：`message.reasoning-delta` 非空且保留空白，最终文本 `391`。
- 2026-05-14 Codex bridge live output 修正验证：
  - 复现：延迟 fake upstream 每 450ms 输出三段 reasoning 和三段 text；修复前 NCP runtime 在约 `2169ms` 一次性输出完整 `message.reasoning-delta` 与 `message.text-delta`。
  - 修复后 runtime 层验收：reasoning delta 分别在约 `452ms / 902ms / 1354ms` 到达；text delta 分别在约 `1806ms / 2258ms / 2711ms` 按 `3`、`9`、`1` 到达。
  - Unit：`pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk test`，新增 live output stream 顺序测试，并覆盖 Codex event iterator 先结束时 live text 不被截断。
  - TypeScript：`pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk tsc`、`pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk tsc`、`pnpm -C packages/extensions/nextclaw-narp-runtime-codex-sdk tsc`。
  - Build：`pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk build`、`pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk build`、`pnpm -C packages/extensions/nextclaw-narp-runtime-codex-sdk build`。
  - MiniMax 真实模型 live 冒烟：NCP runtime 收到多段 live `message.reasoning-delta` 与最终 `message.text-delta`，内容包含 `391`。
  - 发布后安装验证：`/tmp` npm install `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.1.7`，依赖闭包解析到 SDK `0.1.30`、插件 `0.1.64`；发布后 runtime 层 smoke 输出 `452ms / 903ms / 1354ms` reasoning delta 与 `1804ms / 2255ms / 2706ms` text delta。
- 2026-05-14 Claude bridge raw whitespace 同步修正验证：
  - Unit：`pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk test`，覆盖 reasoning/text/tool argument delta 的 raw whitespace 保留。
  - TypeScript：`pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk tsc`、`pnpm -C packages/extensions/nextclaw-narp-runtime-claude-code-sdk tsc`。
  - Build：`pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk build`、`pnpm -C packages/extensions/nextclaw-narp-runtime-claude-code-sdk build`。
  - Lint：`pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk lint`。
  - 发布后 NARP 安装验证：`/tmp` npm install `@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.1.6`，依赖闭包解析到 SDK `0.1.31`；发布包 bridge smoke 输出 `thinking: "These seem "`、`thinking: "to be "`、`text: "Hello "`、`partial_json: " -la"`。
  - 发布后 plugin 安装验证：`/tmp` npm install `@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk@0.1.62`，依赖闭包解析到 SDK `0.1.31`。
- Governance:
  - `pnpm lint:new-code:governance`
  - `pnpm check:governance-backlog-ratchet`
- Maintainability guard:
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <本次相关路径>`：0 error，8 warning。
  - 2026-05-14 raw reasoning 修正：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`，0 error，0 warning，非测试代码 `+1 / -11 / net -10`。

## 发布/部署方式

- 本次只修改源码与本地构建产物验证，不涉及线上服务部署。
- NPM 包发布：已通过 `pnpm release:publish` 发布并完成 registry verification。
- Marketplace skill 发布：不涉及，本次未修改 marketplace skill 包内容。

## 用户/产品视角的验收步骤

1. 使用本机已配置的 DeepSeek provider 启动 Codex NARP runtime。
2. 发送一个较长文本生成请求。
3. 观察会话事件里出现多次 `message.text-delta`，而不是只有最终一次性输出。
4. 使用本机已配置的 MiniMax provider 启动 Claude NARP runtime。
5. 观察 thinking 进入 `message.reasoning-delta`，正文进入多次 `message.text-delta`。
6. 使用本机已配置的 DeepSeek 或 MiniMax provider 启动 Codex NARP runtime。
7. 触发命令型或普通对话请求，观察 Codex 不再输出 raw `message.reasoning-delta` thinking；正文与工具调用事件仍继续流式输出。

## 可维护性总结汇总

- 本次遵守 NARP 分层边界：通用 stdio client / wrapper 不识别 Codex、Claude 或 provider 身份。
- 新增流式状态机集中在 bridge stream writer owner 内，HTTP handler 保持薄路由，SDK mapper 只负责 NCP 事件表面稳定化。
- 删除了旧的“完整响应伪 stream”写法，替换为真实上游 SSE 转换。
- `post-edit-maintainability-guard` 结果：本次相关路径总代码 `+1796 / -189 / net +1607`，非测试代码 `+1796 / -189 / net +1607`；这是用户可见运行链路修复，净增主要来自真正流式状态机、协议转换和治理要求下的 owner class 收敛。
- 剩余 warning 主要是若干文件接近 400 行预算，以及 Claude/Codex stream writer 属于协议状态机集中承载点；后续若继续扩展 tool/reasoning 事件，应优先拆成更小的 writer/parser 子 owner。
- 2026-05-14 raw reasoning 修正属于非功能 bugfix：生产代码通过删除 Codex raw reasoning 映射分支净减 10 行，用户可见行为更可预测，测试增量集中在 mapper owner，没有增加新的 runtime fallback 或 provider 特判。
- 2026-05-14 空白保留修正属于非功能 bugfix：生产代码删除 mapper 摘要 workaround，并把真正修复收敛到 bridge delta 解析 owner；非测试代码 `+45 / -65 / net -20`，没有新增 provider 特判或 runtime fallback。
- 2026-05-14 live output 修正属于用户可见运行链路 bugfix：新增 live output stream owner，把 bridge 已有实时 SSE 转化为 NCP runtime 的实时用户表面事件；没有修改通用 NARP stdio client，也没有在 UI 层做假流式。
- 2026-05-14 Claude bridge raw whitespace 同步修正属于同类 bug 横向补齐：修复点收敛在 Claude OpenAI bridge 内容字段 reader，结构字段继续使用原有 reader；新增测试防止 reasoning/text/tool argument delta 再次被 trim。

## NPM 包发布记录

- `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk@0.1.60`：已发布。
- `@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk@0.1.60`：已发布，随 Claude SDK runtime 依赖闭包补发。
- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.29`：已发布。
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.26`：已发布。
- `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.1.3`：已发布，随 Codex runtime/plugin 依赖闭包补发。
- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.1.4`：已发布，随 Claude SDK runtime 依赖闭包补发。
- Registry verification：`pnpm release:verify:published` 已确认 6/6 包版本可见。
- 2026-05-14 raw reasoning 修正：
  - `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.28`：已发布。
  - `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk@0.1.62`：已发布，依赖 SDK `0.1.28`。
  - `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.1.5`：已发布，依赖 SDK `0.1.28` 与插件 `0.1.62`。
  - Registry verification：`pnpm release:verify:published` 已确认 3/3 包版本可见。
- 2026-05-14 Codex reasoning 空白保留修正：
  - `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.29`：已发布。
  - `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk@0.1.63`：已发布。
  - `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.1.6`：已发布。
  - Registry verification：`pnpm release:verify:published` 已确认 3/3 包版本可见。
- 2026-05-14 Codex bridge live output 修正：
  - `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.30`：已发布。
  - `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk@0.1.64`：已发布。
  - `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.1.7`：已发布。
  - Registry verification：`pnpm release:verify:published` 已确认 3/3 包版本可见。
- 2026-05-14 Claude bridge raw whitespace 同步修正：
  - `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.31`：已发布。
  - `@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk@0.1.62`：已发布。
  - `@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.1.6`：已发布。
  - Registry verification：`pnpm release:verify:published` 已确认 3/3 包版本可见。
