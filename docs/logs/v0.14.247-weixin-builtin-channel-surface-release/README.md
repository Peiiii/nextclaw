# v0.14.247-weixin-builtin-channel-surface-release

## 迭代完成说明

- 将 `weixin` 对齐为 NextClaw 内置渠道表面的一部分：
  - `@nextclaw/core` 默认配置新增 `channels.weixin`
  - `@nextclaw/runtime` 内置渠道集合新增 `weixin`
  - `nextclaw` CLI 的 `channels status` 新增 `Weixin`
- 补充相关测试与产品文档，确保新安装场景能看到 Weixin 入口。
- 清理了本次发布过程中误卷入的其它 pending release 漂移，仅保留本次必要发布包。
- 完成最小发布闭环：
  - `@nextclaw/core@0.11.5`
  - `@nextclaw/runtime@0.2.19`
  - `nextclaw@0.16.5`

## 测试/验证/验收方式

- 定向测试：
  - `pnpm -C packages/nextclaw-core test -- --run src/config/schema.plugin-channels.test.ts`
  - `pnpm -C packages/nextclaw test -- --run src/cli/commands/builtin-channels.test.ts src/cli/commands/channels.test.ts`
- 定向静态检查与构建：
  - `pnpm -C packages/nextclaw-core tsc`
  - `pnpm -C packages/nextclaw-runtime lint`
  - `pnpm -C packages/nextclaw-runtime tsc`
  - `pnpm -C packages/nextclaw-runtime build`
  - `pnpm -C packages/nextclaw lint`
  - `pnpm -C packages/nextclaw tsc`
  - `pnpm -C packages/nextclaw build`
- 冒烟：
  - `TMP_HOME=$(mktemp -d /tmp/nextclaw-weixin-release-smoke.XXXXXX) && NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js channels status`
  - 观察点：输出包含 `Weixin: ✗`
- 可维护性检查：
  - `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths README.md docs/feature-universe.md docs/prd/current-feature-list.md docs/prd/current-feature-overview.md packages/nextclaw-core/src/config/schema.plugin-channels.test.ts packages/nextclaw-core/src/config/schema.ts packages/nextclaw-runtime/src/channels/builtin.ts packages/nextclaw/src/cli/commands/channels.ts packages/nextclaw/src/cli/commands/builtin-channels.test.ts packages/nextclaw/src/cli/commands/channels.test.ts`

## 发布/部署方式

- 本次按“只发必要包”的最小路径发布，未继续使用会自动放大发布范围的整仓 `changeset publish`。
- 实际发布命令：
  - `pnpm publish --access public --no-git-checks`（在 `packages/nextclaw-core` 下执行）
  - `pnpm publish --access public --no-git-checks`（在 `packages/nextclaw-runtime` 下执行）
  - `pnpm publish --access public --no-git-checks`（在 `packages/nextclaw` 下执行）
- 不适用项：
  - 远程 migration：不适用
  - 服务部署：不适用
  - 前端单独发布：不适用

## 用户/产品视角的验收步骤

1. 安装或升级到 `nextclaw@0.16.5`。
2. 启动服务后执行 `nextclaw channels status`，确认输出中出现 `Weixin`。
3. 打开配置 UI，确认渠道列表中能看到 Weixin 入口。
4. 在默认配置文件中确认存在 `channels.weixin.enabled: false`。
