# v0.0.1-deepseek-default-model-official

## 迭代完成说明（改了什么）

- 将 DeepSeek provider 默认模型改为官方 API 模型标识：
  - `deepseek/deepseek-chat`
  - `deepseek/deepseek-reasoner`
- 同步修正服务端连接测试回退模型：
  - `deepseek-chat`
- 变更文件：
  - `packages/nextclaw-core/src/providers/registry.ts`
  - `packages/nextclaw-server/src/ui/config.ts`

## 测试 / 验证 / 验收方式

```bash
PATH=/opt/homebrew/bin:$PATH pnpm build
PATH=/opt/homebrew/bin:$PATH pnpm lint
PATH=/opt/homebrew/bin:$PATH pnpm tsc
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server exec vitest run src/ui/router.provider-test.test.ts
```

验证观察点：

- `GET /api/config/meta` 中 `deepseek.defaultModels` 包含 `deepseek/deepseek-chat`。
- Provider 测试连接未显式传 model 时，DeepSeek 使用回退模型 `deepseek-chat`。

## 发布 / 部署方式

- 本次仅涉及配置默认值与服务端回退模型，无数据库/后端迁移。
- 按常规包发布流程发布相关包：
  - `@nextclaw/core`
  - `@nextclaw/server`

## 用户 / 产品视角的验收步骤

1. 打开 Providers 页面，选择 DeepSeek。
2. 在模型列表中确认默认候选为官方模型（`deepseek-chat`、`deepseek-reasoner`）。
3. 触发 DeepSeek 测试连接，确认在未指定模型时可使用 `deepseek-chat`。
4. 打开 Model 配置页，选择 DeepSeek 时可直接选择/输入官方模型标识。

## 参考来源

- https://api-docs.deepseek.com/
- https://api-docs.deepseek.com/quick_start/pricing
