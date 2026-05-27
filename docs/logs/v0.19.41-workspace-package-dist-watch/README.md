# Workspace Package Dist Watch

## 迭代完成说明

- 新增 workspace package dist/types 同步入口，用于让开发态 `exports.types -> dist/*.d.ts` 合同保持新鲜。
- 新增根命令 `dev:packages:build` 与 `dev:packages:watch`，自动发现带 `exports.types`、`dist/*.d.ts` 与 `build` 脚本的 workspace package。
- `pnpm dev start` 新增显式 `--package-watch` / `NEXTCLAW_DEV_PACKAGE_WATCH=1` 开关；默认不启用，避免影响普通开发启动成本。
- 改动限定在开发工具与基建层，不涉及业务链路代码。

## 测试/验证/验收方式

- `node --check scripts/dev/workspace-package-dist-watcher.mjs`
- `node --check scripts/dev/dev-runner.mjs`
- `pnpm exec eslint scripts/dev/workspace-package-dist-watcher.mjs scripts/dev/dev-runner.mjs`
- `node scripts/dev/workspace-package-dist-watcher.mjs --once --package @nextclaw/ncp`
- `touch packages/ncp-packages/nextclaw-ncp/src/index.ts && node scripts/dev/workspace-package-dist-watcher.mjs --once --package @nextclaw/ncp`
- `pnpm dev:packages:build -- --package @nextclaw/ncp`
- `pnpm dev:packages:watch -- --package @nextclaw/ncp`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths package.json scripts/dev/dev-runner.mjs scripts/dev/workspace-package-dist-watcher.mjs`

## 发布/部署方式

不涉及发布或部署。该迭代只新增本地开发态脚本与根命令。

## 用户/产品视角的验收步骤

1. 修改某个 workspace package 的 `src/**` 后运行 `pnpm dev:packages:build -- --package <package-name>`，应自动发现 stale dist 并执行该包自己的 `build`。
2. 开发 package dist/types 时运行 `pnpm dev:packages:watch -- --package <package-name>`，应保持监听并在源码变更后重建 dist。
3. 需要和主 dev server 一起启动时运行 `pnpm dev start --package-watch`，默认 `pnpm dev` 不应额外启动 package watcher。

## 可维护性总结汇总

- 本次为新增开发者基建能力，非业务功能改动。
- 保持 package 发布边界不变：`types` 仍指向 `dist/*.d.ts`，没有给消费者包添加 per-package `paths`。
- watcher 只读取 package 公共合同并调用 package 自己的 `build`，不感知业务语义。
- `post-edit-maintainability-review` 已使用；maintainability guard 无错误，提示新脚本接近单文件预算，后续若继续膨胀应拆分发现、stale 判断与 watch/build 队列。

## NPM 包发布记录

不涉及 NPM 包发布。
