# 2026-02-19 v0.6.15-openai-wireapi-transient-retry

## 迭代完成说明

- 修复 `openai provider` 在 `wireApi=responses` 下对网关间歇性 `502` 的鲁棒性问题。
- 保持 `wireApi` 语义不变：
  - `chat` 只走 `chat/completions`
  - `responses` 只走 `responses`
  - `auto` 维持原有策略（`chat` 失败再按既有规则切到 `responses`）
- 在 `@nextclaw/core` 的 OpenAI 兼容 provider 增加同 API 内部重试机制（最多 3 次，短退避），覆盖临时性网络/网关错误（如 429/5xx、socket/reset/timeout）。

## 测试 / 验证 / 验收

### 开发验证

```bash
pnpm -C packages/nextclaw-core build
pnpm -C packages/nextclaw-core lint
pnpm -C packages/nextclaw-core tsc
```

结果：通过（仅存在仓库既有 lint warning，无新增 error）。

### 全仓验证

```bash
pnpm build
pnpm lint
pnpm tsc
```

结果：通过（仅存在仓库既有 lint warning，无新增 error）。

### 冒烟（隔离目录，不写入仓库）

环境：`NEXTCLAW_HOME=/tmp/nextclaw-smoke-5bTQBX`

关键配置：
- `providers.openai.apiBase = https://yunyi.cfd/codex`
- `providers.openai.wireApi = responses`
- `agents.defaults.model = openai/gpt-5.2-codex`

命令：

```bash
pnpm -C packages/nextclaw dev:build agent -s cli:final-11238-2 -m "只回复OK" --model openai/gpt-5.2-codex
```

观察点：返回 `OK`（已成功验证）。

## 发布 / 部署方式

- 本次为本地修复验证，未执行 npm 发布。
- 若需发布：按项目发布流程执行 `changeset -> version -> publish`。
