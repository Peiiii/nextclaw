# Engine 插件化与 Codex SDK 独立插件接入

## 迭代完成说明（改了什么）

- 增加 Agent Engine 插件注册能力：插件现在可通过 `registerEngine` 注册引擎实现。
- 增加引擎扩展注册链路：`PluginRegistry -> ExtensionRegistry -> GatewayAgentRuntimePool` 全链路支持 `engines`。
- Agent 配置支持引擎选择：
  - `agents.defaults.engine`
  - `agents.defaults.engineConfig`
  - `agents.list[].engine`
  - `agents.list[].engineConfig`
- Runtime Pool 支持按 agent 选择引擎：
  - `native`（默认）
  - 插件注册的任意引擎（找不到或初始化失败会回退 `native` 并告警）
- 新增**独立插件包** `@nextclaw/nextclaw-engine-codex-sdk`（路径：`packages/extensions/nextclaw-engine-plugin-codex-sdk`）：
  - 基于 OpenAI 官方开源 `@openai/codex-sdk`
  - 注册 engine kind `codex-sdk`
  - 支持流式事件转发与会话复用
- 已移除 `@nextclaw/core` 与 `@nextclaw/openclaw-compat` 中的 Codex 专有实现和依赖，Codex 逻辑仅存在于独立插件包。

## 配置示例（Codex SDK via Relay）

```json
{
  "plugins": {
    "load": {
      "paths": [
        "/absolute/path/to/packages/extensions/nextclaw-engine-plugin-codex-sdk"
      ]
    }
  },
  "agents": {
    "defaults": {
      "engine": "codex-sdk",
      "model": "openai/gpt-5-codex",
      "engineConfig": {
        "model": "openai/gpt-5-codex",
        "apiBase": "https://your-relay.example.com/v1",
        "apiKey": "sk-xxx",
        "workingDirectory": "/abs/path/to/your/repo",
        "sandboxMode": "workspace-write",
        "approvalPolicy": "on-request",
        "skipGitRepoCheck": false
      }
    }
  }
}
```

说明：`engineConfig.apiKey` 为空时，会回退读取 `providers.*.apiKey`（按 model 匹配）；`apiBase` 可配置中转站地址。

## 测试 / 验证 / 验收方式

执行命令：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm build
PATH=/opt/homebrew/bin:$PATH pnpm lint
PATH=/opt/homebrew/bin:$PATH pnpm tsc

# 冒烟（隔离 NEXTCLAW_HOME，且不向仓库目录写测试数据）
TMP_HOME="$(mktemp -d)"
cat > "$TMP_HOME/config.json" <<'JSON'
{
  "plugins": {
    "load": {
      "paths": [
        "/absolute/path/to/packages/extensions/nextclaw-engine-plugin-codex-sdk"
      ]
    }
  }
}
JSON

NEXTCLAW_HOME="$TMP_HOME" PATH=/opt/homebrew/bin:$PATH node packages/nextclaw/dist/cli/index.js plugins info nextclaw-engine-codex-sdk
NEXTCLAW_HOME="$TMP_HOME" PATH=/opt/homebrew/bin:$PATH node packages/nextclaw/dist/cli/index.js plugins list --json
rm -rf "$TMP_HOME"
```

验收点：

- build/lint/tsc 全通过。
- 插件信息中可见 `Engines: codex-sdk`。
- 插件列表 JSON 中 `nextclaw-engine-codex-sdk` 已加载。

## 发布 / 部署方式

- 本次变更为代码与配置能力增强，不涉及数据库变更。
- 发布按常规 npm 流程（changeset -> version -> publish）执行。
- 需要发布的核心组件：
  - `@nextclaw/openclaw-compat`（去除 Codex 内置耦合）
  - `@nextclaw/nextclaw-engine-codex-sdk`（新增独立插件包）

## 用户 / 产品视角验收步骤

1. 在配置中增加 `plugins.load.paths` 指向 `@nextclaw/nextclaw-engine-codex-sdk`。
2. 将 `agents.defaults.engine` 设为 `codex-sdk`。
3. 配置 `engineConfig.model/apiBase/apiKey`（可使用中转站地址）。
4. 启动 gateway 或在 UI 发起对话。
5. 观察回复可正常流式输出，且会话可持续。
6. 将 `engine` 切回 `native`，确认可无缝回退。
