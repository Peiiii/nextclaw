# v0.6.55-dmscope-doc-guard

## 迭代完成说明（改了什么）

本次聚焦“AI 配置多 agent 时避免写入非法枚举值”的文档与提示词护栏，重点对齐 OpenClaw 的 `session.dmScope` 合法值与配置流程。

- 在 [`docs/USAGE.md`](../../../docs/USAGE.md) 明确 `session.dmScope` 仅允许 4 个值，并补充非法示例说明。
- 在 [`docs/USAGE.md`](../../../docs/USAGE.md) 的“internal AI operations”补充强制配置流程：`config.get -> config.schema -> config.patch -> config.get`。
- 在 [`packages/nextclaw-core/src/agent/context.ts`](../../../packages/nextclaw-core/src/agent/context.ts) 增加运行时提示词护栏，要求 AI 严格按 `config.schema` 枚举写入，禁止猜测/拼接新值。

## 测试 / 验证 / 验收方式

- 工程验证：
  - `pnpm build`
  - `pnpm lint`
  - `pnpm tsc`
- 验证结果：通过（lint 仅有仓库既有 warning，无新增 error）。

### 用户/产品视角验收步骤

1. 打开 [`docs/USAGE.md`](../../../docs/USAGE.md)，确认 `session.dmScope` 合法值说明明确且包含非法值反例。
2. 打开 [`docs/USAGE.md`](../../../docs/USAGE.md)，确认“AI 配置流程”步骤完整且可执行。
3. 让 AI 执行多 agent 配置请求，观察其是否先读 schema，再写 patch。
4. 验收标准：AI 不再生成/写入非法 `dmScope`，用户可据文档直接排查与校验。

## 发布 / 部署方式

- 发布流程参考：[`docs/workflows/npm-release-process.md`](../../../docs/workflows/npm-release-process.md)
- 本次变更类型：文档 + 运行时提示词护栏（无需 migration）。
- 若需发布，执行：
  1. `pnpm changeset`
  2. `pnpm release:version`
  3. `pnpm release:publish`
