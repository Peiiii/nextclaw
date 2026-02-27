# v0.0.1-openclaw-secrets-support

## 迭代完成说明（改了什么）

- 新增 `nextclaw` secrets 能力，对齐 OpenClaw 风格：支持 `env` / `file` / `exec` 三类 secret provider。
- 新增配置结构：`secrets.enabled`、`secrets.defaults`、`secrets.providers`、`secrets.refs`。
- 新增核心解析器：`packages/nextclaw-core/src/config/secrets.ts`，支持运行时解析、provider 快照缓存、路径注入、错误提示。
- 新增 inline ref 兼容迁移：敏感字段中直接写 `{source, provider?, id}` 时，加载配置会自动归一化到 `secrets.refs`。
- 运行时接入 secrets 解析（不回写明文）：
  - `packages/nextclaw/src/cli/commands/service.ts`
  - `packages/nextclaw/src/cli/runtime.ts`
  - `packages/nextclaw/src/cli/gateway/controller.ts`
- UI/API 对齐：
  - Provider 的 `apiKeySet` 现在可识别 `secrets.refs`。
  - 更新 provider/channel 敏感字段时，会清理对应 secret ref，避免冲突。
  - Channel 密码字段提交改为“空值不覆盖”，避免误清空。
- 文档更新：
  - `apps/docs/en/guide/configuration.md`
  - `apps/docs/zh/guide/configuration.md`
  - `README.md`
  - `README.zh-CN.md`
- 新增自动化测试：`packages/nextclaw-core/src/config/secrets.test.ts`。

## 测试/验证/验收方式

- 单测：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core test -- run src/config/secrets.test.ts`
  - 结果：4/4 通过。
- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm tsc`
  - 结果：通过。
- 构建：
  - `PATH=/opt/homebrew/bin:$PATH pnpm build`
  - 结果：通过。
- Lint：
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint`
  - 结果：通过（仅存量 warning，无新增 error）。
- 冒烟（隔离目录，不写仓库）：
  - 在 `/tmp/nextclaw-secrets-smoke-*` 下写入配置，配置 `providers.openai.apiKey` 通过 `secrets.refs` 引用 `OPENAI_API_KEY`。
  - 运行 core 解析脚本，确认 `rawApiKey` 为空、`resolvedApiKeyPrefix` 为 `sk-smoke`。
  - 运行 `nextclaw doctor --json`，确认 `OpenAI` 显示 `configured: true` 且 `detail: "apiKey ref set"`。

## 发布/部署方式

- 常规 npm 发布流程保持不变，按项目发布文档执行：
  - 先执行 `pnpm build && pnpm lint && pnpm tsc`。
  - 执行 changeset/version/publish 流程。
- 本次改动覆盖 `@nextclaw/core`、`@nextclaw/server`、`nextclaw`、`@nextclaw/ui`，发布时需按依赖链联动发布。

## 用户/产品视角的验收步骤

- 步骤 1：在 `~/.nextclaw/config.json`（或 `NEXTCLAW_HOME` 指定目录）中设置 `secrets.providers` 与 `secrets.refs`，将 `providers.openai.apiKey` 置空并引用环境变量。
- 步骤 2：设置环境变量，例如 `export OPENAI_API_KEY=...`。
- 步骤 3：执行 `nextclaw doctor --json`，确认 Provider 显示已配置（`apiKey ref set`）。
- 步骤 4：启动服务并正常对话/调用渠道，确认运行时能读取 secret，不需要在配置中保存明文 key。
- 步骤 5：在 UI 中修改某个敏感字段并保存，确认不会因为空密码框误清空已有值。
