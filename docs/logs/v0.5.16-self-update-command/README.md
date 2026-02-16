# v0.5.16-self-update-command

## 做了什么
- 新增 `nextclaw update` 命令用于自我升级。
- 抽取自我升级逻辑到共享模块，CLI 与 gateway update.run 复用同一实现，避免重复逻辑。
- 升级策略：
  1) `NEXTCLAW_UPDATE_COMMAND` 覆盖
  2) `npm i -g nextclaw`
- 文档补充 `nextclaw update` 命令说明。
- 文档移除“从源码运行”场景；update 不再尝试 git 拉取。

## 验证
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm build`
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm lint`
  - 仅警告：`packages/nextclaw-core/src/channels/mochat.ts`、`packages/nextclaw/src/cli/runtime.ts` 超过行数限制
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm tsc`
- 冒烟（非仓库目录）：
  - `NEXTCLAW_UPDATE_COMMAND="node -e \"console.log('ok')\"" node /Users/peiwang/Projects/nextbot/packages/nextclaw/dist/cli/index.js update --timeout 1200000`
  - 预期：输出 `✓ Update complete (command)`

## 发布/部署
- 已按 `docs/workflows/npm-release-process.md` 发布 npm：
  - `pnpm changeset`（手工创建 changeset）
  - `pnpm release:version`
  - `pnpm release:publish`
  - 发布结果：`nextclaw@0.4.6`（其余包版本未变，跳过发布）
