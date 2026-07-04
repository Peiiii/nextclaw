# v0.21.2 learning loop 默认关闭

## 迭代完成说明

- 将 `agents.learningLoop.enabled` 的 schema 默认值从 `true` 调整为 `false`。
- 保留 `learning-loop enable/disable/status/threshold` CLI 控制面不变；已经显式写入配置的用户设置仍然优先于默认值。
- 同步更新 config schema 默认值测试，确认空配置解析时 learning loop 默认关闭，阈值仍为 `15`。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/core test -- src/features/config/configs/config-schema.learning-loop.config.test.ts`
- `pnpm --filter @nextclaw/core build`
- `pnpm --filter @nextclaw/core tsc`
- `pnpm --filter @nextclaw/core lint`
  - 通过，无 error；保留 26 个既有 warning，均不在本次触达文件。
- 隔离 `NEXTCLAW_HOME` 运行 `learning-loop status --json`：
  - 全新配置输出 `enabled: false`、`toolCallThreshold: 15`。
  - 执行 `learning-loop enable` 后再次 status 输出 `enabled: true`，确认显式配置仍优先。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-core/src/features/config/configs/config-schema.config.ts packages/nextclaw-core/src/features/config/configs/config-schema.learning-loop.config.test.ts`
- `pnpm lint:new-code:governance -- packages/nextclaw-core/src/features/config/configs/config-schema.config.ts packages/nextclaw-core/src/features/config/configs/config-schema.learning-loop.config.test.ts .changeset/fuzzy-learning-loop.md docs/logs/v0.21.2-learning-loop-default-off/README.md`
- `pnpm check:governance-backlog-ratchet`
- `pnpm clean:generated`
- 额外说明：
  - 全量 `pnpm lint:new-code:governance` 被工作区既有 chat UI 改动阻塞，阻塞点是 `packages/nextclaw-agent-chat-ui/...` 的跨目录相对导入，不属于本次 learning loop 改动。
  - `pnpm release:notes:check` 当前脚本不存在；本次已直接补 `.changeset/fuzzy-learning-loop.md`。
  - `pnpm changeset status --since=HEAD` 在未 staged 的 changeset 文件场景下未能识别新增 changeset，不能作为本次发布说明判断依据。

## 发布/部署方式

- 未发布。
- 本次改变用户可见默认行为，已补 `.changeset/fuzzy-learning-loop.md`，等待统一 NPM 发布流程。

## 用户/产品视角的验收步骤

1. 使用全新的 `NEXTCLAW_HOME` 或未设置 `agents.learningLoop` 的配置启动/读取配置。
2. 运行 `nextclaw learning-loop status --json`。
3. 预期输出 `enabled: false`，并保留 `toolCallThreshold: 15`。
4. 如用户执行 `nextclaw learning-loop enable`，显式配置应继续启用 learning loop。

## 可维护性总结汇总

- 本次只调整默认策略 owner，没有在 kernel contribution、CLI 或 runtime 里增加平行分支。
- 默认值仍由 `@nextclaw/core` 的 config schema 统一拥有，kernel 继续只消费有效配置。
- Maintainability guard  scoped 结果：总行数 `+3/-3/net 0`，非测试代码 `+1/-1/net 0`，无阻塞项或警告。
- 主观可维护性复核：通过。本次没有新增抽象、文件、分支或 runtime 特判；正向动作是职责收敛，默认值仍停留在唯一 schema owner。

## NPM 包发布记录

- 需要进入后续统一 NPM 发布。
- 影响包：`@nextclaw/core`。
- 当前状态：已添加 changeset，待统一发布。
