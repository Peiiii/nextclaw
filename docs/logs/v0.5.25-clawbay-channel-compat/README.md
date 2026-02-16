# 2026-02-16 ClawBay channel plugin compatibility (OpenClaw)

## 改动内容

- 在 `@nextclaw/openclaw-compat` 补齐 channel 兼容关键能力：
  - runtime bridge（`runtime.config.*`、`runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher`）
  - plugin channel gateway 启停管理（支持 `gateway.startAccount`）
  - plugin channel setup/configSchema/uiHints/agentTools 的识别与接线
- 在 `nextclaw` CLI 新增 `channels add --channel <id> ...`，用于 OpenClaw 风格 channel setup（如 `--code` / `--token` / `--url`）。
- 插件配置映射新增桥接：
  - 对插件暴露 `channels.<pluginChannelId>` 视图
  - 持久化仍写入 `plugins.entries.<pluginId>.config`（避免污染 core 的 channels schema）
- UI schema 元数据改为可从插件注册结果提取（含 channel `configSchema` + `uiHints`），确保 ClawBay 字段可在 UI/schema 中显示。
- 对齐 OpenClaw 的 `agentPrompt.messageToolHints`：
  - 新增按 channel 解析 hints 的兼容层能力
  - 在 `nextclaw-core` system prompt 的 Messaging 区块注入 channel-specific message hints
  - runtime bridge 透传 `AccountId`，支持按账号维度解析 hints
- 修复插件安装链路可靠性问题：
  - 修复 archive/npm 安装中的 async `finally` 时序问题（避免临时目录过早清理）
  - 安装失败时回滚目标目录，避免留下半安装状态
  - extension entry 缺失改为安装失败（不再“假成功”）

## 验证

### 工程验证

- `pnpm build`
- `pnpm lint`（仅既有 max-lines warning）
- `pnpm tsc`

### 冒烟验证

- 本地路径安装 ClawBay 插件：
  - `nextclaw plugins install /Users/peiwang/Projects/clawpage/packages/clawbay-channel`
  - `nextclaw plugins list --json` 显示：
    - `toolNames` 包含 `clawbay_post`、`clawbay_publish_app`
    - `configJsonSchema` 包含 `pairingCode`/`connectorToken`/`apiKey` 等
    - `configUiHints` 包含 `connectorToken`/`apiKey` 的敏感提示
- channel setup：
  - `nextclaw channels add --channel clawbay --code AB12CD`
  - 配置写入 `plugins.entries.clawbay-channel.config.pairingCode`
- npm 安装路径验证：
  - `nextclaw plugins install @clawbay/clawbay-channel` 可完成安装与发现
- messageToolHints 注入验证：
  - 使用临时 `NEXTCLAW_HOME` 安装 `clawbay-channel` 后，调用兼容层解析 `resolvePluginChannelMessageToolHints({ channel: "clawbay" })` 返回非空
  - 通过 `AgentLoop.processDirect` 冒烟验证 system prompt 含 `### message tool hints` 且包含实际 hints 文案

## 发布/部署

- 本次未执行 npm 发布。
- 若需发布，按 `docs/workflows/npm-release-process.md` 执行 changeset + version + publish。
