# `pnpm dev start` 多插件本地覆盖方案

## 目标

为 `pnpm dev start` 提供一套通用的“按插件覆盖默认来源”的开发机制：

- 支持一次指定一个或多个插件
- 每个插件都可以单独指定本地路径
- 默认优先使用该路径下插件的 `production` 入口，也就是本地最新 `build/dist`
- 如确有需要，可显式指定该插件走 `development` 入口
- 覆盖仅对当前 `pnpm dev start` 进程生效，不修改用户全局 `config.json`

## CLI 语义

推荐语法：

```bash
pnpm dev start \
  --plugin-override nextclaw-ncp-runtime-plugin-codex-sdk=./packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk \
  --plugin-override nextclaw-channel-plugin-discord=/abs/path/to/plugin \
  --plugin-override nextclaw-ncp-runtime-plugin-claude-code-sdk=./packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk#development
```

约定：

- `pluginId=path`
  默认表示该插件走本地 `production`
- `pluginId=path#development`
  表示该插件显式走本地 `development`
- `pluginId=path#production`
  与默认行为一致，主要用于表达清晰

## 行为原则

- 只覆盖被点名的插件，其它插件完全保持默认来源
- 当前进程内的插件加载、runtime 列表、插件注册，都应看到同一套 override 结果
- 被覆盖插件如在安装目录里也存在副本，应排除旧安装副本，避免同一插件被本地和安装态重复加载
- 若 override 路径不存在、缺少 `package.json` / `openclaw.plugin.json`、或 manifest id 与传入 `pluginId` 不一致，应直接 fail-fast
- 若请求 `development`，但该插件未声明 `openclaw.development.extensions`，应直接 fail-fast

## 实现分层

### 1. `scripts/dev-runner.mjs`

- 解析重复出现的 `--plugin-override`
- 将解析结果序列化到进程级环境变量，例如 `NEXTCLAW_DEV_PLUGIN_OVERRIDES`
- 不写入 `~/.nextclaw/config.json`

### 2. `packages/nextclaw/src/cli/commands/plugin/development-source/*`

- 新增一层通用 helper，负责：
  - 解析 override env
  - 校验插件根目录与 manifest
  - 生成覆盖后的 in-memory config
  - 生成需要排除的已安装副本根目录

### 3. 插件加载入口

接入点至少包括：

- `packages/nextclaw/src/cli/commands/plugins.ts`
- `packages/nextclaw/src/cli/commands/plugin/plugin-registry-loader.ts`
- `packages/nextclaw/src/cli/commands/agent/agent-runtime.ts`

这些入口都要统一使用“first-party dev load path + explicit plugin override”后的 config，而不是各自再做一套判定。

## 非目标

- 不把所有 first-party 插件都自动切到本地
- 不把 `pnpm dev start` 默认切成源码调试模式
- 不修改插件安装记录或用户全局配置
- 不为 Codex 单独加特例

## 验证

至少验证以下场景：

1. 无 override 时，`pnpm dev start` 行为保持不变
2. 单插件 `production` override 时，只该插件改走本地 `dist`
3. 多插件 override 时，多个插件都正确覆盖，其它插件不受影响
4. `development` override 时，仅该插件切到 dev source
5. override 路径无效 / pluginId 不匹配 / development 能力缺失时，命令明确失败
