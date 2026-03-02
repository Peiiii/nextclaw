# 2026-03-02 Remove Runtime `maxTokens` Config (Align OpenClaw)

## 背景 / 目标

- 现有 UI 在 Model 页面暴露了 `maxTokens` 生成参数，容易制造“必须手动调参”的认知负担。
- 目标是一次性对齐 OpenClaw：移除 `agents.defaults.maxTokens` 与 `agents.list.*.maxTokens` 配置入口，不做兼容过渡。
- 同步落地项目规则：查看 OpenClaw 源码时优先读取本地兄弟目录 `../openclaw`。

## 变更内容（迭代完成说明）

- 配置 Schema 断代移除：
  - 删除 `agents.defaults.maxTokens` 与 `agents.list.*.maxTokens`。
  - 文件：`packages/nextclaw-core/src/config/schema.ts`
- 配置 UI 元信息同步：
  - 删除上述路径的 help/label/reload 标记。
  - 文件：
    - `packages/nextclaw-core/src/config/schema.help.ts`
    - `packages/nextclaw-core/src/config/schema.labels.ts`
    - `packages/nextclaw-core/src/config/reload.ts`
- 运行时传参链路收敛：
  - agent runtime pool / CLI runtime 不再读取和注入 agent profile 的 `maxTokens`。
  - 文件：
    - `packages/nextclaw/src/cli/commands/agent-runtime-pool.ts`
    - `packages/nextclaw/src/cli/runtime.ts`
- Provider 请求策略调整：
  - OpenAI/LiteLLM provider 不再强制注入 `4096`，仅在显式传入时透传 `max_tokens`。
  - 文件：
    - `packages/nextclaw-core/src/providers/openai_provider.ts`
    - `packages/nextclaw-core/src/providers/litellm_provider.ts`
- UI/API/服务端模型接口收敛：
  - Model 页面移除 “Generation Parameters / Max Tokens” 区域。
  - `/api/config/model` 仅接受并返回 `model`。
  - UI/API 类型删除 `maxTokens` 字段。
  - 文件：
    - `packages/nextclaw-ui/src/components/config/ModelConfig.tsx`
    - `packages/nextclaw-ui/src/components/config/RuntimeConfig.tsx`
    - `packages/nextclaw-ui/src/api/config.ts`
    - `packages/nextclaw-ui/src/api/types.ts`
    - `packages/nextclaw-ui/src/lib/i18n.ts`
    - `packages/nextclaw-server/src/ui/router.ts`
    - `packages/nextclaw-server/src/ui/config.ts`
    - `packages/nextclaw-server/src/ui/types.ts`
- 文档同步（非历史日志）：
  - 移除当前文档中对 UI `maxTokens` 与 `agents.defaults.maxTokens` 的过期描述。
  - 文件：
    - `docs/USAGE.md`
    - `packages/nextclaw/templates/USAGE.md`
    - `apps/docs/en/guide/configuration.md`
    - `apps/docs/zh/guide/configuration.md`
    - `docs/prd/current-feature-list.md`
    - `docs/prd/nextclaw-ui-prd.md`
    - `docs/designs/ui-gateway-api.md`
    - `docs/nextclaw-ui-design-brief.md`
- 规则变更：
  - `AGENTS.md` 的 `Project Rulebook` 新增 `prefer-local-openclaw-sibling-source`。

## OpenClaw 对齐说明

- 已对照本地兄弟仓库 `../openclaw`：
  - OpenClaw 不使用 `agents.defaults.maxTokens`（对应 schema/type 均无该字段）。
- 本次对齐策略：
  - 移除 nextclaw 的 agent defaults/profile `maxTokens` 配置位。
  - 保留 provider 连接测试探测值 `maxTokens >= 16`（仅用于连通性探测，不是运行时用户配置项）。

## 测试 / 验证 / 验收方式

执行命令：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm build
PATH=/opt/homebrew/bin:$PATH pnpm lint
PATH=/opt/homebrew/bin:$PATH pnpm tsc
```

结果：

- `pnpm build` 通过
- `pnpm lint` 通过（仅既有 max-lines 警告，无新增 error）
- `pnpm tsc` 通过

冒烟验证（用户可见改动最小流程）：

```bash
# 1) 构建前端
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui build

# 2) 确认 Model 页面产物不再包含旧文案/旧参数入口
rg -n "Generation Parameters|maxTokens|Max Tokens" packages/nextclaw-ui/dist/assets/ModelConfig-*.js
```

冒烟观察点：

- `rg` 无匹配输出（退出码 1）表示 Model 页面 bundle 不再包含该参数区域/文案。
- 服务端模型接口校验为 `model is required`，不再接受 `maxTokens` 作为保存参数。

## 用户 / 产品视角验收步骤

1. 打开 UI 的 Model 页面。
2. 确认页面不再出现 “Generation Parameters / Max Tokens” 区域。
3. 修改模型并保存，确认保存成功提示正常。
4. 抓包确认 `PUT /api/config/model` 仅提交 `{ model }`。
5. 刷新页面，确认模型配置保持最新值。

## 发布 / 部署方式

- 变更类型：核心配置 + UI/API + 文档。
- 若仅发布 UI 产物：执行 `pnpm release:frontend`。
- 若纳入常规版本发布：按 [NPM 发布流程](../../../workflows/npm-release-process.md) 执行 changeset/version/publish。
- 本次不涉及后端数据库变更，remote migration 不适用。

## 风险与影响

- Breaking change：中
  - `agents.defaults.maxTokens` 与 `agents.list.*.maxTokens` 被移除，历史配置将不再生效。
- 兼容性评估：
  - 对 OpenClaw 插件兼容性无新增负担（方向与 OpenClaw 对齐）。
  - 仅保留 provider 探测最小 `maxTokens`（16）用于连接测试，不影响常规会话参数来源。
