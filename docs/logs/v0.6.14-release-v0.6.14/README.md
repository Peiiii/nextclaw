# 2026-02-19 Release v0.6.14

## 发布目标

- 发布 OpenAI 兼容 provider 的瞬时网关故障鲁棒性修复，确保在不改变 `wireApi` 策略语义前提下提高可用性。

## 发布范围

- `nextclaw@0.6.14`
- `@nextclaw/core@0.6.14`

未发布（版本未变更）：
- `@nextclaw/openclaw-compat@0.1.5`
- `@nextclaw/server@0.4.2`
- `@nextclaw/ui@0.3.9`

## 执行记录

```bash
pnpm release:version
pnpm release:publish
```

发布输出：
- `nextclaw@0.6.14` 发布成功
- `@nextclaw/core@0.6.14` 发布成功
- 自动生成 tag：`nextclaw@0.6.14`、`@nextclaw/core@0.6.14`

## 验证结果

- 发布前校验通过：`pnpm build && pnpm lint && pnpm tsc`（仅既有 warning，无新增 error）。
- npm 验收通过：
  - `npm view nextclaw version` → `0.6.14`
  - `npm view @nextclaw/core version` → `0.6.14`
- 发布后隔离冒烟通过（不写入仓库目录）：
  - `NEXTCLAW_HOME=/tmp/nextclaw-release-smoke-ceXRZk`
  - `npx -y nextclaw@0.6.14 agent -s cli:release-smoke-1 -m "只回复OK" --model openai/gpt-5.2-codex`
  - 返回：`OK`

## 文档复盘

- 本次已同步：
  - `docs/logs/v0.6.15-openai-wireapi-transient-retry/README.md`
  - `docs/logs/v0.6.14-release-v0.6.14/README.md`
  - `docs/logs/README.md`
- 不涉及数据库/后端 migration（不适用）。
