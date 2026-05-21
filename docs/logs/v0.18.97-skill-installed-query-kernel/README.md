# v0.18.97-skill-installed-query-kernel

## 迭代完成说明

- 将 installed skill 查询、详情生成、frontmatter 解析、`always` 判断、scope/query 过滤从 `@nextclaw/service` 收归 `@nextclaw/kernel` 的 `SkillManager`。
- 新增 kernel 级 `skill-frontmatter` 工具，作为 `SKILL.md` frontmatter 与 localized text map 的唯一解析事实源。
- `@nextclaw/service` 的 `SkillsQueryService` 只保留 CLI workspace adapter 与 marketplace 网络查询；marketplace metadata 复用 kernel 的 frontmatter 工具，不再维护平行解析实现。
- 清理 `@nextclaw/service` 对 `yaml` 的直接依赖，改由 kernel 持有解析依赖。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/kernel tsc`
- `pnpm --filter @nextclaw/kernel lint`
- `pnpm --filter @nextclaw/kernel build`
- `pnpm --filter @nextclaw/service tsc`
- `pnpm --filter @nextclaw/service lint`：通过，保留既有 18 个 warning，无新增 error。
- `pnpm --filter @nextclaw/service test -- --run src/cli/commands/skills/skills-query.service.test.ts src/cli/commands/skills/marketplace.publish.test.ts`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`：通过，非测试净增 0 行。
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`

## 发布/部署方式

- 本次未执行发布或部署。
- 变更影响 `@nextclaw/kernel` 与 `@nextclaw/service` 源码和依赖声明，后续随统一包发布批次发布。

## 用户/产品视角的验收步骤

1. 运行 skills installed / info 相关 CLI 路径，确认 installed skill 列表、summary、description、tags、always 与 detail body 仍正常。
2. 运行 marketplace publish/search/info 相关路径，确认 marketplace frontmatter 解析行为保持一致。
3. 从架构角度确认 service 不再持有 installed skill 自感知查询规则，只调用 kernel `SkillManager`。

## 可维护性总结汇总

- 本次遵循删除优先与职责收敛：删除 service 侧 installed skill 的重复读取、解析、过滤和 view 生成逻辑，把 NextClaw 自身能力清单的自感知规则收回 kernel。
- 非测试代码净增 0 行；service 生产代码明显减少，kernel 增加的是真实 owner 能力而非兼容桥。
- `post-edit-maintainability-guard` 已执行并通过；保留 warning：`SkillManager` 本次增长较多，后续若继续扩展 skill 子域，应考虑拆出 kernel 内部 collaborator；service skills 目录仍处于既有目录预算 warning。
- `post-edit-maintainability-review` 结论：通过。正向减债动作是职责收敛与删除重复实现；不是通过压缩行数达成，而是移除 service 中重复 owner 与直接解析依赖。

## NPM 包发布记录

- 不涉及 NPM 包发布。
- 待后续统一发布批次评估：`@nextclaw/kernel`、`@nextclaw/service`。
