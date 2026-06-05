# v0.20.29 NPM beta 发布

## 迭代完成说明

本次按用户要求执行 NPM beta 发布闭环。发布前主工作区存在两个未提交的 panel-app-creator 文档/skill 变更，因此使用隔离 worktree `/private/tmp/nextbot-npm-beta-release-20260605092922` 从已提交的 `75e0dcbd9` 发布，避免把未完成 WIP 带入发布。

发布入口为 `pnpm release:beta -- --branch master`。流程生成 full public workspace beta batch，执行 version、build/tsc release check、npm publish、registry verify、release commit/tag push，并触发 `npm-runtime-update-release` beta channel。发布完成后本地主工作区已 fast-forward 到 release commit `43da21a6f95eb76ddca8b6bdb2f03ca41ff709a4`，原有两个 WIP 文件保留。

## 测试/验证/验收方式

- `pnpm release:report:health`：确认当前 batch 外 release health clean；发布前可见部分 `beta.0` 已在 registry。
- `pnpm release:beta -- --dry-run --branch master`：确认将执行 full public workspace beta batch、push branch/tags，并触发 runtime channel。
- `pnpm release:beta -- --branch master`：完成 full public workspace beta batch；`release:check` 对 batch 执行 build/tsc，`release:verify:published` 确认 48/48 个 package version published。
- `npm view nextclaw@beta version`：`0.21.4-beta.1`。
- `npm view nextclaw dist-tags --json`：`beta` 指向 `0.21.4-beta.1`，`latest` 保持 `0.21.3`。
- `gh release view nextclaw@0.21.4-beta.1`：确认四个平台 runtime zip 存在。
- 公网 beta manifest 校验：`latestVersion=0.21.4-beta.1`，`minimumLauncherVersion=0.18.11`，`hostKind=npm-runtime-bundle`。
- `pnpm -C packages/nextclaw validation:npm-update -- --published-beta`：临时 prefix 安装 published beta，通过 `nextclaw --version` 和 `InputBudgetPruner` API 闭包验证。
- 真实全局安装验证：nvm prefix 与 Homebrew prefix 下的 `nextclaw` 均为 `0.21.4-beta.1`。
- 显式 nvm package 启动隔离服务：`/api/app/meta` 返回 `productVersion=0.21.4-beta.1`，进程路径为 nvm 全局 npm package。
- 临时 prefix 安装 `nextclaw@0.21.4-beta.0` 后执行 beta update check/download/apply：检测到 `0.21.4-beta.1`，下载成功，apply 后 `nextclaw --version` 输出 `0.21.4-beta.1`。

## 发布/部署方式

本次通过仓库发布入口执行：

```bash
pnpm release:beta -- --branch master
```

发布脚本已自动推送 `master` 与本地 package tags，并触发 beta NPM runtime update channel。runtime workflow：

```text
https://github.com/Peiiii/nextclaw/actions/runs/26989969996
```

runtime release：

```text
https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.21.4-beta.1
```

本次不涉及数据库 migration、远程后端 deploy、Cloudflare worker deploy 或桌面端 installer/DMG 发布。

## 用户/产品视角的验收步骤

用户可通过 NPM beta 安装并验证：

```bash
npm install -g nextclaw@beta
nextclaw --version
NEXTCLAW_HOME="$(mktemp -d)" nextclaw restart --ui-port 48732 --start-timeout 45000
curl http://127.0.0.1:48732/api/app/meta
```

期望结果：`nextclaw --version` 输出 `0.21.4-beta.1`，`/api/app/meta` 返回 `productVersion=0.21.4-beta.1`。

旧 beta 用户可通过 runtime update channel 升级：

```bash
NEXTCLAW_HOME="$(mktemp -d)" nextclaw update --channel beta --check
NEXTCLAW_HOME="$NEXTCLAW_HOME" nextclaw update --channel beta --download-only
NEXTCLAW_HOME="$NEXTCLAW_HOME" nextclaw update --apply
```

从 `0.21.4-beta.0` 验证时，`--check` 检测到 `0.21.4-beta.1`，`--download-only` 进入 `downloaded`，`--apply` 后新进程版本为 `0.21.4-beta.1`。

## 可维护性总结汇总

本次发布没有修改源码业务逻辑；release commit 只包含 changeset、package version 与 changelog 等发布元数据。release commit 统计为 100 files changed、2490 insertions、50 deletions，生产源码净增为 0。

本次没有新增平行实现、fallback、目录层级或业务 owner。由于没有源码实现变更，`post-edit-maintainability-guard`、`pnpm lint:new-code:governance` 与 `pnpm check:governance-backlog-ratchet` 不适用；发布前 build/tsc gate 已由 `release:check` 覆盖。

保留观察项：GitHub Actions 提示 Node.js 20 actions deprecation warning，当前不影响本次 runtime workflow 成功，但后续应在 workflow 维护窗口升级相关 actions 或 runner 配置。

## NPM 包发布记录

本次发布 full public workspace beta batch，registry verify 确认 48/48 个 package version published。核心用户入口：

- `nextclaw@0.21.4-beta.1`，dist-tag: `beta`
- `@nextclaw/client-sdk@0.3.0-beta.1`
- `@nextclaw/core@0.14.0-beta.1`
- `@nextclaw/kernel@0.4.0-beta.1`
- `@nextclaw/server@0.14.0-beta.1`
- `@nextclaw/service@0.2.10-beta.1`
- `@nextclaw/ui@0.13.10-beta.1`
- `@nextclaw/runtime@0.3.10-beta.1`
- `@nextclaw/ncp@0.5.29-beta.1`

其余发布包覆盖 NCP runtime、HTTP agent、MCP、React/UI SDK、channel extensions、NARP/NCP runtime adapters、app runtime、app SDK、agent chat、remote、shared、companion 与 aigen。`latest` dist-tag 未变更，仍指向 `nextclaw@0.21.3`。
