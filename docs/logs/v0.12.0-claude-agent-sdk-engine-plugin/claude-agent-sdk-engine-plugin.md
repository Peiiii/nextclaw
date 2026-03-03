# Claude Agent SDK 引擎插件内置集成

## 迭代完成说明（改了什么）

- 新增独立引擎插件包：`@nextclaw/nextclaw-engine-claude-agent-sdk`
  - 路径：`packages/extensions/nextclaw-engine-plugin-claude-agent-sdk`
  - 结构：TypeScript + `src/` + 独立构建（`tsup`）
  - 引擎种类：`claude-agent-sdk`
- 保持解耦：Claude 相关实现仅在独立插件包内，不耦合进 `core` 与业务逻辑。
- OpenClaw 兼容层增加内置 runtime 插件注入：
  - 在 bundled runtime plugin 列表中加入 `@nextclaw/nextclaw-engine-claude-agent-sdk`
  - 无需额外 `plugins.load.paths` 即可内置发现。
- `openclaw-compat` 增加对新插件包的依赖。
- 根脚本已纳入新插件：`build` / `lint` / `tsc`。
- 插件实现支持：
  - 会话级 session id 复用（跨 turn）
  - 统一事件桥接到 `engine.claude.*`
  - 可配置 `permissionMode` / `maxTurns` / `settingSources` / `allowedTools` 等
  - 新增 `requestTimeoutMs`，避免 Claude SDK 无响应时长时间阻塞

## 测试 / 验证 / 验收方式

基础验证：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm install
PATH=/opt/homebrew/bin:$PATH pnpm build
PATH=/opt/homebrew/bin:$PATH pnpm lint
PATH=/opt/homebrew/bin:$PATH pnpm tsc
```

插件装载冒烟：

```bash
PATH=/opt/homebrew/bin:$PATH node packages/nextclaw/dist/cli/index.js plugins info nextclaw-engine-claude-agent-sdk
PATH=/opt/homebrew/bin:$PATH node packages/nextclaw/dist/cli/index.js plugins list --json
```

验收点：

- `nextclaw-engine-claude-agent-sdk` 显示 `Origin: bundled`。
- `Engines: claude-agent-sdk` 正常出现。
- 当前 engine 总数（含 core）为 3：`native`、`codex-sdk`、`claude-agent-sdk`。

运行链路冒烟（无有效 Claude 凭据场景）：

- 在隔离 `NEXTCLAW_HOME` 中将默认引擎设置为 `claude-agent-sdk`，并设置 `requestTimeoutMs=5000`。
- 调用 `/api/chat/turn`。
- 预期：5xx 快速返回，不再无限卡住；错误信息包含 Claude SDK 进程被中断语义（由超时中止触发）。

说明：

- 本地环境未提供可用 Claude 鉴权（`providers.anthropic.apiKey`、`ANTHROPIC_API_KEY`、`CLAUDE_CODE_OAUTH_TOKEN` 均不可用），因此本轮无法完成“成功回复+工具执行”的 Claude 正向验收；该部分需补充有效 Claude 凭据后再跑。

## 发布 / 部署方式

- 本次不涉及数据库和 migration。
- 按项目既有 NPM 流程发布（changeset -> version -> publish）。
- 若仅本地联调可不发包。

## 用户 / 产品视角验收步骤

1. 打开 Runtime 配置，将默认引擎改为 `claude-agent-sdk` 并保存。
2. 发起新会话，确认请求不会长时间卡死（超时配置生效）。
3. 在具备有效 Claude 凭据后，再次发起会话，确认可正常得到回复。
4. 将默认引擎切回 `native` 或 `codex-sdk`，确认切换无异常。
