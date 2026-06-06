# v0.20.36 NPM beta 0.21.5 发布

## 迭代完成说明

本次按用户要求执行 `发布beta`，范围选择为 full public workspace beta batch，而不是只发布 `nextclaw` 单包。原因是 `nextclaw` 依赖完整 runtime workspace 闭包，单包发布会制造 CLI 版本、UI 资源和实际 runtime API 不一致的风险。

发布前已确认未发布 changeset 包含用户可见变更：rolling context compaction 服务消息 id 修复、NCP session summary peerId 暴露和 peerId 过滤、Panel App React/Vite/Tailwind 创建 skill、Panel App sandbox/runtime API 访问修复以及相关 UI/SDK/runtime 闭包更新。

发布过程中 `pnpm release:beta` 已完成 npm registry 发布、release commit、branch push、package tag push，并触发 `npm-runtime-update-release.yml` beta channel。脚本最后一次 GitHub API 读取 `gh-pages` manifest 时遇到本机网络 i/o timeout，但 workflow 已成功；随后通过 `origin/gh-pages` 源文件、公网 Pages manifest、release asset URL 和真实安装态更新烟测补齐闭环证据。

## 测试/验证/验收方式

- `npm whoami`：项目根 `.npmrc` 下认证为 `peiiii`。
- `pnpm release:report:health`：当前 batch 外 release health clean。
- `pnpm changeset pre enter beta`：进入 beta prerelease mode，并提交 `5176f2263 chore: enter beta prerelease mode`。
- `pnpm release:beta`：发布 full public workspace beta batch；`release:check` 对 batch 执行 build/tsc，`release:verify:published` 确认 48/48 package versions published。
- `npm view nextclaw@beta version`：`0.21.5-beta.0`。
- `npm view nextclaw dist-tags --json`：`beta` 指向 `0.21.5-beta.0`，`latest` 保持 `0.21.3`。
- GitHub Actions run `27053148951`：`npm-runtime-update-release` workflow conclusion 为 `success`。
- `origin/gh-pages` 四个平台 beta manifest：`latestVersion=0.21.5-beta.0`，`hostKind=npm-runtime-bundle`，`minimumLauncherVersion=0.18.11`。
- GitHub Pages 公网 manifest：Pages `built` 后，darwin-arm64、darwin-x64、linux-x64、win32-x64 全部指向 `0.21.5-beta.0`。
- 四个平台 runtime release asset URL 均返回 GitHub release download 302。
- `pnpm -C packages/nextclaw validation:npm-update -- --published-beta`：临时 prefix 安装 `nextclaw@beta`，验证 installed version 为 `0.21.5-beta.0`，且 published dependency closure 中 `InputBudgetPruner.estimate/prune` 为 function。
- 隔离安装 `nextclaw@0.21.4-beta.1` 后执行 `NEXTCLAW_HOME=<tmp> nextclaw update --channel beta --check`：检测到 `0.21.4-beta.1 -> 0.21.5-beta.0`。
- 同一隔离安装态重试 `update --download-only` 和 `update --apply`：下载 runtime bundle 成功，apply 后新进程 `nextclaw --version` 输出 `0.21.5-beta.0`。

## 发布/部署方式

本次通过仓库 beta 发布入口执行：

```bash
pnpm release:beta
```

发布过程生成并推送：

- beta pre mode commit：`5176f2263 chore: enter beta prerelease mode`
- release commit：`1ed5aff85 chore: release beta batch`
- branch：`master -> origin/master`
- package tags：包含 `nextclaw@0.21.5-beta.0` 及同批 public workspace package tags
- runtime workflow：[27053148951](https://github.com/Peiiii/nextclaw/actions/runs/27053148951)
- public beta manifest 示例：`https://peiiii.github.io/nextclaw/npm-runtime-updates/beta/manifest-beta-darwin-arm64.json`

不涉及数据库 migration、后端远程部署、Cloudflare worker 部署或桌面端 DMG/installer 发布。

## 用户/产品视角的验收步骤

用户可通过以下命令安装并验证 beta：

```bash
npm install -g nextclaw@beta
nextclaw --version
```

期望结果：`nextclaw --version` 输出 `0.21.5-beta.0`。

从旧 beta 验证 NPM runtime update channel：

```bash
NEXTCLAW_HOME="$(mktemp -d)" nextclaw update --channel beta --check
NEXTCLAW_HOME="$NEXTCLAW_HOME" nextclaw update --channel beta --download-only
NEXTCLAW_HOME="$NEXTCLAW_HOME" nextclaw update --apply
nextclaw --version
```

期望结果：旧版检测到 `0.21.5-beta.0`，下载并应用后新进程运行 `0.21.5-beta.0`。

## 可维护性总结汇总

本次没有额外修改运行时代码，主要变更是 Changesets prerelease 状态、package 版本/changelog、发布生成的 `packages/nextclaw/ui-dist` 包 payload，以及本发布记录。发布窗口内没有新增平行实现、fallback、目录膨胀或业务 owner 迁移。

`release:check` 已对发布 batch 执行 build/tsc；未额外运行全仓库 lint/governance，因为本次发布脚本已完成发布前批次校验，后续补充的是发布留痕文档。非功能改动的“非测试代码净增 <= 0”门槛不适用于版本化与发布产物提交；这些文件是 NPM 发布合同的一部分。

复盘：本次唯一摩擦是发布脚本最后读取 GitHub API 时遇到本机网络超时。由于 workflow、`gh-pages` 源文件、公网 Pages 和真实安装态均已补验通过，未调整发布代码；若同类 GitHub API timeout 再次出现，应把 `verifyPublicRuntimeManifests` 的 `gh api` 读取改为带 retry，并在 API 失败时自动 fallback 到 `git fetch origin gh-pages` 验证源文件。

## NPM 包发布记录

本次发布 48 个 public workspace beta package，核心用户入口：

- `nextclaw@0.21.5-beta.0`，dist-tag: `beta`
- `@nextclaw/core@0.14.1-beta.0`
- `@nextclaw/kernel@0.4.1-beta.0`
- `@nextclaw/service@0.2.11-beta.0`
- `@nextclaw/server@0.14.1-beta.0`
- `@nextclaw/ui@0.13.11-beta.0`
- `@nextclaw/client-sdk@0.4.0-beta.0`
- `@nextclaw/ncp@0.6.0-beta.0`
- `@nextclaw/ncp-toolkit@0.5.35-beta.0`
- `@nextclaw/runtime@0.3.11-beta.0`

其余发布包覆盖 channel extensions、NCP runtime packages、agent chat、app runtime/app SDK、remote、shared、MCP、companion 与 runtime adapters。Registry verify 已确认 48/48 package versions published。
