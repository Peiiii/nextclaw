# Desktop Stable 0.21.4

## 迭代完成说明

本次准备并执行 NextClaw Desktop `0.0.207` / runtime bundle `0.21.4` 正式稳定版发布，GitHub Release 为 `v0.21.4-desktop.1`。

发布前先发现并阻止了一个错误发布路径：当前仓库仍处于 Changesets `pre` / `beta` mode，直接运行 stable desktop release 会生成 `v0.21.4-beta.1-desktop.1`，并把 `0.0.207-beta.1` / `0.21.4-beta.1` 写入 stable channel。该路径已停止，改为先退出 beta pre mode 并生成正式版本元数据。

准备结果：

- Desktop app version: `0.0.207`
- Runtime bundle version: `0.21.4`
- Stable release tag: `v0.21.4-desktop.1`
- Stable `minimumLauncherVersion`: `0.0.141`
- GitHub release notes: `docs/logs/v0.20.31-desktop-stable-0-21-4/github-release.md`
- GitHub release URL: `https://github.com/Peiiii/nextclaw/releases/tag/v0.21.4-desktop.1`
- GitHub Actions run: `27011865052`

## 测试/验证/验收方式

- `PATH=/opt/homebrew/bin:$PATH pnpm release:desktop:stable -- --dry-run`：首次 dry-run 暴露 beta identity，不发布。
- `pnpm changeset pre exit` 与 `pnpm changeset version`：生成正式版本元数据，消费 beta changesets。
- `PATH=/opt/homebrew/bin:$PATH pnpm release:desktop:stable -- --dry-run`：重新确认计划为 `v0.21.4-desktop.1 / 0.0.207 / 0.21.4 / floor 0.0.141`。
- `PATH=/opt/homebrew/bin:$PATH pnpm release:desktop:stable -- --notes-file docs/logs/v0.20.31-desktop-stable-0-21-4/github-release.md`：完成本地隔离打包、macOS DMG GUI 冒烟、命令面冒烟、远端 preflight、GitHub Release、release assets、stable update manifest 与 stable APT repo 发布。
- 发布脚本已验证 GitHub release assets、`gh-pages` stable manifest、公开 stable manifest、`gh-pages` stable APT repo 与公开 stable APT repo。

## 发布/部署方式

已通过仓库稳定桌面发布自动化执行：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm release:desktop:stable -- --notes-file docs/logs/v0.20.31-desktop-stable-0-21-4/github-release.md
```

官网/landing 下载 fallback 是下游发布面，已在 GitHub release assets、public stable update manifest 与 stable APT repo 全部闭合后同步更新到 `v0.21.4-desktop.1 / 0.0.207`，并部署到 `https://17842e36.nextclaw-landing.pages.dev`。

## 用户/产品视角的验收步骤

- stable 桌面用户检查更新时，应看到 runtime bundle `0.21.4`。
- 新用户从正式 GitHub release 下载 `0.0.207` 安装包。
- Linux 用户通过 stable APT 源应能安装或升级到 `nextclaw-desktop 0.0.207`。
- 官网下载页若 GitHub API 可用，应自动解析最新正式桌面 release；fallback 已更新到本次正式版，并已在 `https://nextclaw.io/en/download/` 复验结构化 `downloadUrl`。

## 可维护性总结汇总

本次准备变更主要是 Changesets 生成的 release metadata、版本号、changelog 与正式 release notes。

- 未新增运行时业务逻辑。
- 没有修改 desktop release 脚本或 workflow。
- 通过 dry-run 阻止 beta identity 污染 stable channel，发布路径更可预测。
- 非测试生产源码净增：`0`。
- `post-edit-maintainability-review` 对 release metadata 不适用；正式发布后已披露 release metadata 规模与发布闭包状态。

## NPM 包发布记录

本次版本化生成了正式 NPM package metadata，但当前任务目标是桌面端正式发布。

- 是否已经执行 NPM publish：否。
- 本地 package versions 已从 `*-beta.1` 转为正式版本，供 desktop stable bundle 使用。
- 若后续要同步 NPM stable/latest，需要按 `npm-release-contract-guard` 单独执行 registry publish、runtime update channel 与真实安装验证闭环。
