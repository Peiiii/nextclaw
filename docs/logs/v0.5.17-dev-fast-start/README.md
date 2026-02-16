# v0.5.17-dev-fast-start

## 做了什么
- `pnpm nextclaw start` 开发态不再强制 build，改为直接用 `tsx` 运行源码以提升启动速度。
- `pnpm dev` 走 `tsx watch`，自带热重启（watch）。
- 保留原先带 build 的脚本为 `pnpm -C packages/nextclaw dev:build` 以便需要完整编译时使用。

## 验证
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm build`
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm lint`
  - 仅警告：`packages/nextclaw-core/src/channels/mochat.ts`、`packages/nextclaw/src/cli/runtime.ts` 超过行数限制
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm tsc`
- 冒烟（非仓库目录）：
  - `NEXTCLAW_HOME=/tmp/nextclaw-smoke-$$ pnpm -C /Users/peiwang/Projects/nextbot dev`
  - 预期：进入 watch 并输出 CLI 帮助（不执行 build）

## 发布/部署
- 如需发布 npm：按 `docs/workflows/npm-release-process.md` 走完整流程。
