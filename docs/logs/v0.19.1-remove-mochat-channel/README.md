# v0.19.1 remove mochat channel

## 迭代完成说明

- 删除不再明确具备产品价值和 owner 的 Mochat 渠道，不迁移到 extension channel controller。
- 移除旧 `nextclaw-channel-plugin-mochat` 包、runtime channel 实现、builtin channel 注册、配置 schema/label/help、UI 表单和 logo、desktop 依赖、openclaw compat bundled 插件声明、marketplace seed、README/USAGE/PRD/current feature 文档中的当前能力表述。
- 将 `packages/nextclaw-runtime/src/channels/builtin.ts` 收敛为 `builtin-channel.config.ts`，避免本次触达后继续违反 role-boundary 命名治理。
- 清理普通文档中的当前能力残留，并把本轮触达的旧 `docs/designs` 文件补齐日期前缀。

## 测试/验证/验收方式

- `pnpm install --lockfile-only --ignore-scripts`：通过。
- `pnpm -C packages/nextclaw-core tsc`：通过。
- `pnpm -C packages/extensions/nextclaw-channel-runtime tsc`：通过。
- `pnpm -C packages/nextclaw-runtime tsc`：通过。
- `pnpm -C packages/nextclaw-openclaw-compat tsc`：通过。
- `pnpm -C packages/nextclaw-service tsc`：通过。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C apps/desktop tsc`：通过。
- `pnpm -C apps/landing tsc`：通过。
- `pnpm -C packages/nextclaw-service test -- src/commands/channel/channels.test.ts src/commands/channel/builtin-channels.test.ts --run`：通过，2 个测试文件、5 个用例。
- `pnpm -C packages/nextclaw-runtime lint`、`apps/desktop lint`、`apps/landing lint`、`packages/nextclaw lint`、`workers/marketplace-api lint`：通过；landing 仍有既有长文件 warning。
- `git diff --check`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`：通过，无 error。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm lint:new-code:governance`：仍被历史命名阻塞，剩余项为 `schema.help.ts`、`schema.labels.ts` 位于 `configs/` 目录但未使用 `*.config.ts` 命名；本轮未继续扩大到整个 config 目录命名迁移。
- `pnpm -C packages/nextclaw-ui lint`：失败在既有 chat/doc-browser/system-status 等无关 lint error，与 Mochat 删除路径无交集。

## 发布/部署方式

未发布、未部署。本轮是源码和文档删除，后续应随统一版本发布进入 NPM/桌面包。

## 用户/产品视角的验收步骤

- 渠道列表、配置 schema、CLI channel 管理、marketplace seed、README/USAGE/PRD 当前能力描述中不再出现 Mochat。
- 旧 Mochat plugin 包和 runtime 实现不再存在。
- 搜索活跃代码、包依赖、锁文件和文件路径，不再能找到 `nextclaw-channel-plugin-mochat` 或 Mochat 运行时代码。

## 可维护性总结汇总

- 本轮遵守 deletion-first：没有给 Mochat 建新 extension，直接删除不清楚 owner 的旧渠道。
- maintainability guard 统计：总计 `+25 / -1229 / net -1204`，非测试代码 `+20 / -1225 / net -1205`，满足非功能改动净减要求。
- 正向减债：删除一个旧 channel plugin 包、一个旧 runtime channel、相关 UI/logo/config/seed/docs 表面，并减少 channel migration 后续批量迁移的噪声。
- 已使用 post-edit maintainability guard 和主观可维护性复核；遗留 warning 为既有长文件/目录预算问题，本轮没有加重。

## 红区触达与减债记录

### apps/landing/src/main.ts

- 本次是否减债：是。
- 说明：仅删除 Mochat 当前能力展示，文件行数下降。
- 下一步拆分缝：landing 主渲染文件仍明显超预算，后续应按页面区块拆出独立 view model 或 section module。

### packages/nextclaw-service/src/commands/channel/index.ts

- 本次是否减债：是。
- 说明：删除 Mochat label，文件行数下降。
- 下一步拆分缝：channel CLI 展示和状态聚合可继续按 command view/model 边界拆分。

## NPM 包发布记录

不涉及 NPM 包发布。删除影响多个 workspace 包，但本轮未执行 release；如果进入正式发布，需要统一评估 `nextclaw`、`@nextclaw/runtime`、`@nextclaw/core`、`@nextclaw/service`、`@nextclaw/ui`、desktop 相关包和 extension runtime 的版本发布链路。
