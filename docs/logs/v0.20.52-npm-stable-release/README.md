# v0.20.52 NPM Stable Release

## 迭代完成说明

本次执行 NextClaw workspace 稳定版 NPM 发布闭环，将现有用户可见 changeset 与 full public workspace release batch 统一发布到 npm。

完成内容：

- 消费本批 `.changeset`，生成各公开包 `CHANGELOG.md` 与版本号更新。
- 发布 full public batch 共 49 个 npm 包。
- `nextclaw` 稳定版从 `0.21.6` 升级到 `0.21.7`。
- `@nextclaw/ui` 同步升级到 `0.13.13`，并刷新 `packages/nextclaw/ui-dist` 生成产物。
- 本批包含 `nextclaw app restart <app-id>`、真实 context compaction、chat workspace panel 持久化、SkillHub/marketplace 体验、provider metadata 与 reply format contract 等用户可见变更。

## 测试/验证/验收方式

- `pnpm release:report:health`
- `NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc npm whoami`
- `NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:auto:prepare`
- `NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:version`
- `NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:publish`
- `npm view nextclaw@latest version --json`
- `npm view nextclaw dist-tags --json`
- 临时目录安装烟测：`npm install --prefix <tmp> nextclaw@latest`
- 临时安装版本验证：`<tmp>/node_modules/.bin/nextclaw --version` 输出 `0.21.7`
- 隔离 `NEXTCLAW_HOME` 稳定更新检查：`nextclaw update --check --json` 返回 `status: "up-to-date"`
- GitHub Actions stable runtime workflow：`npm-runtime-update-release` run `27178430391` 成功
- public Pages stable manifest 四个平台均返回 `latestVersion: "0.21.7"`、`hostKind: "npm-runtime-bundle"`、`minimumLauncherVersion: "0.18.11"`
- 从 `nextclaw@0.21.6` 临时安装执行真实更新烟测：`update --check` -> `update --download-only` -> `update --apply` -> `nextclaw --version`，最终输出 `0.21.7`

## 发布/部署方式

已通过仓库标准 NPM 发布链路发布：

- `pnpm release:auto:prepare`
- `pnpm release:version`
- `pnpm release:publish`

`release:publish` 已完成 release batch build/tsc、changeset publish、`release:verify:published` 与本地 release tag 生成。

stable npm-runtime update channel 已触发并完成：

- workflow：`https://github.com/Peiiii/nextclaw/actions/runs/27178430391`
- release tag：`nextclaw@0.21.7`
- release assets：`nextclaw-runtime-darwin-arm64-0.21.7.zip`、`nextclaw-runtime-darwin-x64-0.21.7.zip`、`nextclaw-runtime-linux-x64-0.21.7.zip`、`nextclaw-runtime-win32-x64-0.21.7.zip`
- public manifest base：`https://peiiii.github.io/nextclaw/npm-runtime-updates/stable/`

## 用户/产品视角的验收步骤

1. 在全新临时目录安装 `nextclaw@latest`。
2. 运行 `nextclaw --version`，确认输出 `0.21.7`。
3. 使用隔离的 `NEXTCLAW_HOME` 运行 `nextclaw update --check --json`。
4. 确认稳定通道检查正常返回，不依赖本地源码、不依赖 workspace link。
5. 从旧版 `nextclaw@0.21.6` 运行稳定更新命令，确认可检测、下载、应用并切换到 `0.21.7`。

## 可维护性总结汇总

本次是发布与版本记录变更，不新增手写生产逻辑。主要变更来自 Changesets 自动版本化、changelog 聚合和 `@nextclaw/ui` 构建产物同步；没有新增平行实现、fallback 或临时兼容路径。

本次非测试代码净增不适用常规功能开发门槛：改动主体为 release metadata、changelog 与发布包生成产物。发布前后通过仓库 release 脚本的 build/tsc 与 registry 校验闭环。

## NPM 包发布记录

已发布 49 个包，`release:verify:published` 确认 49/49 package versions 可见。

关键包：

- `nextclaw@0.21.7`
- `@nextclaw/core@0.14.3`
- `@nextclaw/kernel@0.4.3`
- `@nextclaw/runtime@0.3.13`
- `@nextclaw/service@0.2.13`
- `@nextclaw/server@0.14.3`
- `@nextclaw/ui@0.13.13`
- `@nextclaw/ncp@0.6.2`
- `@nextclaw/ncp-mcp@0.1.108`

完整 package batch 由 `tmp/release-checkpoints/6298b02cff980fe4.json` 记录。
