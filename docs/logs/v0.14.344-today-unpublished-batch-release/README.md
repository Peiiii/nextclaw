# v0.14.344-today-unpublished-batch-release

## 迭代完成说明

- 统一收口 `2026-03-31` 上次已打 tag 发版点之后的未发布提交，避免“代码已合并、npm 版本未跟上”的漂移继续累积。
- 本批次纳入了今天已经进入主线但尚未发布的公开包改动，包括渠道启用/禁用一致性修复、渠道配置页声明式布局收敛、subagent follow-up 与 exec 环境修正，以及同批次进入仓库的前端资源更新。
- 发布策略采用单个 patch batch，把所有存在有效公开漂移的包一次性补齐，保证 CLI、UI、渠道插件和相关 NCP/runtime 依赖链重新回到一致的可安装状态。

## 测试/验证/验收方式

- 发布前先核对今天最后一个已发布 tag 点为 `2026-03-31 15:38:18 +0800` 的 `04da44c7`，随后确认其后的今日提交仍存在未发布公开包漂移。
- 已完成与本次渠道问题直接相关的定向验证：
  - `PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH" pnpm -C packages/nextclaw test -- --run src/cli/commands/plugin-reload.test.ts`
  - `PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH" pnpm -C packages/nextclaw-server test -- --run src/ui/router.weixin-channel-config.test.ts`
  - `PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH" pnpm -C packages/nextclaw-ui test -- --run src/components/config/channel-form-fields.test.ts src/components/config/weixin-channel-auth-section.test.tsx`
  - `PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH" pnpm -C packages/nextclaw tsc --noEmit`
  - `PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH" pnpm -C packages/nextclaw-server tsc -p tsconfig.json --noEmit`
  - `PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH" pnpm -C packages/nextclaw-ui tsc --noEmit`
- 正式发布前再执行标准发布链路：
  - `PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH" NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:version`
  - `PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH" NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:publish`

## 发布/部署方式

1. 在仓库根目录创建覆盖今日未发布公开包的统一 changeset。
2. 在隔离 worktree 中执行 `release:version`，生成版本号与 changelog 变更，避免碰到主工作区的未提交改动。
3. 提交版本号与 changelog 变更。
4. 在同一隔离 worktree 中执行 `release:publish`，跑发布批次校验、发布 npm 包并生成 git tags。
5. 将发版提交回写到主分支，保持仓库状态与线上已发布版本一致。

## 用户/产品视角的验收步骤

1. 安装或升级到本次统一补发后的最新 `nextclaw` / `@nextclaw/ui` / `@nextclaw/server` 与相关渠道插件版本。
2. 在飞书渠道中关闭 `Enabled` 并保存，确认机器人不再继续回复消息。
3. 在微信渠道中保持已连接状态，关闭 `Enabled` 并保存，确认 UI 正确显示“已连接但未启用”，且渠道不会继续生效。
4. 打开渠道配置页，确认微信渠道的启用开关与其它渠道保持一致位置和样式，同时表单布局已经由声明式定义驱动。
5. 在 CLI / UI 侧验证今天同批次进入仓库的其它修复已随本次版本一并可安装获取，而不是停留在未发布 commit 状态。
